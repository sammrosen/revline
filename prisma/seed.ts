/**
 * Seed script for RevOps MVP
 * 
 * Run with: npm run db:seed
 * 
 * This script:
 * 1. Creates the admin account (if not exists)
 * 2. Creates your client record (if not exists)
 * 3. Migrates existing env var secrets to encrypted DB storage
 */

// Load environment variables from .env.local first, then .env
import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import { PrismaClient, IntegrationType } from '@prisma/client';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import * as readline from 'readline';

const prisma = new PrismaClient();

// Encryption functions (duplicated here for standalone script)
function encryptSecret(plaintext: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, encrypted, authTag]).toString('base64');
}

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  console.log('🚀 RevOps MVP Seed Script\n');

  // Connect to database
  try {
    await prisma.$connect();
    console.log('✓ Connected to database\n');
  } catch (error) {
    console.error('✗ Failed to connect to database:', error);
    process.exit(1);
  }

  // Check for encryption key
  const encryptionKey = process.env.SRB_ENCRYPTION_KEY;
  if (!encryptionKey || encryptionKey.length !== 64) {
    console.log('⚠️  SRB_ENCRYPTION_KEY not set or invalid.');
    console.log('   Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    console.log('   Add it to your .env file as SRB_ENCRYPTION_KEY=<key>\n');
    process.exit(1);
  }

  // 1. Create Admin Account
  console.log('📦 Step 1: Admin Account');
  const existingAdmin = await prisma.admin.findFirst();

  if (existingAdmin) {
    console.log('   ✓ Admin account already exists\n');
  } else {
    const password = await prompt('   Enter admin password: ');
    if (!password || password.length < 8) {
      console.log('   ✗ Password must be at least 8 characters');
      process.exit(1);
    }

    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    await prisma.admin.create({
      data: { passwordHash },
    });
    console.log('   ✓ Admin account created\n');
  }

  // 2. Create Your Client Record
  console.log('📦 Step 2: Your Client Record');
  const YOUR_CLIENT_SLUG = 'sam'; // Change this to your slug
  const YOUR_CLIENT_NAME = 'Sam Rosen'; // Change this to your name

  let client = await prisma.client.findUnique({
    where: { slug: YOUR_CLIENT_SLUG },
  });

  if (client) {
    console.log(`   ✓ Client "${YOUR_CLIENT_NAME}" already exists\n`);
  } else {
    client = await prisma.client.create({
      data: {
        name: YOUR_CLIENT_NAME,
        slug: YOUR_CLIENT_SLUG,
        timezone: 'America/New_York',
      },
    });
    console.log(`   ✓ Client "${YOUR_CLIENT_NAME}" created\n`);
  }

  // 3. Migrate MailerLite Integration
  console.log('📦 Step 3: MailerLite Integration');
  const existingMailerlite = await prisma.clientIntegration.findUnique({
    where: {
      clientId_integration: {
        clientId: client.id,
        integration: IntegrationType.MAILERLITE,
      },
    },
  });

  if (existingMailerlite) {
    console.log('   ✓ MailerLite integration already exists\n');
  } else {
    const mailerliteApiKey = process.env.MAILERLITE_API_KEY;
    if (!mailerliteApiKey) {
      console.log('   ⚠ MAILERLITE_API_KEY not found in env - skipping\n');
    } else {
      // Get group IDs from env
      const leadGroupId = process.env.MAILERLITE_GROUP_ID || process.env.MAILERLITE_GROUP_ID_SAM;
      const customerGroupId = process.env.MAILERLITE_CUSTOMER_GROUP_SAM;

      await prisma.clientIntegration.create({
        data: {
          clientId: client.id,
          integration: IntegrationType.MAILERLITE,
          encryptedSecret: encryptSecret(mailerliteApiKey, encryptionKey),
          meta: {
            groupIds: {
              lead: leadGroupId || null,
              customer: customerGroupId || null,
            },
          },
        },
      });
      console.log('   ✓ MailerLite integration created\n');
    }
  }

  // 4. Migrate Stripe Integration
  console.log('📦 Step 4: Stripe Integration');
  const existingStripe = await prisma.clientIntegration.findUnique({
    where: {
      clientId_integration: {
        clientId: client.id,
        integration: IntegrationType.STRIPE,
      },
    },
  });

  if (existingStripe) {
    console.log('   ✓ Stripe integration already exists\n');
  } else {
    const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET_SAM;
    const stripeApiKey = process.env.STRIPE_API_KEY;

    if (!stripeWebhookSecret) {
      console.log('   ⚠ STRIPE_WEBHOOK_SECRET_SAM not found in env - skipping\n');
    } else {
      await prisma.clientIntegration.create({
        data: {
          clientId: client.id,
          integration: IntegrationType.STRIPE,
          encryptedSecret: encryptSecret(stripeWebhookSecret, encryptionKey),
          meta: stripeApiKey ? { apiKey: stripeApiKey } : undefined,
        },
      });
      console.log('   ✓ Stripe integration created\n');
    }
  }

  console.log('✅ Seed complete!\n');
  console.log('Next steps:');
  console.log('1. Run migrations: npx prisma migrate dev');
  console.log('2. Start the app: npm run dev');
  console.log('3. Login at: /admin/login');
  console.log('4. Add more integrations via the admin UI\n');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


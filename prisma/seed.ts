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

import { PrismaClient, IntegrationType, Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import * as readline from 'readline';

const prisma = new PrismaClient();

// Encryption functions (duplicated here for standalone script)
// Key version 1 = REVLINE_ENCRYPTION_KEY_V1, 0 = legacy SRB_ENCRYPTION_KEY
const SEED_KEY_VERSION = 1; // New integrations use version 1

interface IntegrationSecret {
  id: string;
  name: string;
  encryptedValue: string;
  keyVersion: number;
}

function encryptSecretValue(plaintext: string, keyHex: string): { encryptedValue: string; keyVersion: number } {
  const key = Buffer.from(keyHex, 'hex');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return {
    encryptedValue: Buffer.concat([iv, encrypted, authTag]).toString('base64'),
    keyVersion: SEED_KEY_VERSION,
  };
}

function createSecret(name: string, plaintext: string, keyHex: string): IntegrationSecret {
  const { encryptedValue, keyVersion } = encryptSecretValue(plaintext, keyHex);
  return {
    id: crypto.randomUUID(),
    name,
    encryptedValue,
    keyVersion,
  };
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

  // Check for encryption key (support both new and legacy names)
  const encryptionKey = process.env.REVLINE_ENCRYPTION_KEY || process.env.SRB_ENCRYPTION_KEY;
  if (!encryptionKey || encryptionKey.length !== 64) {
    console.log('⚠️  REVLINE_ENCRYPTION_KEY not set or invalid.');
    console.log('   Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    console.log('   Add it to your .env file as REVLINE_ENCRYPTION_KEY=<key>\n');
    process.exit(1);
  }

  // 1. Create User Account
  console.log('📦 Step 1: User Account');
  const existingUser = await prisma.user.findFirst();

  if (existingUser) {
    console.log('   ✓ User account already exists\n');
  } else {
    const email = await prompt('   Enter user email: ');
    if (!email || !email.includes('@')) {
      console.log('   ✗ Valid email is required');
      process.exit(1);
    }
    
    const password = await prompt('   Enter user password: ');
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

    await prisma.user.create({
      data: { 
        email: email.toLowerCase(),
        passwordHash,
      },
    });
    console.log('   ✓ User account created\n');
  }

  // 2. Create Your Client Record
  console.log('📦 Step 2: Your Client Record');
  const YOUR_CLIENT_SLUG = 'sam'; // Change this to your slug
  const YOUR_CLIENT_NAME = 'Sam Rosen'; // Change this to your name

  let client = await prisma.workspace.findUnique({
    where: { slug: YOUR_CLIENT_SLUG },
  });

  if (client) {
    console.log(`   ✓ Client "${YOUR_CLIENT_NAME}" already exists\n`);
  } else {
    client = await prisma.workspace.create({
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
  const existingMailerlite = await prisma.workspaceIntegration.findUnique({
    where: {
      workspaceId_integration: {
        workspaceId: client.id,
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

      // Create the secrets array with API Key
      const secrets: IntegrationSecret[] = [
        createSecret('API Key', mailerliteApiKey, encryptionKey),
      ];

      // Build meta with new format (groups + routing)
      const groups: Record<string, { id: string; name: string }> = {};
      const routing: Record<string, string> = {};
      
      if (leadGroupId) {
        groups['leads'] = { id: leadGroupId, name: 'Leads' };
        routing['lead.captured'] = 'leads';
      }
      if (customerGroupId) {
        groups['customers'] = { id: customerGroupId, name: 'Customers' };
        routing['lead.paid'] = 'customers';
      }

      await prisma.workspaceIntegration.create({
        data: {
          workspaceId: client.id,
          integration: IntegrationType.MAILERLITE,
          secrets: secrets as unknown as Prisma.InputJsonValue,
          meta: {
            groups,
            routing,
          },
        },
      });
      console.log('   ✓ MailerLite integration created\n');
    }
  }

  // 4. Migrate Stripe Integration
  console.log('📦 Step 4: Stripe Integration');
  const existingStripe = await prisma.workspaceIntegration.findUnique({
    where: {
      workspaceId_integration: {
        workspaceId: client.id,
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
      // Create the secrets array
      const secrets: IntegrationSecret[] = [
        createSecret('Webhook Secret', stripeWebhookSecret, encryptionKey),
      ];
      
      // Add API key as a secret if provided
      if (stripeApiKey) {
        secrets.push(createSecret('API Key', stripeApiKey, encryptionKey));
      }

      await prisma.workspaceIntegration.create({
        data: {
          workspaceId: client.id,
          integration: IntegrationType.STRIPE,
          secrets: secrets as unknown as Prisma.InputJsonValue,
        },
      });
      console.log('   ✓ Stripe integration created\n');
    }
  }

  console.log('✅ Seed complete!\n');
  console.log('Next steps:');
  console.log('1. Run migrations: npx prisma migrate dev');
  console.log('2. Start the app: npm run dev');
  console.log('3. Login at: /login');
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

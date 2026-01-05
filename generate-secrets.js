#!/usr/bin/env node
/**
 * Generate secrets for RevLine platform
 * 
 * Usage: node generate-secrets.js
 * 
 * Outputs REVLINE_ENCRYPTION_KEY and CRON_SECRET ready to paste into .env.local
 */

const crypto = require('crypto');

function generateSecret() {
  return crypto.randomBytes(32).toString('hex');
}

console.log('# Generated secrets - add these to your .env.local file\n');
console.log(`REVLINE_ENCRYPTION_KEY=${generateSecret()}`);
console.log(`CRON_SECRET=${generateSecret()}`);
console.log('\n# Copy the above lines into your .env.local file');


/**
 * Global Test Setup
 * 
 * Creates isolated test databases for parallel test execution.
 * Each Vitest worker gets its own database to avoid conflicts.
 * 
 * IMPORTANT: This runs in a separate Node.js process before workers start,
 * so we must load dotenv ourselves - setup.ts env loading doesn't apply here.
 * 
 * This runs ONCE before all tests start.
 * Returns a teardown function that drops databases after all tests complete.
 */

// Load env files FIRST - this is critical since globalSetup runs in isolation
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

import { execSync } from 'child_process';
import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'fs';
import { resolve } from 'path';

// Number of parallel test databases to create
// Can be overridden via VITEST_MAX_THREADS env var
const NUM_WORKERS = parseInt(process.env.VITEST_MAX_THREADS || '4', 10);

// File to store created database names for teardown
const DB_LIST_FILE = resolve(__dirname, '../.test-databases.json');

interface DbConfig {
  baseUrl: string;
  params: string;
  databases: string[];
}

/**
 * Parse PostgreSQL connection URL
 */
function parseDbUrl(url: string) {
  const match = url.match(/^(postgresql:\/\/[^/]+)\/([^?]+)(\?.*)?$/);
  if (!match) {
    throw new Error(`Invalid DATABASE_URL format: ${url}`);
  }
  return {
    baseUrl: match[1], // postgresql://user:pass@host:port
    dbName: match[2],  // database name
    params: match[3] || '', // ?sslmode=require etc.
  };
}

/**
 * Execute SQL command on postgres database (for CREATE/DROP DATABASE)
 */
function execSql(baseUrl: string, params: string, sql: string, ignorePattern?: string) {
  // Connect to 'postgres' database to run admin commands
  const adminUrl = `${baseUrl}/postgres${params}`;
  
  try {
    execSync(`npx prisma db execute --url "${adminUrl}" --stdin`, {
      input: sql,
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf-8',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Ignore expected errors (like "already exists" or "does not exist")
    if (ignorePattern && message.includes(ignorePattern)) {
      return;
    }
    if (!message.includes('already exists') && !message.includes('does not exist')) {
      console.warn(`SQL warning: ${message}`);
    }
  }
}

/**
 * Create a test database and run migrations
 */
async function createTestDatabase(baseUrl: string, params: string, dbName: string) {
  console.log(`Creating test database: ${dbName}`);
  
  // Create the database
  execSql(baseUrl, params, `CREATE DATABASE "${dbName}";`);
  
  // Build the full URL for this database
  const dbUrl = `${baseUrl}/${dbName}${params}`;
  
  // Run migrations
  console.log(`Running migrations on: ${dbName}`);
  execSync('npx prisma migrate deploy', {
    stdio: 'pipe',
    env: {
      ...process.env,
      DATABASE_URL: dbUrl,
    },
  });
  
  return dbName;
}

/**
 * Teardown function - drops all test databases
 */
async function globalTeardown() {
  console.log('\n=== Global Test Teardown ===\n');
  
  // Check if database list file exists
  if (!existsSync(DB_LIST_FILE)) {
    console.log('No test databases to clean up (file not found)');
    return;
  }
  
  // Read database list
  let config: DbConfig;
  try {
    const content = readFileSync(DB_LIST_FILE, 'utf-8');
    config = JSON.parse(content);
  } catch (error) {
    console.error('Failed to read database list:', error);
    return;
  }
  
  const { baseUrl, params, databases } = config;
  
  console.log(`Dropping ${databases.length} test databases...\n`);
  
  // Drop each database
  for (const dbName of databases) {
    console.log(`Dropping: ${dbName}`);
    try {
      // Force disconnect all connections before dropping
      execSql(baseUrl, params, `
        SELECT pg_terminate_backend(pg_stat_activity.pid)
        FROM pg_stat_activity
        WHERE pg_stat_activity.datname = '${dbName}'
          AND pid <> pg_backend_pid();
      `);
      
      // Drop the database
      execSql(baseUrl, params, `DROP DATABASE IF EXISTS "${dbName}";`);
    } catch (error) {
      console.warn(`Warning: Failed to drop ${dbName}:`, error);
    }
  }
  
  // Clean up the database list file
  try {
    unlinkSync(DB_LIST_FILE);
  } catch {
    // Ignore cleanup errors
  }
  
  console.log('\n=== Teardown Complete ===\n');
}

/**
 * Global setup - runs before all tests
 * Returns teardown function that runs after all tests
 */
export default async function globalSetup() {
  console.log('\n=== Global Test Setup ===\n');
  
  // Get base database URL
  const testDbUrl = process.env.TEST_DATABASE_URL;
  if (!testDbUrl) {
    console.error('ERROR: TEST_DATABASE_URL not found.');
    console.error('Make sure TEST_DATABASE_URL is set in your environment or .env.local file.');
    throw new Error('TEST_DATABASE_URL environment variable is required');
  }
  
  console.log(`Base URL: ${testDbUrl.replace(/:[^:@]+@/, ':****@')}`);
  console.log(`Creating ${NUM_WORKERS} parallel test databases...\n`);
  
  const { baseUrl, params } = parseDbUrl(testDbUrl);
  
  // Create databases for each worker
  const createdDatabases: string[] = [];
  
  for (let i = 0; i < NUM_WORKERS; i++) {
    const dbName = `test_db_${i}`;
    try {
      await createTestDatabase(baseUrl, params, dbName);
      createdDatabases.push(dbName);
    } catch (error) {
      console.error(`Failed to create database ${dbName}:`, error);
      // Continue with other databases
    }
  }
  
  // Store database names for teardown
  writeFileSync(DB_LIST_FILE, JSON.stringify({
    baseUrl,
    params,
    databases: createdDatabases,
  }, null, 2));
  
  console.log(`\nCreated ${createdDatabases.length} test databases`);
  console.log('=== Setup Complete ===\n');
  
  // Return teardown function - vitest will call this after all tests complete
  return globalTeardown;
}

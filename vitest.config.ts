import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./__tests__/setup.ts'],

    // Exclude embedded Claude Code worktrees, build output, and node_modules.
    // The default exclude doesn't cover .claude/worktrees/ which contains
    // separate working trees from other Claude Code sessions.
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.claude/**',
    ],

    // Global setup creates isolated databases for each worker
    // The setup function returns a teardown function that drops them after tests
    globalSetup: ['./__tests__/globalSetup.ts'],
    
    // Enable parallel execution with isolated databases per worker
    // Each worker gets its own database (test_db_0, test_db_1, etc.)
    pool: 'threads',
    poolOptions: {
      threads: {
        minThreads: 1,
        // Default to 4 threads, can override via VITEST_MAX_THREADS env var
        maxThreads: parseInt(process.env.VITEST_MAX_THREADS || '4', 10),
        isolate: true,
      },
    },
    
    // Enable file parallelism - run test files in parallel across workers
    fileParallelism: true,
    
    // Consistent test ordering within each file
    sequence: {
      shuffle: false,
    },
    
    // Increase timeout for database operations
    testTimeout: 30000,
    
    // Don't retry tests - each test should be deterministic
    retry: 0,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});

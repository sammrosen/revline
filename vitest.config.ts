import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./__tests__/setup.ts'],
    // Run ALL tests sequentially to avoid database isolation issues
    // Using threads pool with single thread for maximum isolation
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true,
        isolate: true,
      },
    },
    // Disable file parallelism - run test files one at a time
    fileParallelism: false,
    // Max 1 concurrent test at a time
    maxConcurrency: 1,
    // Consistent test ordering
    sequence: {
      shuffle: false,
    },
    // Increase timeout for database operations
    testTimeout: 30000,
    // Don't retry tests - afterEach cleanup causes issues with retry
    retry: 0,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});

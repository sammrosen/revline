import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./__tests__/setup.ts'],
    // Run ALL tests sequentially to avoid database isolation issues
    // This is critical when tests share a database and use afterEach cleanup
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    // Disable file parallelism - run test files one at a time
    fileParallelism: false,
    // Consistent test ordering
    sequence: {
      shuffle: false,
    },
    // Increase timeout for database operations
    testTimeout: 30000,
    // Don't retry tests - afterEach cleanup causes issues with retry
    // If a test fails, it should be fixed rather than retried
    retry: 0,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./__tests__/setup.ts'],
    // Run tests sequentially to avoid database isolation issues
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    // Consistent test ordering
    sequence: {
      shuffle: false,
    },
    // Increase timeout for database operations
    testTimeout: 30000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});

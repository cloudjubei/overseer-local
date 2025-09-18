import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    setupFiles: './tests/setup.ts',
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/generated/**/*',
        'src/index.ts', // Entry point is hard to test directly
      ],
    },
  },
});

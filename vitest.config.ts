import { defineConfig, coverageConfigDefaults } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    setupFiles: './tests/setup.ts',
    environment: 'node',
    coverage: {
      provider: 'v8',
      reportsDirectory: '.coverage-v8',
      reporter: ['text', 'json'],
      include: ['src/**/*.ts'],
      exclude: [
        ...coverageConfigDefaults.exclude,
        'src/generated/**/*',
        'src/index.ts', // Entry point is hard to test directly
        'tests/**', 
        '.stories/**'
      ],
    },
  },
})

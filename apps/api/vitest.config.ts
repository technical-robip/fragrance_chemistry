import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts', 'src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      reportsDirectory: './coverage',
      include: [
        'src/config/**/*.ts',
        'src/modules/auth/auth.service.ts',
        'src/modules/dashboard/dashboard.service.ts',
        'src/modules/health/health.controller.ts',
        'src/modules/ifra/ifra.controller.ts',
        'src/modules/costing/costing.service.ts',
        'src/redis/redis.service.ts',
        'src/common/pipes/zod-validation.pipe.ts',
      ],
      exclude: ['**/*.module.ts', '**/main.ts', '**/*.spec.ts', '**/*.test.ts'],
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 80,
        lines: 80,
      },
    },
  },
});

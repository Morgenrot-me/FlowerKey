/**
 * 花钥 FlowerKey - Vitest 测试配置
 * 统一配置 monorepo 的核心库、共享 UI 和端侧单元测试环境
 */
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@flowerkey/core': resolve(__dirname, 'packages/core/src/index.ts'),
      '@flowerkey/ui': resolve(__dirname, 'packages/ui/src'),
      '@core': resolve(__dirname, 'packages/core/src'),
      '@ui': resolve(__dirname, 'packages/ui/src'),
    },
  },
  test: {
    environment: 'happy-dom',
    setupFiles: ['test/setup.ts'],
    include: ['packages/**/*.{test,spec}.{ts,tsx}', 'scripts/**/*.test.ts'],
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['packages/core/src/**/*.{ts,vue}', 'packages/ui/src/**/*.{ts,vue}'],
      exclude: [
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/dist/**',
        '**/node_modules/**',
        'packages/core/src/index.ts',
      ],
    },
  },
});

/**
 * 花钥浏览器插件 Vite 构建配置
 * 负责构建 popup、sidepanel、background、content script
 */
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@core': resolve(__dirname, '../core/src'),
      '@ui': resolve(__dirname, '../ui/src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'popup/index.html'),
        sidepanel: resolve(__dirname, 'sidepanel/index.html'),
        background: resolve(__dirname, 'background/service-worker.ts'),
        content: resolve(__dirname, 'content/index.ts'),
      },
      output: {
        entryFileNames: '[name]/index.js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
})

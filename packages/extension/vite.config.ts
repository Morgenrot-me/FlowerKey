/**
 * 花钥浏览器插件 Vite 构建配置
 * 负责构建 popup、sidepanel、background、content script
 */
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '../..').replace(/\\/g, '/')

export default defineConfig({
  plugins: [
    vue(),
    {
      name: 'copy-extension-assets',
      closeBundle() {
        // 复制 manifest.json
        copyFileSync(resolve(__dirname, 'manifest.json'), resolve(__dirname, 'dist/manifest.json'));
        // 复制 icons/（如存在）
        const iconsDir = resolve(__dirname, 'icons');
        const outIconsDir = resolve(__dirname, 'dist/icons');
        try {
          mkdirSync(outIconsDir, { recursive: true });
          for (const f of readdirSync(iconsDir)) {
            copyFileSync(resolve(iconsDir, f), resolve(outIconsDir, f));
          }
        } catch { /* icons 目录不存在则跳过 */ }
      },
    },
  ],
  css: {
    postcss: {
      plugins: [
        tailwindcss({
          content: [
            root + '/packages/ui/src/**/*.{vue,ts}',
            root + '/packages/extension/**/*.{vue,ts,html}',
          ],
          theme: { extend: {} },
          plugins: [],
        }),
        autoprefixer(),
      ],
    },
  },
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

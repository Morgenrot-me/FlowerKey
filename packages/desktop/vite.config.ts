import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { readFileSync } from 'fs';

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));

export default defineConfig({
  plugins: [vue()],
  define: { __APP_VERSION__: JSON.stringify(version) },
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  build: { outDir: 'dist', target: ['es2021', 'chrome105', 'safari13'] },
});

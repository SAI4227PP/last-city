import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [
    wasm()
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 3000,
    open: true
  },
  build: {
    target: 'esnext',
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@dimforge/rapier3d-compat')) {
            return 'vendor-physics';
          }
          if (id.includes('three')) {
            return 'vendor-three';
          }
          if (id.includes('zustand') || id.includes('idb') || id.includes('howler') || id.includes('zod')) {
            return 'vendor-ui-core';
          }
        }
      }
    }
  }
});

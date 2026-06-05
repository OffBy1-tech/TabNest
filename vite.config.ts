import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import webExtension from 'vite-plugin-web-extension';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    webExtension({
      manifest: './manifest.json',
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Prevent any eval or dynamic remote imports
    rollupOptions: {
      output: {
        // Preserve source path structure for script entries (background, content scripts)
        // so vite-plugin-web-extension can map manifest source paths to output files.
        // e.g. src/background/index.ts → src/background/index.js in dist/
        entryFileNames: (chunkInfo) => {
          const id = chunkInfo.facadeModuleId
          if (id) {
            const rel = path.relative(__dirname, id)
            if (!rel.startsWith('..') && !rel.startsWith('/')) {
              return rel.replace(/\.tsx?$/, '.js')
            }
          }
          return '[name].js'
        },
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
    // Target modern Chrome (MV3 minimum_chrome_version: 120)
    target: 'chrome120',
    // No source maps in production builds (reduces extension size)
    sourcemap: false,
  },
  // MV3 CSP (script-src 'self') already prevents eval() and remote imports
  // at the Chrome runtime level — no esbuild overrides needed.
});

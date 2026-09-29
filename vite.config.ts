import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // The browser only ever imports the load-summary half of the engine.
      '@engine': fileURLToPath(new URL('./supabase/functions/_shared/engine/client.ts', import.meta.url)),
    },
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three') || id.includes('@react-three')) return 'three';
          if (id.includes('node_modules/@supabase')) return 'supabase';
          if (id.includes('react-markdown') || id.includes('micromark') || id.includes('mdast') || id.includes('unified')) return 'markdown';
        },
      },
    },
  },
});

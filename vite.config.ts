import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  server: { port: 5178, strictPort: true },
  preview: { port: 5178, strictPort: true },
  build: { rollupOptions: { output: { manualChunks(id) {
    if (id.endsWith('/data/book.json')) return 'book';
    if (id.includes('pinyin-pro')) return 'pinyin';
  } } } },
});

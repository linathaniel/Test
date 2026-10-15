import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.GAME_BASE_PATH || '/annivgame/',
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
  build: {
    target: 'es2022',
    rollupOptions: {
      output: { manualChunks: { phaser: ['phaser'] } },
    },
  },
});

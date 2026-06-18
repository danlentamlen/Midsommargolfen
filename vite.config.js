import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: '/',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main:             './index.html',
        score:            './score.html',
        bettingoversikt:  './betting-oversikt.html',
      },
    },
  },
  publicDir: 'public',
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `base: './'` : le build fonctionne chez n'importe quel hébergeur statique,
// y compris dans un sous-dossier (GitHub Pages, Netlify, serveur perso…).
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    sourcemap: true,
    chunkSizeWarningLimit: 900,
  },
  server: {
    port: 5173,
  },
  preview: {
    port: 4173,
  },
});

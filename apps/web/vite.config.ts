import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Fragrance Chemistry Lab',
        short_name: 'FC Lab',
        description: 'Olfactory formulation, encyclopedia, and supply chain',
        theme_color: '#0b1418',
        background_color: '#0b1418',
        display: 'standalone',
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@fc/scale-bridge': path.resolve(__dirname, '../../packages/scale-bridge/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});

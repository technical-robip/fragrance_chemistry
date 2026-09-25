import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const LOCALES = ['en', 'fr', 'it', 'es', 'de', 'ro'] as const;

/**
 * The landing page is the only crawlable route, and its absolute origin is only
 * known at deploy time, so `sitemap.xml` and the `Sitemap:` line in
 * `robots.txt` are emitted from `VITE_SITE_URL` during the build.
 */
function seoFiles(): Plugin {
  return {
    name: 'fc-seo-files',
    apply: 'build',
    generateBundle() {
      const site = (process.env.VITE_SITE_URL ?? 'http://localhost:5173').replace(/\/$/, '');
      const alternates = LOCALES.map(
        (locale) =>
          `    <xhtml:link rel="alternate" hreflang="${locale}" href="${site}/?lng=${locale}" />`,
      ).join('\n');

      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>${site}/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
${alternates}
    <xhtml:link rel="alternate" hreflang="x-default" href="${site}/" />
  </url>
</urlset>
`,
      });
    },
    async writeBundle(options) {
      const site = (process.env.VITE_SITE_URL ?? 'http://localhost:5173').replace(/\/$/, '');
      const { readFile, writeFile } = await import('node:fs/promises');
      const robots = path.join(options.dir ?? 'dist', 'robots.txt');
      try {
        const source = await readFile(robots, 'utf8');
        await writeFile(
          robots,
          source.replace('Sitemap: /sitemap.xml', `Sitemap: ${site}/sitemap.xml`),
        );
      } catch {
        /* robots.txt is optional; a missing file must not fail the build */
      }
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    seoFiles(),
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
      '@fc/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
      '@fc/scale-bridge': path.resolve(__dirname, '../../packages/scale-bridge/src/index.ts'),
      // The package's published entry is CommonJS, so Vite cannot read named
      // exports from it. Resolving to source keeps the browser and the API on
      // the same engine code without depending on a rebuilt dist.
      '@fc/formula-engine': path.resolve(__dirname, '../../packages/formula-engine/src/index.ts'),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
  optimizeDeps: {
    exclude: ['@fc/shared', '@fc/scale-bridge', '@fc/formula-engine'],
  },
});

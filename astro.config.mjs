// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
// NOTE (P03 rebuild, publish deferred): output stays `static` for now.
// When publish wiring is added (see 04-architecture/publish-todo.md), install
// @astrojs/cloudflare and set `adapter: cloudflare()` if SSR Functions (D1 lead
// store / Resend contact form) are needed. Pure-static Cloudflare Pages needs
// no adapter; a `functions/` dir handles the contact form server-side.
export default defineConfig({
  // Canonical/sitemap base. Update to the production custom domain at P06 cutover.
  site: 'https://www.menonmedispa.com',
  output: 'static',
  integrations: [
    sitemap({
      // Keep noindex / redirect-stub routes out of the sitemap so we never submit
      // URLs we tell Google not to index. Mirrors the noindex={true} pages in src/pages.
      filter: (page) => {
        const NOINDEX = [
          '/book-online',
          '/coming-soon',
          '/thank-you',
          '/hydrafacial-appointment-request-thanks',
          '/keravive-hydrafacial-appointment-request-thanks',
        ];
        return !NOINDEX.some((p) => page.replace(/\/$/, '').endsWith(p));
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});

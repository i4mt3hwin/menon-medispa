# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

The Menon Medispa website (Millburn, NJ medical spa): a **static Astro site** deployed to
**Cloudflare Pages**, with a few server-side **Pages Functions** for lead capture and email. This
directory (`05-build/`) is its own git repo and is the live codebase — edit here directly. The
sibling phase folders (`01-discovery/` … `06-content/`, `_img-backup/`) are capture/research
artifacts, not application code.

The site is HIPAA-adjacent: the lead store is deliberately **NON-PHI** (see `db/schema.sql`). Do not
add columns or capture fields for medical history, conditions, treatments, or photos.

## Ad landing pages — `landing/` (get.menonmedispa.com)

`landing/` is a **second, self-contained Astro app** in this repo for Google/Meta ad traffic. It is a
separate build and a separate Cloudflare Pages project (`menon-medispa-lp` → **get.menonmedispa.com**);
it does NOT share this app's build, layout, or routes. It was merged in from a standalone folder
(`D:\Claude\Website Builder\Menon Botox 189`) so everything Menon lives under one repo.

> **Building or editing a lead/landing page? Read [`landing/CLAUDE.md`](landing/CLAUDE.md) first** — it
> is the full guide to the lead pipeline + the Google Ads (gclid) attribution rules every page must
> follow, plus the test protocol.

- **Pages** (`landing/src/pages/`): `botox` ($189 new-client special — a standalone page, NOT using the
  shared layout), `laser-hair-removal` (Brazilian + free underarms, has a lead form), `treatments`
  (general inquiry, has a lead form), and `acne-facial` / `chemical-peel-facial` / `dermaplaning-facial`
  / `hydrafacial` (booking-CTA pages, currently unused by ads but kept consistent).
- **Header-free + `noindex`** by design (distraction-free paid traffic). The shared layout
  (`landing/src/layouts/LandingPage.astro`) is a logo-only top bar + sticky mobile CTA + minimal footer.
- **Leads flow into the SAME pipeline as the main site.** Both lead forms POST cross-origin to
  `https://www.menonmedispa.com/api/lead` (CORS-allowlisted in `functions/api/lead.js`) →
  D1 + Resend front-desk alert + welcome email + WhatConverts (server-side, gclid-accurate) + lead
  manager. The shared form handler + first-touch UTM capture live in `LandingPage.astro` (mirrors
  `src/lib/leadForm.ts`). Forms send `type: 'appointment_request'`, a `service_interest`, a
  `consent_email` checkbox, and the `company_website` honeypot. `botox` and the facial pages have no
  form — their "Book" CTA deep-links to `www.menonmedispa.com/request-appointment?service=<name>`.
- **Google Ads attribution (gclid) — every lead page MUST carry it.** First-touch UTMs (`menonUtm`) +
  click ids `gclid`/`gbraid`/`wbraid` (`menonClickIds`) are captured on landing and folded into the POST
  body; deep-link "Book" CTAs get the gclid appended to their URL by `rewriteBookingLinks()`. These
  travel in the body/URL **not cookies** (the pages are cross-origin to www). A STANDALONE page (e.g.
  `botox`) must replicate the capture + body-send + rewriter or it silently drops the gclid — this is
  the trap that hit botox. Server side, `functions/api/lead.js` labels click-id leads `google`/`cpc` for
  WhatConverts (the gclid field alone does NOT set the WC source) and stores the gclid in D1.
- **Ad tracking stays on these pages** (GTM `GTM-MSMM2PHT`, Meta Pixel, GA4, WhatConverts script). The
  forms keep firing `lead_submit` / `form_submit` / Meta `CompleteRegistration` / GA4 `generate_lead`.
  NOTE: WhatConverts now comes from the server; if a GTM tag also creates a WhatConverts lead from
  `form_submit`, disable it to avoid duplicate WC leads.
- **Build + deploy** (separate from the main site):
  ```sh
  cd landing && npm run build && npx wrangler pages deploy dist --project-name=menon-medispa-lp
  ```
  `landing/_content/` holds the source copy/research/reviews (reference, not built).

## Commands

```sh
npm run dev          # dev server at localhost:4321
npm run build        # production build -> ./dist/
npm run preview      # serve the built dist locally
npm run astro -- check   # typecheck (.astro/.ts) — there is NO separate lint or unit-test runner
```

**Deploy** (not in package.json — run manually after a build):
```sh
npx wrangler pages deploy dist --project-name=menon-medispa --branch=main
```
- `--branch=main` is the **production** branch and the only one that serves the canonical domain.
  Any other branch deploys a Preview URL that will NOT update the live site.
- Build and deploy atomically (deploy the dist you just built), then verify the live URL — a stale
  `dist/` is the usual cause of "my change didn't show up." Staging is `menon-medispa.pages.dev`.

**Screenshot QA** (Playwright is a devDependency; used for visual QA, not assertions):
```sh
node _shot-qa.mjs <route...>   # forces reducedMotion — REQUIRED, or full-page shots are blank below
                               # the fold (scroll-reveal hides sections until scrolled). Honors QA_PORT.
node _shot-hero.mjs            # hero particles/entrance — run WITHOUT reducedMotion, wait ~2s
```

Other one-off scripts: `node _optimize-images.mjs` (in-place image downscale/recompress),
`scripts/seo-*.mjs` (SEO audit/meta/webp passes), `scripts/verify-fidelity.mjs` (proves recovered
blog bodies are verbatim vs the original capture). The root `diagnose-*.js` / `fix-*.js` /
`_zoomgap*.png` files are stale debug artifacts — ignore/prune, don't build on them.

## Architecture

**Rendering.** Astro 6, `output: 'static'`, Tailwind 4 (via the vite plugin, not an Astro
integration), `@astrojs/sitemap`, `trailingSlash: 'always'`, `site: 'https://www.menonmedispa.com'`
(see `astro.config.mjs`). There is no SSR adapter — dynamic behavior lives in Pages Functions.

**Server-side = Cloudflare Pages Functions** in `functions/` (separate from Astro):
- `functions/api/lead.js` — the single intake for every form (booking, contact, newsletter). Writes
  to D1 `menon-medispa-leads` (wrangler.toml binds it as `DB`; schema in `db/schema.sql` =
  `leads` + `consent_log`), sends customer + front-desk emails via Resend, manages the Resend
  audience, and best-effort **forwards each lead to the Regtek Content Engine lead manager**
  (`maybeForwardLead`, a no-op unless the `LEADS_*` env vars are set). Resend/D1 are configured via
  Cloudflare env vars/secrets, bound only on a NEW deploy.
- `functions/api/recent-activity.js` — de-identified recent bookings feed for the social-proof toast.
- `functions/api/unsubscribe.js` — CAN-SPAM unsubscribe (PATCHes the Resend contact).

**Design system.** `src/layouts/BaseLayout.astro` is the only layout; it loads
`src/styles/tokens.css` → `base.css` (+ `fonts.css`, `glow.css`) and owns all `<head>` meta,
canonical URL, and JSON-LD. `base.css` is the system (`.container`, `.section`, the `.btn` scale,
`media-overlay`, IntersectionObserver `scroll-reveal`). **Make global visual changes in
`base.css`/`tokens.css`, not per-component.** Brand: mauve, Playfair + Raleway, gold accents.

**Single sources of truth** (change data here, not in pages):
- `src/lib/site.ts` — all business constants (NAP, hours, social, analytics ids). Consumed by
  BaseLayout meta/JSON-LD, footer, contact, schema. When hours/phone change, grep here AND for any
  hardcoded copies (a few `Saturday`/`2pm` strings still live in components).
- `src/data/*.json` paired with a `src/lib/*.ts` loader: `services`, `sales` (ALL sale content + the
  Book-Now deep-links), `service-packages` (multi-package booking + the in-form area picker),
  `reviews` (provider-safe testimonials → `ServiceTestimonial`), `blog*`, `glow-*` (Find Your Glow
  quiz), `service-addons`, `service-blog-map`.

**Booking is self-hosted** (no Cal.com). `/request-appointment` (`components/BookingRequest.astro`,
a Date→Time→Details wizard) posts to `/api/lead`. CTAs are context-aware via `src/lib/bookingRoutes.ts`
(BaseLayout rewrites booking links at runtime): a specific treatment carries `?service=` and locks
it; broad/category pages route to `/consultation`. Consult tier (medical Dr. Menon vs esthetician)
is decided by `src/lib/consult.ts`. `src/lib/leadForm.ts` (`enhanceLeadForm`) intercepts the native
form POST, sends JSON, and redirects — a bare `<LeadForm>` needs this script to work.

**Service pages** compose a reusable kit: `ServiceHero` (cinematic, gold particles) + `ServiceLayout`
(2-col, sticky `<aside>`) + `BookingCard`/`QuickFacts`/`FaqColumn`/`AddOnList`/`RelatedPosts` +
`MobileCtaBar`. Schema helpers (`serviceSchema.ts`, `articleSchema.ts`, `businessSchema.ts`) feed
BaseLayout's `jsonld`. See `src/components/LIBRARY.md` for the component catalog.

**Routing/SEO.** `src/pages/` (~60 routes). Legacy Wix routes were deleted and 301'd in
`public/_redirects`. The sitemap integration filters out noindex routes — **keep the NOINDEX list in
`astro.config.mjs` in sync** with the `noindex` pages in `src/pages`.

## Project conventions and non-obvious gotchas

- **Client-facing voice:** no em dashes, no emojis, mobile-first, no unsubstantiated SEO/medical claims.
- **Content rule:** on a page being redesigned you may reword/trim/drop copy freely; the one hard
  line is **never fabricate** a fact, price, or service the spa doesn't actually offer (ground every
  claim in existing site copy / `01-discovery` capture).
- **Gold text on light must use `--color-accent-ink` (#94632E)** for AA contrast. The base gold
  tokens (#C4A484 etc.) are ~1.9:1 on white — use them for fills/borders/glyphs/on-dark only; never
  darken the base tokens globally.
- **Never put `\s*` near CSS in a bulk find-replace** — it eats newlines and merges selector lists
  (`, .` → `.`). The content guardrails won't catch CSS damage; QA visually with motion ON.
- **Astro scoped `<style>` does not match runtime-built DOM** (elements created via
  `createElement`/`innerHTML` lack the `data-astro-cid`). Stamp the cid or use `:global`.
- **Mobile horizontal-scroll** debugging: the header auto-hides on scroll-down (not a broken sticky);
  Chromium masks overflow (tell = `innerWidth > viewport`); usual fixes are `min-width:0` on
  fieldsets and `repeat(N, minmax(0, 1fr))` grids.
- A `lib/social-proof.ts` seed exists but the live toast reads real data from
  `/api/recent-activity`; don't reintroduce seeded social proof as if it were live.

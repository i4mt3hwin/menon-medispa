# Component Library — Menon Medispa

Scaffolded by `path-2-rebuild/02-synthesize`. All components are token-driven (see `../styles/global.css` @theme + `03-design/design-tokens.md`). Phase 3 subagents complete the stubs with VERBATIM captured content and append new rows here when they scaffold a component.

| Component | Status | Role |
|-----------|--------|------|
| `SiteHeader.astro` | **built** | global header: logo + nav + Call-Now CTA (verbatim) |
| `SiteFooter.astro` | **built** | global footer: newsletter + link columns + NAP/hours/social/copyright (verbatim) |
| `Button.astro` | **built** | atomic CTA/link (primary/secondary/ghost/link/call) |
| `Picture.astro` | **built** | atomic image (shadow/rounded options) |
| `RichText.astro` | **built** | renders captured inline-HTML body |
| `Quote.astro` | **built** | single testimonial/pull quote |
| `HeroSection.astro` | stub | top hero band |
| `SectionHeading.astro` | stub | short heading band |
| `ServicesGrid.astro` | stub | grid of ServiceCard |
| `ServiceCard.astro` | stub | service/treatment card |
| `ContentSection.astro` | stub | text + image strip |
| `FeatureList.astro` | stub | icon-list / benefits |
| `TestimonialStrip.astro` | stub | testimonials grid |
| `CtaBanner.astro` | stub | full-width CTA band |
| `Gallery.astro` | stub | image gallery grid |
| `PriceTable.astro` | stub | membership/service pricing |
| `FaqAccordion.astro` | stub | collapsible Q&A |
| `ContactBlock.astro` | stub | NAP + (deferred) lead form |
| `ServicePageTemplate.astro` | **built** | Wix service-page/{slug} (81 services, data-driven; 3 with verbatim captured description, rest from Bookings name/cat/price/duration/tagLine) |
| `BookingCalendarTemplate.astro` | stub (unused) | superseded by `SchedulerEmbed.astro` (Cal.com) on booking-calendar/[slug].astro |
| `BlogList.astro` | stub (unused) | /blog index is the verbatim captured Wix blog feed (141 widgets) — kept as-is |
| `BlogPostTemplate.astro` | **built** | post/{slug} (28 posts; 2 with verbatim captured body, 26 with captured excerpt+cover) |
| `ConfirmationSection.astro` | stub | thank-you pages rendered verbatim by the page generator |
| `LeadForm.astro` | **built** | contact + appointment lead capture → /api/lead (D1, non-PHI, consent-logged) |
| `SchedulerEmbed.astro` | **built** | Cal.com external embed (placeholder until operator URLs); on booking-calendar + request-appointment |
| `ChatAssistant.astro` | **built** | decision-tree chat (replaces Wix Chat); buttons-only, no AI/free-text/PHI; global end-of-body |
| `ThirdPartyScripts.astro` | **built** | analytics carry-over (GA4/Meta Pixel/Google Ads/Clarity/WhatConverts); global end-of-body |

**Build-phase additions (03-build-replicate):**
- `src/data/services.json`, `src/data/blog.json`, `src/data/blog-bodies.json` — collection data (verbatim captured).
- `src/lib/chat-tree.ts` — decision-tree content (from SITE/NAV + verbatim home FAQ).
- `functions/api/lead.js` + `db/schema.sql` — Cloudflare Pages Function + D1 (applied local + remote).
- `scripts/validate-chat-tree.mjs` — chat-tree structural validator.
- Generators (in `{client}/scripts/`): `gen-pages.mjs` (per-page verbatim translator), `gen-templates.mjs` (collection data).

**Assets:** logo + social icons staged to `public/images/` with semantic names; ALL 205 captured images staged to `public/images/{hash}.{ext}` (page generator + templates reference by hash/resolved-local-path). Path-2: only captured imagery, none substituted.

**Scaffold stubs left unused (not deleted — available for future polish):** HeroSection, SectionHeading, ServicesGrid, ServiceCard, ContentSection, FeatureList, TestimonialStrip, CtaBanner, Gallery, PriceTable, FaqAccordion, ContactBlock, BookingCalendarTemplate, BlogList, ConfirmationSection, Picture, RichText, Quote. The page generator emits semantic markup directly (with the design-token `.pg-*` component layer in global.css) rather than routing every widget through a pattern component — this preserved 100% widget-level verbatim fidelity without a summarization layer.

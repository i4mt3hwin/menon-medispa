# Component Library, Menon Medispa

Generated: phase-2-synthesize (2026-06-13). Phase 3 completes all stubs.

All components consume CSS custom properties from `styles/tokens.css`.
Import path from pages: `../components/<Name>.astro`.

---

## Layout / Shell

| Component | File | Role | Status |
|-----------|------|------|--------|
| SiteHeader | `SiteHeader.astro` | Master nav (8 top-level, dropdowns) | Stub |
| SiteFooter | `SiteFooter.astro` | NAP + social + copyright | Stub |

## Section-level

| Component | File | Wix widget source | Status |
|-----------|------|-------------------|--------|
| HeroSection | `HeroSection.astro` | Section 1 (video/image bg, H1, CTAs) | Stub |
| ContentSection | `ContentSection.astro` | text-editor + image pairs | Stub |
| SectionHeading | `SectionHeading.astro` | Heading band / divider | Stub |
| ServicesGrid | `ServicesGrid.astro` | Grid of service cards | Stub |
| FeatureList | `FeatureList.astro` | icon-list widget (201 uses) | Stub |
| TestimonialStrip | `TestimonialStrip.astro` | blockquote/review rows | Stub |
| CtaBanner | `CtaBanner.astro` | Full-width CTA band | Stub |
| Gallery | `Gallery.astro` | Multi-image groups | Stub |
| PriceTable | `PriceTable.astro` | Membership / pricing tiers | Stub |
| FaqAccordion | `FaqAccordion.astro` | Q&A blocks (`<details>`) | Stub |
| ContactBlock | `ContactBlock.astro` | NAP + map embed | Stub |

## Atomic / Utility

| Component | File | Notes | Status |
|-----------|------|-------|--------|
| ServiceCard | `ServiceCard.astro` | Used inside ServicesGrid | Stub |
| Quote | `Quote.astro` | Single blockquote (atomic) | Stub |
| Button | `Button.astro` | CTA button (primary/secondary/ghost) | Stub |
| Picture | `Picture.astro` | Responsive `<img>` wrapper | Stub |
| RichText | `RichText.astro` | Inline HTML body copy | Stub |
| Divider | `Divider.astro` | `<hr>` separator (Wix divider widget, 144 uses) | Stub |

## Operator-decision Components

| Component | File | Replaces | Notes | Status |
|-----------|------|----------|-------|--------|
| SchedulerEmbed | `SchedulerEmbed.astro` | Wix Bookings | Self-hosted BookingRequest form (Cal.com dropped); reads `site.calcomUrl` | Live |
| LeadForm | `LeadForm.astro` | Wix Forms | POST /api/lead → D1/Resend (Phase 3) | Stub |
| ChatAssistant | `ChatAssistant.astro` | Wix Chat | HIPAA-safe decision-tree; uses chat-tree.ts | Stub |
| ThirdPartyScripts | `ThirdPartyScripts.astro` | Wix tracking embed | Meta Pixel, Google Ads, Clarity, WhatConverts, Cal.com loader | Stub |

## Page Templates

| Component | File | Used for | Status |
|-----------|------|----------|--------|
| BlogList | `BlogList.astro` | /blog index | Stub |
| BlogPostTemplate | `BlogPostTemplate.astro` | /blog/[slug] | Stub |
| ConfirmationSection | `ConfirmationSection.astro` | /thank-you | Stub |

---

## Flagged: Breakdance pages (Phase 3 manual build)

- `/microneedling-millburn-nj`, builder=breakdance; no structure.json widget walk; hand-author
- `/myers-cocktail-iv-therapy`, builder=breakdance; no structure.json widget walk; hand-author

---

## Images, promoted (Phase 3, home sections 6–10)

| Semantic path | Source key | Alt | Section |
|---|---|---|---|
| `assets/services/botox-injectables-card.webp` | 1f114dd47995 | BOTOX® Injectables at Menon Medispa | 6 |
| `assets/services/juvederm-fillers-card.webp` | 8ec275b96db1 | Injection cosmetology | 6 |
| `assets/services/hydrafacial-keravive-card.webp` | 02127013d183 | The Benefits of Hair Restoration Therapy | 6 |
| `assets/testimonials/what-our-clients-say-bg.webp` | 30cfb9e87c60 | Untitled-4.png | 7 |
| `assets/testimonials/reviewer-avatar-1.webp` | 90411e0041df | Picture of a Client Who Reviewed Us | 7 |
| `assets/testimonials/reviewer-avatar-2.webp` | 305afeda5f9a | Picture of a Client Who Reviewed Us | 7 |
| `assets/testimonials/reviewer-avatar-3.webp` | b95880091b44 | Picture of a Client Who Reviewed Us | 7 |
| `assets/services/face-treatments.webp` | 0a8150a5612c | Face Treatments Menon Medispa | 8 |
| `assets/services/natural-beauty-body.webp` | 2fc4656f8ac4 | Natural Beauty | 8 |
| `assets/services/model-curly-hair.webp` | e6d509254f0c | Model with Curly Hair | 8 |
| `assets/home/your-skin-comes-first-bg.webp` | 8f23c1351be4 | pexels-angela-roma-7479966_edited.jpg | 9 |
| `assets/home/exceptional-experience-video-poster.webp` | 2ef11e239ab9 | (video poster, no alt) | 10 |
| `assets/contact/office-staff.webp` | 35c774fbba6d | Menon Office Staff (1).png | contact/2 |
| `assets/social/icon-facebook.webp` | 464c5b23f583 | Facebook | contact/2 |
| `assets/social/icon-instagram.webp` | a29df34857a1 | Instagram | contact/2 |
| `assets/social/icon-tiktok.webp` | d11778476dcb | TikTok | contact/2 |
| `assets/images/f2a8f8988125.jpg` | f2a8f8988125 | (video poster fallback, no alt) | home/1 |
| `assets/images/90411e0041df.png` | 90411e0041df | Picture of a Client Who Reviewed Us | home/1 |
| `assets/images/305afeda5f9a.png` | 305afeda5f9a | Picture of a Client Who Reviewed Us | home/1 |
| `assets/images/b95880091b44.png` | b95880091b44 | Picture of a Client Who Reviewed Us | home/1 |
| `assets/images/abe70978be24.jpg` | abe70978be24 | Vogue Logo - Link to Related Article | home/3 |
| `assets/images/a907a2a5b193.jpg` | a907a2a5b193 | Cosmopolitan Logo - Link to Related Article | home/3 |
| `assets/images/c1cefa7e9c95.jpg` | c1cefa7e9c95 | Bazaar Logo - Link to Related Article | home/3 |
| `assets/images/349d72d3c082.webp` | 349d72d3c082 | Fortune Logo - Link To Related Article | home/3 |
| `assets/images/86072f9cbd9c.jpg` | 86072f9cbd9c | Hydrafacial.jpg | home/5 |
| `assets/images/dd355e57f3dd.jpg` | dd355e57f3dd | shutterstock_2578361641.jpg | home/5 |
| `assets/images/56a3e3ac1335.jpg` | 56a3e3ac1335 | shutterstock_2193199469.jpg | home/5 |

---

## Token quick-ref

All tokens defined in `styles/tokens.css`. Key values:

```
--color-cta: #C4A484
--font-display: "playfair display","playfairdisplay-bold",serif
--font-body: raleway-v2,sans-serif
--font-ui: "lato-light",lato,sans-serif
--radius-sm: 5px   --radius-md: 8px
Breakpoint: 980px
```

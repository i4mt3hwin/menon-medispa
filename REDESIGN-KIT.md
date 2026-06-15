# Menon Medispa — Redesign Kit (Phase C site-wide re-skin)

You are re-skinning ONE route of the Menon Medispa Astro site into the new design system.
The homepage (`src/pages/index.astro`) and the Botox service page (`src/pages/_sections/botox-millburn-nj__section_*.astro`)
are ALREADY redesigned. They are your canonical references. Make your route look like they do.

Project root for the Astro app: `d:\Claude\Website Builder\Menon Medispa\menon-medispa\05-build`
(paths below are relative to it). Use the `@/` alias = `src/`.

---

## THE ONE HARD RULE — CONTENT IS FROZEN

You are changing **structure and CSS only**. You may NOT change what the page says or shows.

- Every piece of human-visible **text** must survive verbatim — same words, same order, same
  punctuation, same `&#...;` HTML entities. Do not reword, summarize, expand, shorten, fix typos,
  add headings, or add marketing copy. If the source says "Stimulates Collagen Production", the
  output says exactly "Stimulates Collagen Production".
- Every **image** must survive — same `import` (same hashed filename under `@/assets/...`), same
  `alt` text. Do not add, remove, swap, or invent images. Do not change a real photo to a placeholder.
- Every **link** must survive — same `href` targets (internal links, `site.calcomUrl`, tel/mailto),
  same number of buttons/CTAs. If the source hero has ONE button, the output hero has ONE button.
  Do NOT copy Botox's second "See Before & Afters" button onto a page that didn't have it.
- Keep `loading`, `decoding`, `width`, `height` attributes on images (perf + CLS).

The build is verified by a deterministic content guardrail that diffs visible text + image basenames
per route against a frozen baseline. **The expected result for your route is ZERO drift.** Any added
or lost word/image is a bug that will bounce back to you.

### Self-verify before you finish (do this every time)
1. Before editing, list in your head every visible text string and every image import in the route's files.
2. After editing, confirm each one is still present, unchanged.
3. Confirm button/link count and `href`s are identical.
4. Report the counts in your structured result.

---

## What you may and may NOT touch

- ✅ Edit the route file (`src/pages/<route>.astro`) and its section partials
  (`src/pages/_sections/<route>__section_*.astro`).
- ❌ Do NOT edit `src/styles/base.css`, `src/styles/tokens.css`, `src/styles/fonts.css`,
  `src/layouts/BaseLayout.astro`, or anything in `src/components/`. Those are shared and already done.
  If you think a global change is needed, note it in your result instead — do not make it.
- ❌ Do NOT touch the homepage or any `botox-millburn-nj__*` file.

---

## The design system (already in `src/styles/base.css` — just USE these classes)

**Layout**
- `.container` (max 1200px, auto-centered, gutter) — wrap section content in one. `.container--narrow`
  (760px, for prose/long copy), `.container--wide` (1320px, galleries).
- `.section` — vertical rhythm (padding-block `--section-py`, responsive). `.section--tight` = ~62% padding.
- Background tints: `.section--tint` (warm sand wash), `.section--mauve` (brand mauve, white text),
  `.section--dark` (deep surface, white text).
- `.eyebrow` — uppercase kicker/label above a heading.
- `.stack > * + *` — simple vertical spacing helper.

**Buttons** (replace every bespoke `.xx__btn`):
- `.btn .btn--primary` (sand fill), `.btn .btn--secondary` (outline), `.btn--ghost` (text link).
- Sizes `.btn--sm` / `.btn--lg`. On a dark/photo background add `.btn--on-dark` to a secondary button so
  its border/text go light. `.btn--block` for full-width.

**Media background + overlay** (use for any section that puts text over a photo — heroes, banners):
```astro
<section class="media-bg section s1-hero" style="--scrim-strength:0.60">
  <img class="media-bg__img media-bg__img--blur" src={heroBg.src} alt="" aria-hidden="true"
       loading="eager" decoding="async" width="1440" height="596" />
  <span class="media-bg__scrim media-bg__scrim--l"></span>   <!-- or --b (bottom) or --brand (mauve) -->
  <div class="media-bg__inner container on-media">
    ...content...
  </div>
</section>
```
- `media-bg__scrim--l` = left-weighted (text on left), `--b` = bottom-weighted, `--brand` = mauve wash
  (good for testimonials). Tune darkness with inline `--scrim-strength` (0.5–0.65).
- `.on-media` forces all child text white with a soft shadow. NOTE: it makes EVERYTHING inside white —
  do not put a light/cream card with dark text inside `.on-media`. If a section has a white card on a
  photo (e.g. a review card), keep the card OUTSIDE `.on-media` and color its text explicitly.

**Type** — headings that should be the elegant serif use `font-family: var(--font-display)` (Playfair).
The captured pages often set display headings to `var(--font-body)` — switch the page's main H1/H2
display headings to `var(--font-display)` like Botox does. Body copy stays `var(--font-body)`.
Responsive type sizes (`--text-hero`, `--text-h1`, `--text-h2`, `--text-h3`, `--text-base`, …) already
shrink at 1024px/600px — use the tokens, never hard-code px font sizes for display text.

**Scroll reveal** is automatic: every top-level `<section>` (that is a direct child of `<body>`, i.e. any
section rendered by your route) fades/rises in on scroll. You get it for free — just emit real
`<section>` elements. Do not add reveal JS. (The hero is intentionally excluded via `.hero`; service
heroes use `.s1-hero`/`media-bg` and DO reveal, which is fine.)

---

## The transformation recipe (captured → design system)

The OLD captured pattern (what you're replacing) looks like this:
```
.mn-s1 { position: relative; width:100%; min-height: 546px; overflow:hidden; }
.mn-s1__bg-wrap { position:absolute; inset:0; }      // raw bg image, NO scrim → text hard to read
.mn-s1__content { max-width:1200px; margin:0 auto; padding: var(--space-xl) var(--space-lg); }
.mn-s1__heading { font-family: var(--font-body); ... }   // body font on a display heading
.mn-s1__btn { ...hand-rolled button... }
@media (max-width: 980px) { ... }                    // odd breakpoint
```
Convert it to the design-system pattern (what Botox does):
```
<section class="media-bg section s1-hero" style="--scrim-strength:0.60">  // real overlay
  <img class="media-bg__img media-bg__img--blur" ... />
  <span class="media-bg__scrim media-bg__scrim--l"></span>
  <div class="media-bg__inner container on-media"> ... </div>
.s1-hero__heading { font-family: var(--font-display); font-size: var(--text-hero); }  // serif display
<a class="btn btn--primary btn--lg"> ... </a>        // design-system button
@media (max-width:1024px){...} @media (max-width:768px){...}   // normalized breakpoints
```

### Step-by-step for each section
1. Replace the bespoke outer wrapper with `.section` (+ a tint modifier when the source had a colored
   background: light grey/surface → `.section--tint`; dark → `.section--dark`; mauve → `.section--mauve`).
   Heroes / photo-text overlays → `.media-bg section`.
2. Wrap inner content in `.container` (or `.container--narrow` for long single-column prose like legal/about copy).
3. Delete fixed `min-height: NNNpx` on heroes — let content + section padding set the height (keep a
   sensible `min-height` only if needed for a photo hero; Botox uses `min-height` on `.s1-hero` but the
   inner is padded by `.section`). Prefer letting `.section` padding do the work.
4. Swap hand-rolled buttons for `.btn .btn--primary|--secondary` (`.btn--on-dark` on photos/dark).
5. Switch the page's main display headings to `var(--font-display)`; keep body text on `var(--font-body)`.
6. Normalize breakpoints to 1024 / 768 / 600. Ensure two-column layouts stack on mobile and there is
   NO horizontal overflow at 390px.
7. Keep a small scoped `<style>` for section-specific layout (the two-column flex, image column width,
   card grid, etc.) — you don't have to delete all scoped CSS, just rebuild it cleanly on top of the
   tokens and design-system classes. Reuse Botox's class names/structure where the section matches an
   archetype; it keeps the whole site consistent.
8. Keep all `import` statements for images. If a section imported `Button`/`RichText`/etc. but you no
   longer use the component, remove the now-unused import to keep the build clean — but never remove an
   image import whose image still renders.

---

## Section archetypes → copy from these Botox files

Open the matching Botox file and mirror its structure/classes, swapping in your route's frozen content:

| Archetype | Botox reference file | Key classes |
|---|---|---|
| Photo hero (headline + sub + body + CTA(s) + review proof + side photo) | `_sections/botox-millburn-nj__section_1.astro` | `media-bg section s1-hero`, `media-bg__scrim--l`, `on-media`, `.btn` |
| Trust bar (3 short proof items) | `_sections/botox-millburn-nj__section_2.astro` | `section section--tight section--tint`, `.container` |
| Two-column content (heading + eyebrow labels + icon list + body + side image) | `_sections/botox-millburn-nj__section_3.astro` | `section`, `.container`, `.eyebrow`, flex two-col |
| Testimonial / quote band over photo | `_sections/botox-millburn-nj__section_4.astro` | `media-bg section`, `media-bg__scrim--brand`, `container`, centered |
| Dark closing CTA (heading + body + button + photo) | `_sections/botox-millburn-nj__section_9.astro` | `section section--dark`, `.container`, two-col, `.btn--primary` |
| Card grid (promos / services / pricing tiers) | `_sections/botox-millburn-nj__section_11.astro` | `section section--tint`, `.container`, 3-col grid → 2 → 1 |

The homepage (`src/pages/index.astro`) is the reference for: category tiles, popular-treatment grid,
FAQ accordion, blog/post cards, newsletter, and the editorial image+text "intro band" (eyebrow → serif
H2 → paragraphs → CTA, photo on the other side). Mirror those when a page has similar content.

---

## Per-family guidance

- **service** (acne-facial, microneedling, hydrafacial, the IV pages, semaglutide, fillers, etc.):
  these share Botox's exact section skeleton (hero, trust, problem/solution, testimonial, difference,
  gallery/pricing, FAQ, CTA, promos). Re-skin section-by-section against the matching Botox file. This
  is the bulk of the work and the most mechanical — high consistency expected.
- **pillar** (face, body, hair): category landing pages. Hero (media-bg) + intro + a grid of
  sub-treatment cards (mirror the homepage category/treatment grids) + CTA. Keep every linked card.
- **about / meet-the-team**: editorial. `about.astro` is INLINE (sections written in the route file,
  with old `.about-section-N__*` BEM + inline `style="font-family:..."`). Re-skin in place: convert to
  `.section`/`.container--narrow`, move inline `style=` font rules into the scoped `<style>`, switch
  display headings to `var(--font-display)`. Keep the video, the staff photo, the quote, the Google
  rating image. `meet-the-team` uses partials.
- **contact-booking** (contact, consultation, book-online, online-booking, memberships, gift-card):
  contact is INLINE. Keep the form fields/labels EXACTLY (name/email/message inputs, submit text).
  Lay the form out in a clean `.section` + `.container` two-column (form + NAP/info). Booking/embeds:
  keep the scheduler embed/iframe and its config untouched.
- **legal** (terms-of-use, store-policy, shipping-and-returns, patient-resources, job-opportunities):
  long prose. Wrap each section in `.section` + `.container--narrow`, readable measure, clear `h2/h3`
  hierarchy with `var(--font-display)` headings. Don't drop a single clause.
- **promo** (sale, coming-soon) and **thank-you** (*-appointment-request-thanks): small pages. sale =
  card grid of specials (mirror Botox §11). coming-soon / thank-you are minimal — give them a clean
  centered `.section` treatment; if a page is already trivial/native, make minimal changes and say so.

If a route already uses the design system (`.container`/`.section`/`media-bg` like Botox), make only
minimal cleanups and report "already largely native" — do not churn it and risk content drift.

---

## Output / done criteria for your route
- All of the route's sections use `.section`/`.container`/`.btn`/`media-bg` design-system classes.
- Main display headings use `var(--font-display)`; buttons use `.btn`.
- Responsive at 1024/768/390 with no horizontal overflow; two-columns stack on mobile.
- 100% of original text, images (alt + import), links, and button count preserved.
- No edits outside the route's own files. No edits to base.css / components / layout.

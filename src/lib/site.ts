/**
 * site.ts — single source of truth for business constants (NAP, hours, social).
 *
 * Seeded in P03 from 02-research/business-metadata.md (which itself is drawn
 * ONLY from captured artifacts: Tier-A wix-api/business-info.json + the
 * original site's on-page JSON-LD). Nothing here is invented.
 *
 * Consumed by BaseLayout.astro (meta + JSON-LD), Footer, Contact, schema, etc.
 *
 * ⚠️ UNRESOLVED CONFLICTS FROM P02 — flagged, NOT silently resolved. See the
 * `phone` and `geo` fields below. The operator must confirm the canonical phone
 * line and geo before go-live. The VISIBLE/display defaults follow the Path-2
 * rule: keep exactly what the original site displays to users.
 */

export const site = {
  /* --- Names --- */
  // Legal/full name = on-page schema name (matches original).
  legalName: 'Menon Medispa & Wellness',
  // Short display name (Wix siteDisplayName).
  displayName: 'Menon Medispa',
  // Affiliated name that appears on some contact/sales lines + Bookings location.
  // Informational only — do NOT treat as a NAP error; keep visible text verbatim.
  affiliatedName: 'Menon Regenerative Institute',

  /* --- URLs --- */
  url: 'https://www.menonmedispa.com', // current production (Wix). Update at P06 cutover.
  schemaId: 'https://www.menonmedispa.com/#localbusiness', // keep stable @id from original

  /* --- Address (consistent across all sources — no conflict) --- */
  address: {
    street: '45 Essex St, Suite 202', // visible footer form (schema abbreviated as "STE 202")
    locality: 'Millburn',
    region: 'NJ',
    postalCode: '07041', // business-info had 07041-1668; visible/schema use 07041
    country: 'US',
    formatted: '45 Essex St, Suite 202, Millburn, NJ 07041',
  },

  /* --- Phone — RESOLVED by operator (2026-06-02). Canonical = (973) 494-8431. ---
     The capture found 3 numbers (visible 358-5771, Wix/Ads 382-5002, on-page-schema
     494-8431); the operator confirmed 494-8431 as the one true line and directed the
     other two be removed everywhere. This is an authorized deviation from pure
     visible-replication: the build MUST render (973) 494-8431 on every page, NOT the
     358-5771 that appears in the captured artifacts.
     NOTE: WhatConverts (carried-over lead tracking) performs dynamic number insertion
     and may swap the displayed number for a tracking line at runtime; 494-8431 is the
     base/fallback that the tracking number forwards to. */
  phone: {
    display: '(973) 494-8431',
    tel: '+19734948431',
    schema: '+1-973-494-8431',
  },

  email: 'admin@menonregen.com', // consistent across all sources

  /* --- Hours (from original on-page OpeningHoursSpecification; profile had none) --- */
  hours: [
    { days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: '10:00', closes: '18:00' },
    { days: ['Saturday'], opens: '10:00', closes: '14:00' },
    // Sunday: closed (not listed in original schema).
  ],

  /* --- Geo — ⚠️ minor conflict (~250m). Default = on-page schema (what site shipped). ---
     Wix profile alt: { lat: 40.7255347, lng: -74.3040754 }. TODO(operator): confirm. */
  geo: {
    lat: 40.7244443,
    lng: -74.3069069,
  },

  /* --- Social (sameAs) — from on-page schema + footer, consistent --- */
  social: {
    instagram: 'https://www.instagram.com/menonmedispa/',
    facebook: 'https://www.facebook.com/menonmedispa/',
    tiktok: 'https://www.tiktok.com/@menonregen',
  },

  /* --- Schema / brand metadata (carry verbatim from original on-page schema) --- */
  schemaType: 'MedicalBusiness', // narrowed from original flat LocalBusiness (invisible SEO upgrade)
  description:
    'Menon Medispa & Wellness offers advanced aesthetic and wellness treatments in Millburn, NJ, serving nearby towns with expert care and personalized service.',
  priceRange: '$$',
  // Logo: original hotlinked wixstatic; rehost the captured local copy at build.
  // TODO(03-build): point at the rehosted local logo under /images or /fonts assets.
  logo: 'https://static.wixstatic.com/media/f61cce_718cc937e5cd45ac8470665eae97231d~mv2.png',
  areaServed: [
    'Short Hills, NJ',
    'Summit, NJ',
    'Maplewood, NJ',
    'Livingston, NJ',
    'Springfield, NJ',
    'Vauxhall, NJ',
    'West Orange, NJ',
  ],
  founder: 'Dr. Aditi Menon, MD', // founded 2019; use only if a Person/founder node is desired

  timeZone: 'America/New_York',
  locale: 'en-US',
  currency: 'USD',
  wixSiteId: '726ff7e6-f929-4c22-a4c9-5c64aa5b9473',

  /* --- Scheduling (Cal.com external embed — replaces Wix Bookings) ---
     ⚠️ PLACEHOLDER. Operator deferred the real Cal.com event-type URLs (2026-06-02).
     Swap this ONE constant pre-go-live; every "Book"/"Schedule" CTA + the
     BookingCalendarTemplate read from it. Do NOT mistake this for a live URL. */
  calcomUrl: 'https://cal.com/REPLACE-ME',

  /* --- Convenience helpers (used by ChatAssistant + LeadForm + CTAs) --- */
  contact: {
    phoneHref: 'tel:+19734948431',
    bookingUrl: 'https://cal.com/REPLACE-ME', // === calcomUrl (placeholder)
  },

  /* --- Integrations (analytics carry-over + chat) --- */
  integrations: {
    /* Analytics / tracking carried over verbatim per operator decision (2026-06-02).
       GA4 measurement ID unconfirmed at build — left null so no fake ID ships;
       operator pastes it pre-go-live. The others have confirmed captured IDs.
       ProveSrc / Omnisend / Sentry / the obfuscated 159358-domain pre-WhatConverts
       tracker are intentionally NOT here (operator-decide → left out / flagged). */
    analytics: {
      ga4: null as string | null,              // gtag present on original; ID to confirm
      metaPixelId: '1005972549954643',
      googleAdsConversionId: '10822588412',
      microsoftClarityId: 'ordx9s73l4',
      // WhatConverts call/lead tracking (operator-confirmed legit). Dynamic number
      // insertion: swaps the displayed phone for a tracking line forwarding to the
      // canonical (973) 494-8431. Loader carried over verbatim.
      whatConvertsLoader:
        '<script id="" text="" charset="" type="text/javascript" src="//s.ksrndkehqnwntyxlhgto.com/159358.js"></script>',
    },
    // Chat: Wix-native chat REPLACED by the built-in decision-tree assistant.
    // No AI, no free-text, no PHI egress (HIPAA-safe). One chat per site.
    chat: {
      mode: 'tree' as 'tree' | 'embed' | null,
      enabled: true,
      provider: null as string | null,
      loader: '',
    },
  },
} as const;

export type Site = typeof site;
export default site;

/**
 * NAV — primary navigation (verbatim labels + local hrefs), used by the chat
 * assistant's services branch and any nav consumer. Mirrors SiteHeader.astro.
 */
export const NAV = {
  primary: [
    { label: 'HOME', href: '/' },
    { label: 'ABOUT', href: '/about' },
    { label: 'FACE', href: '/face' },
    { label: 'BODY', href: '/body' },
    { label: 'HAIR', href: '/hair' },
    { label: 'CONTACT', href: '/contact' },
    { label: 'SALE', href: '/sale' },
  ],
  // Service category landing pages (verbatim labels → local hrefs).
  services: [
    { label: 'Face Treatments', href: '/face' },
    { label: 'Body Treatments', href: '/body' },
    { label: 'Hair Restoration', href: '/hair' },
    { label: 'HydraFacial', href: '/hydrafacial' },
    { label: 'Botox', href: '/botox-millburn-nj' },
    { label: 'Fillers & Injectables', href: '/fillers-injectables' },
    { label: 'IV Therapy', href: '/iv-therapy-millburn-nj' },
    { label: 'Laser Hair Removal', href: '/laser-hair-removal' },
    { label: 'Vitamin Shots', href: '/vitamin-shots-millburn-nj' },
    { label: 'Memberships', href: '/memberships' },
  ],
} as const;

/** Build a sameAs[] array (filters out unset entries) for JSON-LD. */
export const sameAs = (): string[] =>
  Object.values(site.social).filter(Boolean);

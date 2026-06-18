/**
 * bookingRoutes.ts — single source of truth for where each page's "Book" CTA goes.
 *
 * Booking CTAs across the site link to `/request-appointment` (the constant
 * `site.calcomUrl`). BaseLayout calls `resolveBooking(pathname)` per page and a tiny
 * inline script rewrites those links accordingly:
 *   - BROAD/category pages → /consultation (guided "help me choose")
 *   - SPECIFIC treatment pages → /request-appointment?service=<name> (auto-selected)
 *   - anything else → left as bare /request-appointment (the form asks what they want)
 *
 * An explicit per-link `?service=` (e.g. the pricing-tier buttons in ServiceBookingCta)
 * always wins and is never rewritten. Edit the two collections below to reclassify a page.
 */

export const CONSULTATION_URL = '/consultation';
export const BOOKING_URL = '/request-appointment';

// Pages that list MANY treatments / are exploratory → send "Book" to the guided consultation.
export const BROAD_PATHS: ReadonlySet<string> = new Set([
  '/', // homepage generic "Schedule" CTAs
  '/face',
  '/body',
  '/hair',
  '/menon-facials',
  '/iv-therapy-millburn-nj',
  '/short-hills-medispa-treatments',
]);

// Pages whose ServiceBookingCta lists MULTIPLE cards (tiers/options of the service). The generic
// "Book" (hero / sticky sidebar / mobile bar) should SCROLL DOWN to those choices (the booking
// band, id="book") instead of pre-selecting one — then each card books its own tier. Keep a
// display name where the cards are tiers of ONE treatment (used for the hero CTA label).
export const MULTI_TIER_PATHS: ReadonlySet<string> = new Set([
  '/hydrafacial',
  '/hydrafacial-keravive',
  '/laser-hair-removal',
  '/laser-facials',
  '/fillers-injectables',
  '/clear-lift-skin-rejuvination',
  '/energy-performance',
  '/immunity-support',
  '/recovery-detox',
  '/nad-iv-drip-therapy',
  '/anti-aging-beauty',
  '/targeted-health-solutions-iv',
  '/vitamin-shots-millburn-nj',
  '/vascular-treatments',
]);

/** The booking band anchor a multi-tier "Book" scrolls to (set on the ServiceBookingCta section). */
export const BOOKING_ANCHOR = '#book';

// Single-treatment pages → pre-select this service in the booking form.
export const SERVICE_BY_PATH: Readonly<Record<string, string>> = {
  '/botox-millburn-nj': 'Botox',
  '/juvedermfillers': 'Juvederm Fillers',
  '/hydrafacial': 'HydraFacial',
  '/hydrafacial-keravive': 'HydraFacial Keravive',
  '/acne-facial': 'Acne Facial',
  '/chemical-peel-facial': 'Chemical Peel Facial',
  '/cupping-facial': 'Cupping Facial',
  '/dermaplaning-facial': 'Dermaplaning Facial',
  '/glass-facial': 'Glass Facial',
  '/vitamin-c-facial': 'Vitamin C Facial',
  '/manual-lymph-facials': 'Manual Lymph Drainage Facial',
  '/microneedling-millburn-nj': 'Microneedling',
  '/clear-lift-skin-rejuvination': 'ClearLift Skin Rejuvenation',
  '/laser-hair-removal': 'Laser Hair Removal',
  '/semaglutide': 'Semaglutide',
  '/custom-iv-drip-therapy-millburn-nj': 'Custom IV Drip',
  '/myers-cocktail-iv-therapy': 'Myers Cocktail IV',
  '/nad-injection': 'NAD+ Injection',
  '/nad-iv-drip-therapy': 'NAD+ IV Drip',
  '/immunity-support': 'Immunity Support IV',
  '/energy-performance': 'Energy & Performance IV',
  '/recovery-detox': 'Recovery & Detox IV',
  '/targeted-health-solutions-iv': 'Targeted Health Solutions IV',
  '/anti-aging-beauty': 'Anti-Aging & Beauty IV',
  '/platelet-rich-plasma-hair-millburn': 'PRP Hair Restoration',
};

export type BookingResolution = { mode: 'request' | 'consultation' | 'scroll'; service?: string; anchor?: string };

/** Normalize a pathname (drop a trailing slash, keep root as '/'). */
function normalizePath(pathname: string): string {
  if (!pathname) return '/';
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
}

/** Decide where this page's generic "Book" CTAs should point. */
export function resolveBooking(pathname: string): BookingResolution {
  const p = normalizePath(pathname);
  // Multi-tier pages win first: the generic Book scrolls to the on-page choices.
  if (MULTI_TIER_PATHS.has(p)) return { mode: 'scroll', service: SERVICE_BY_PATH[p], anchor: BOOKING_ANCHOR };
  if (BROAD_PATHS.has(p)) return { mode: 'consultation' };
  const service = SERVICE_BY_PATH[p];
  if (service) return { mode: 'request', service };
  return { mode: 'request' };
}

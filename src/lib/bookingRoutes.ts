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
  '/fillers-injectables',
  '/vitamin-shots-millburn-nj',
  '/vascular-treatments',
  '/laser-facials',
  '/short-hills-medispa-treatments',
]);

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

export type BookingResolution = { mode: 'request' | 'consultation'; service?: string };

/** Normalize a pathname (drop a trailing slash, keep root as '/'). */
function normalizePath(pathname: string): string {
  if (!pathname) return '/';
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
}

/** Decide where this page's generic "Book" CTAs should point. */
export function resolveBooking(pathname: string): BookingResolution {
  const p = normalizePath(pathname);
  if (BROAD_PATHS.has(p)) return { mode: 'consultation' };
  const service = SERVICE_BY_PATH[p];
  if (service) return { mode: 'request', service };
  return { mode: 'request' };
}

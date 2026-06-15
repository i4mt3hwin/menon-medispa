/**
 * reviews.ts, resolves curated testimonials (reviews.json) for a page.
 *
 * The data is medispa-only and provider-safe (see reviews.json _note). A page asks
 * for reviews by service slug OR by a raw tag; we resolve the slug to its service
 * tag(s) via SLUG_TAGS, return matching reviews in curated order, and top up from
 * the 'general' fallback pool when a service has too few of its own. Selection is
 * deterministic (array order), so builds are stable, no Math.random.
 *
 * getReviews(slugOrTag, count) → Review[]   (always tries to return `count`, may be fewer if the pool is exhausted)
 * getReview(slugOrTag)        → Review | null
 */
import data from '@/data/reviews.json';

export interface Review {
  id: string;
  author: string;
  location?: string;
  rating: number;
  quote: string;
  tags: string[];
}

const ALL: Review[] = (data as { reviews: Review[] }).reviews;
const GENERAL: Review[] = ALL.filter((r) => r.tags.includes('general'));

/**
 * Page slug → service tag(s). Pages not listed here fall through to the raw-tag
 * path (and ultimately the 'general' pool), so an unmapped page still renders.
 */
const SLUG_TAGS: Record<string, string[]> = {
  // HydraFacial
  hydrafacial: ['hydrafacial'],
  'hydrafacial-keravive': ['hydrafacial'],
  // Facials / skin
  'acne-facial': ['facial'],
  'chemical-peel-facial': ['facial'],
  'cupping-facial': ['facial'],
  'glass-facial': ['facial'],
  'manual-lymph-facials': ['facial'],
  'vitamin-c-facial': ['facial'],
  'dermaplaning-facial': ['facial'],
  'menon-facials': ['facial'],
  'laser-facials': ['facial'],
  'anti-aging-beauty': ['facial'],
  'clear-lift-skin-rejuvination': ['facial'],
  face: ['facial'],
  // Laser hair removal
  'laser-hair-removal': ['laser-hair-removal'],
  hair: ['laser-hair-removal'],
  // Injectables
  'botox-millburn-nj': ['botox'],
  juvedermfillers: ['fillers', 'botox'],
  'fillers-injectables': ['fillers', 'botox'],
  // Microneedling
  'microneedling-millburn-nj': ['microneedling', 'facial'],
  // IV therapy / wellness
  'iv-therapy-millburn-nj': ['iv-therapy'],
  'custom-iv-drip-therapy-millburn-nj': ['iv-therapy'],
  'myers-cocktail-iv-therapy': ['iv-therapy'],
  'nad-injection': ['iv-therapy'],
  'nad-iv-drip-therapy': ['iv-therapy'],
  'targeted-health-solutions-iv': ['iv-therapy'],
  'vitamin-shots-millburn-nj': ['iv-therapy'],
  'immunity-support': ['iv-therapy'],
  'recovery-detox': ['iv-therapy'],
  'energy-performance': ['iv-therapy'],
};

function resolveTags(slugOrTag: string): string[] {
  return SLUG_TAGS[slugOrTag] ?? [slugOrTag];
}

export function getReviews(slugOrTag: string, count = 1): Review[] {
  const tags = resolveTags(slugOrTag);
  const seen = new Set<string>();
  const out: Review[] = [];

  // 1. Reviews that match the requested service tag(s), in curated order.
  for (const r of ALL) {
    if (out.length >= count) break;
    if (r.tags.some((t) => tags.includes(t)) && !seen.has(r.id)) {
      seen.add(r.id);
      out.push(r);
    }
  }

  // 2. Top up from the general fallback pool if still short.
  for (const r of GENERAL) {
    if (out.length >= count) break;
    if (!seen.has(r.id)) {
      seen.add(r.id);
      out.push(r);
    }
  }

  return out;
}

export function getReview(slugOrTag: string): Review | null {
  return getReviews(slugOrTag, 1)[0] ?? null;
}

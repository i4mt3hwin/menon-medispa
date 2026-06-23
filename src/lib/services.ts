/**
 * services.ts — shared helpers over data/services.json.
 *
 * The booking form (BookingRequest.astro) and the /consultation form both offer a
 * "What are you interested in?" dropdown built from the distinct service categories.
 * That list lives here (once) so the two forms can never drift, and so the
 * medical-consult logic in consult.ts always sees the same option strings.
 */
import services from '@/data/services.json';

/** The "I'm not sure" default; also the value the booking endpoint treats as a plain consult. */
export const GENERAL_CONSULTATION = 'General consultation';

// Promo buckets that aren't real, selectable categories.
const CATEGORY_EXCLUDE = new Set(['Sale', 'Botox Sale']);
// Normalize trademark glyphs / duplicate package buckets to their plain category.
const CATEGORY_RENAME: Record<string, string> = {
  'HydraFacial™ Keravive™': 'HydraFacial Keravive',
  'Laser Hair Removal Package': 'Laser Hair Removal',
};

/** Distinct, selectable service categories — data-driven, sorted A→Z. */
export function serviceCategories(): string[] {
  return Array.from(
    new Set(
      (services as Array<{ category?: string }>)
        .map((s) => s.category)
        .filter((c): c is string => Boolean(c) && !CATEGORY_EXCLUDE.has(c as string))
        .map((c) => CATEGORY_RENAME[c] ?? c)
    )
  ).sort((a, b) => a.localeCompare(b));
}

/**
 * Options for an interest dropdown: "General consultation" first, then categories.
 * A `prefill` not already in the list (e.g. a specific service from ?service=) is
 * prepended so it can be pre-selected/locked.
 */
export function serviceInterestOptions(prefill?: string): { options: string[]; selected: string } {
  const base = [GENERAL_CONSULTATION, ...serviceCategories()];
  const options = prefill && !base.includes(prefill) ? [prefill, ...base] : base;
  const selected = prefill && options.includes(prefill) ? prefill : GENERAL_CONSULTATION;
  return { options, selected };
}

/** Friendly label for an interest option. */
export function interestLabel(opt: string): string {
  return opt === GENERAL_CONSULTATION ? "I'm not sure yet — general consultation" : opt;
}

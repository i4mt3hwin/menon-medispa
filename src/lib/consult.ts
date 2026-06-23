/**
 * consult.ts — single source of truth for "which consultation tier does a
 * treatment need?" and the copy that describes the two tiers.
 *
 * Menon runs two consultation tiers:
 *   - esthetician : complimentary skin assessment with a licensed esthetician
 *   - medical     : $50 consult with Dr. Menon, MD, credited toward treatment
 *
 * The tier is decided BY THE TREATMENT, not by the visitor — injectables,
 * Semaglutide, and microneedling are physician-led and must be the medical
 * consult. Dr. Menon also sees some other cases at her discretion, so the
 * esthetician copy is intentionally soft ("we'll confirm which applies") rather
 * than a hard "free" promise. The booking form (BookingRequest.astro) and the
 * /consultation form (consultation__section_5.astro) both derive their tier
 * notice + the tag recorded on the lead from here, so they can never drift.
 *
 * CAVEAT: microneedling lives in the "Menon Facials" category (data/services.json)
 * alongside esthetician facials, so a category-level pick of "Menon Facials" will
 * NOT auto-flag medical — only the specific "Microneedling" service does. That is
 * intentional: the soft default note + front-desk confirmation covers the rest.
 */

export type ConsultTier = 'medical' | 'esthetician';

/**
 * Matches the physician-led set against a service NAME or CATEGORY string:
 *   - "Fillers & Injectables", "BOTOX® Injectables", "Juvederm Fillers"  (injectables)
 *   - "Semaglutide", "Semaglutide Medical Weight Loss"                   (semaglutide)
 *   - "Microneedling", "Microneedling - 3 Sessions"                      (microneedling)
 * Tokens are precise so "rejuvenation"/"photorejuvenation" lasers don't false-trigger.
 */
export const MEDICAL_CONSULT_RE = /botox|juv[eé]derm|filler|injectable|semaglutide|microneedl/i;

/** Decide which consultation tier a service/category requires. */
export function consultTierFor(value: string | null | undefined): ConsultTier {
  return value && MEDICAL_CONSULT_RE.test(value) ? 'medical' : 'esthetician';
}

/** True when the chosen service must begin with the Dr. Menon medical consult. */
export function isMedicalConsult(value: string | null | undefined): boolean {
  return consultTierFor(value) === 'medical';
}

/**
 * Tag folded into `service_interest` when a medical-consult service is requested,
 * so the front desk books Dr. Menon (and the $50/credit) without a schema change.
 * Mirrors the package-detail fold-in already used in BookingRequest.
 */
export const MEDICAL_CONSULT_TAG = 'Dr. Menon medical consult ($50, credited)';

/** Append the medical tag to a service_interest string (idempotent). */
export function withConsultTag(serviceInterest: string): string {
  const base = serviceInterest || '';
  if (!isMedicalConsult(base) || base.includes(MEDICAL_CONSULT_TAG)) return base;
  return `${base} — ${MEDICAL_CONSULT_TAG}`;
}

/**
 * Tier copy, split into an emphasised lead + the rest so templates can wrap the
 * lead in <strong> while keeping a single source for the wording.
 */
export const CONSULT_NOTES: Record<ConsultTier, { emphasis: string; rest: string }> = {
  medical: {
    emphasis: '$50 consultation with Dr. Menon',
    rest: ', credited toward your treatment. Injectables, Semaglutide, and microneedling begin with a brief medical consult to plan your treatment safely.',
  },
  esthetician: {
    emphasis: 'Your consultation is complimentary',
    rest: ' with a licensed esthetician. Some treatments are seen by Dr. Menon, MD — we will confirm which applies when we reach out.',
  },
};

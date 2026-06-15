/**
 * social-proof.ts, the seeded activity feed for the SocialProofToast widget.
 *
 * WHAT THIS IS: a curated, rotating list of recent-activity blurbs shown in a
 * small bottom-corner toast ("Sarah K. from Short Hills booked a facial
 * treatment"). It replaces the third-party ProveSrc widget from the old Wix
 * site with a native, no-extra-script version we control.
 *
 * ⚠️ TWO DELIBERATE GUARDRAILS (operator-approved 2026-06-15):
 *   1. SEEDED, NOT LIVE. These are representative entries, not real bookings,
 *      because bookings happen on the external Cal.com scheduler and don't flow
 *      back to this site. When Cal.com is wired up (webhook -> /api Worker ->
 *      D1), swap this static array for a fetch of real, consented bookings. Keep
 *      the shape (ProofEntry) identical and the widget needs no changes.
 *   2. GENERALIZED SERVICE, NEVER THE SPECIFIC PROCEDURE. This is a medical
 *      aesthetics practice. We say "a facial treatment" / "an IV wellness drip",
 *      NOT "Botox" / "a chemical peel", so the widget never ties a near-named
 *      person to a specific medical/cosmetic procedure. Keep `service` at the
 *      category level. Do NOT add brand/procedure names here.
 *
 * To edit: change/add/remove entries below. `name` = first name + last initial.
 * `town` should be one of the local service-area towns. `service` must stay a
 * generalized category. `when` is a soft relative phrase (no precise times).
 */

/** Generalized treatment buckets. The toast shows a category PHOTO (a facial, an
 * IV drip, a laser), never a procedure-specific or identifying image. The
 * category -> image mapping lives in SocialProofToast.astro. */
export type ProofCategory = 'facial' | 'skin' | 'iv' | 'wellness' | 'laser' | 'hair' | 'body';

export interface ProofEntry {
  /** First name + last initial only, e.g. "Sarah K." */
  name: string;
  /** A local service-area town, e.g. "Short Hills". */
  town: string;
  /** GENERALIZED treatment category. Never a specific procedure/brand. */
  service: string;
  /** Drives the thumbnail (category photo, not procedure-specific). */
  category: ProofCategory;
  /** Soft relative phrase, e.g. "earlier today". No precise timestamps. */
  when: string;
}

// Generalized categories that map to Menon's real offerings (face / body / hair
// / IV wellness) without ever naming a specific procedure.
export const socialProof: ProofEntry[] = [
  { name: 'Sarah K.',   town: 'Short Hills', service: 'a facial treatment',          category: 'facial',   when: 'earlier today' },
  { name: 'Priya M.',   town: 'Millburn',    service: 'a skin rejuvenation session', category: 'skin',     when: 'a few hours ago' },
  { name: 'Jessica L.', town: 'Summit',      service: 'an IV wellness drip',         category: 'iv',       when: 'yesterday' },
  { name: 'Daniel R.',  town: 'Livingston',  service: 'a wellness consultation',     category: 'wellness', when: 'earlier today' },
  { name: 'Amanda T.',  town: 'Maplewood',   service: 'a laser treatment',           category: 'laser',    when: 'this week' },
  { name: 'Nicole B.',  town: 'Springfield', service: 'a facial treatment',          category: 'facial',   when: '2 days ago' },
  { name: 'Michael S.', town: 'West Orange', service: 'a hair restoration consult',  category: 'hair',     when: 'yesterday' },
  { name: 'Rachel P.',  town: 'Short Hills', service: 'a glow consultation',         category: 'skin',     when: 'a few hours ago' },
  { name: 'Olivia H.',  town: 'Millburn',    service: 'a skin rejuvenation session', category: 'skin',     when: 'earlier today' },
  { name: 'Karen D.',   town: 'Summit',      service: 'an IV wellness drip',         category: 'iv',       when: 'this week' },
  { name: 'Sophia C.',  town: 'Livingston',  service: 'a facial treatment',          category: 'facial',   when: 'yesterday' },
  { name: 'Emily W.',   town: 'Vauxhall',    service: 'a vitamin boost',             category: 'iv',       when: 'earlier today' },
  { name: 'Laura G.',   town: 'Maplewood',   service: 'a body wellness treatment',   category: 'body',     when: '2 days ago' },
  { name: 'Hannah F.',  town: 'Short Hills', service: 'a laser treatment',           category: 'laser',    when: 'a few hours ago' },
  { name: 'Maria V.',   town: 'Millburn',    service: 'a wellness consultation',     category: 'wellness', when: 'this week' },
  { name: 'Grace N.',   town: 'Springfield', service: 'a facial treatment',          category: 'facial',   when: 'yesterday' },
];

export default socialProof;

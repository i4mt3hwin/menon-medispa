/**
 * glow-engine.ts, recommendation engine for the "Find Your Glow" tool.
 *
 * Pure, framework-free, browser-safe. Imported by find-your-glow.astro's client
 * <script> (bundled by Vite). Given the visitor's quiz answers it returns ranked
 * in-clinic treatments + a personalized AM/PM/weekly at-home routine + a cosmetic
 * "interest summary" string used for the lead record.
 *
 * Clinical nuance lives in the DATA files (glow-treatments.json, glow-routine.json),
 * so it can be reconciled against the research brief without touching this logic:
 *
 *   Treatment = {
 *     id, name, href, category, icon,
 *     blurb, whatItIs,
 *     concerns:   { [concernId]: 1|2|3 },   // how strongly it helps each concern
 *     skinTypes:  string[] | ["all"],
 *     downtimeLevel: 0|1|2,                  // 0 none, 1 minimal, 2 some
 *     sensitivityMax: "low"|"mid"|"high",    // highest reactivity it still suits
 *     contra:     string[],                  // safety flags that HARD-EXCLUDE it
 *     cautions:   string[],                  // soft notes (shown, not excluded)
 *     downtime, sessions, priceFrom, evidence
 *   }
 *
 *   Active = {
 *     id, name, slot, phase, label, note,
 *     concerns: { [concernId]: 1|2|3 },
 *     skinTypes: string[] | ["all"],
 *     sensitivityMax: "low"|"mid"|"high",
 *     pregnancySafe: boolean,
 *     always?: boolean,        // include regardless of score (cleanser/moisturizer/SPF)
 *     base?: number            // baseline priority
 *   }
 *
 * Cosmetic-interest framing only: nothing here is diagnostic or stored as a
 * medical condition. See find-your-glow.astro for the consent + privacy copy.
 */

import concernsData from '../data/glow-concerns.json';
import treatmentsData from '../data/glow-treatments.json';
import routineData from '../data/glow-routine.json';

export type Sensitivity = 'low' | 'mid' | 'high';
export type Downtime = 'none' | 'little' | 'flexible';

export interface Answers {
  primary?: string;
  secondary?: string[];
  skinType?: string;
  sensitivity?: Sensitivity;
  ageBand?: string;
  downtime?: Downtime;
  routine?: 'minimal' | 'basic' | 'dedicated';
  sun?: string;
  flags?: string[];
}

interface Concern { id: string; label: string; short: string; icon: string; }
interface Treatment {
  id: string; name: string; href: string; category: string; icon: string;
  blurb: string; whatItIs: string;
  concerns: Record<string, number>;
  skinTypes: string[];
  downtimeLevel: number;
  sensitivityMax: Sensitivity;
  contra: string[];
  cautions: string[];
  downtime: string; sessions: string; priceFrom: string; evidence?: string;
}
interface Active {
  id: string; name: string; slot: string; phase: 'am' | 'pm' | 'weekly';
  label: string; note: string;
  concerns: Record<string, number>;
  skinTypes: string[];
  sensitivityMax: Sensitivity;
  pregnancySafe: boolean;
  always?: boolean; base?: number;
}

const CONCERNS: Concern[] = (concernsData as any).concerns;
const TREATMENTS: Treatment[] = treatmentsData as any;
const ACTIVES: Active[] = routineData as any;

const SENS_RANK: Record<Sensitivity, number> = { low: 0, mid: 1, high: 2 };
const DOWNTIME_TOL: Record<Downtime, number> = { none: 0, little: 1, flexible: 2 };

const concernLabel = (id: string): string =>
  CONCERNS.find((c) => c.id === id)?.label ?? id;
const concernShort = (id: string): string =>
  CONCERNS.find((c) => c.id === id)?.short ?? '';

/** Weighted concern vector: primary counts most, each secondary adds a little. */
function concernWeights(a: Answers): Record<string, number> {
  const w: Record<string, number> = {};
  if (a.primary) w[a.primary] = 3;
  for (const s of a.secondary ?? []) w[s] = (w[s] ?? 0) + 1.4;
  return w;
}

function skinTypeFits(types: string[], skinType?: string): boolean {
  return !skinType || types.includes('all') || types.includes(skinType);
}

export interface RankedTreatment extends Treatment {
  score: number;
  match: number;            // friendly 0–100 "match" figure
  why: string;              // tailored "why this matches you"
  rankLabel: string;        // "Top match", "Also for you"…
  cautionNote: string | null;
}

export interface RoutineStep {
  name: string;             // active type, e.g. "Vitamin C serum"
  note: string;
  phase: 'am' | 'pm' | 'weekly';
  pregnancySafe: boolean;
}

export interface GlowResult {
  profile: {
    primary: { id: string; label: string } | null;
    concerns: { id: string; label: string }[];
    skinType: string | null;
    sensitivity: Sensitivity | null;
    pregnancy: boolean;
  };
  treatments: RankedTreatment[];
  routine: { am: RoutineStep[]; pm: RoutineStep[]; weekly: RoutineStep[] };
  interestSummary: string;
  serviceInterest: string;
  safetyNote: string | null;
}

/** Build the "why this matches you" line from the visitor's own concerns. */
function buildWhy(t: Treatment, weights: Record<string, number>): string {
  const hits = Object.keys(weights)
    .filter((c) => (t.concerns[c] ?? 0) > 0)
    .sort((a, b) => (t.concerns[b] ?? 0) * weights[b] - (t.concerns[a] ?? 0) * weights[a])
    .map((c) => concernShort(c).toLowerCase())
    .filter(Boolean);
  if (!hits.length) return t.blurb;
  const lead = hits.slice(0, 2).join(' and ');
  const tail = t.downtimeLevel === 0 ? ' with no downtime' : '';
  return `Matched to your goal of ${lead}${tail}.`;
}

function scoreTreatment(t: Treatment, a: Answers, weights: Record<string, number>): number {
  let score = 0;
  for (const [c, uw] of Object.entries(weights)) score += (t.concerns[c] ?? 0) * uw;
  if (score <= 0) return 0;

  // skin-type fit
  if (skinTypeFits(t.skinTypes, a.skinType)) score += 0.6;
  else score -= 0.4;

  // downtime fit, surface zero-downtime options for low-tolerance visitors
  const tol = DOWNTIME_TOL[a.downtime ?? 'little'];
  if (t.downtimeLevel > tol) score *= t.downtimeLevel - tol >= 2 ? 0.5 : 0.75;
  else score += 0.3;

  // sensitivity, ease off aggressive treatments for reactive skin
  if (a.sensitivity && SENS_RANK[a.sensitivity] > SENS_RANK[t.sensitivityMax]) score *= 0.7;

  // age nuance, corrective treatments lift slightly with age, gentle glow for younger
  const corrective = (t.concerns.aging ?? 0) + (t.concerns.firmness ?? 0);
  if (corrective > 0) {
    if (a.ageBand === '40s') score += 0.4;
    else if (a.ageBand === '50plus') score += 0.7;
    else if (a.ageBand === 'lt30') score -= 0.3;
  }
  return score;
}

function rankLabelFor(i: number): string {
  return i === 0 ? 'Top match' : i === 1 ? 'Recommended' : 'Also for you';
}

function pickTreatments(a: Answers, weights: Record<string, number>): RankedTreatment[] {
  const flags = new Set(a.flags ?? []);
  const eligible = TREATMENTS.filter((t) => !t.contra.some((f) => flags.has(f)));

  const scored = eligible
    .map((t) => ({ t, score: scoreTreatment(t, a, weights) }))
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score);

  const top = scored.slice(0, 3);
  const max = top.length ? top[0].score : 1;

  return top.map((x, i) => {
    const cautionHit = x.t.cautions.find((f) => flags.has(f));
    return {
      ...x.t,
      score: x.score,
      match: Math.round(Math.min(99, 82 + (x.score / max) * 16)),
      why: buildWhy(x.t, weights),
      rankLabel: rankLabelFor(i),
      cautionNote: cautionHit ? cautionLine(cautionHit) : null,
    };
  });
}

function cautionLine(flag: string): string {
  switch (flag) {
    case 'pregnancy': return 'Often adjusted or deferred during pregnancy, your provider will confirm.';
    case 'isotretinoin': return 'Usually spaced from recent isotretinoin, your provider will confirm timing.';
    case 'activeInfection': return 'Best once any active breakout or irritation has settled.';
    case 'keloid': return 'Your provider will tailor this if you scar easily.';
    default: return 'Your provider will confirm this is right for you.';
  }
}

/** Choose one best active for a slot given the visitor; null if none qualifies. */
function pickActive(slot: string, a: Answers, weights: Record<string, number>, pregnancy: boolean): Active | null {
  const sens = a.sensitivity ?? 'mid';
  const pool = ACTIVES.filter((x) => x.slot === slot)
    .filter((x) => skinTypeFits(x.skinTypes, a.skinType))
    .filter((x) => SENS_RANK[sens] <= SENS_RANK[x.sensitivityMax])
    .filter((x) => !pregnancy || x.pregnancySafe);

  if (!pool.length) return null;

  const scored = pool.map((x) => {
    let s = x.base ?? 0;
    for (const [c, uw] of Object.entries(weights)) s += (x.concerns[c] ?? 0) * uw;
    return { x, s };
  });
  // "always" slots (cleanser/moisturizer/SPF) include even with no concern hit
  const isAlways = pool.some((x) => x.always);
  const best = scored.sort((p, q) => q.s - p.s)[0];
  if (!isAlways && best.s <= 0) return null;
  return best.x;
}

function buildRoutine(a: Answers, weights: Record<string, number>, pregnancy: boolean) {
  const step = (x: Active | null): RoutineStep | null =>
    x ? { name: x.label, note: x.note, phase: x.phase, pregnancySafe: x.pregnancySafe } : null;

  const am = [
    pickActive('cleanse', a, weights, pregnancy),
    pickActive('treat-am', a, weights, pregnancy),
    pickActive('hydrate', a, weights, pregnancy),
    pickActive('moisturize', a, weights, pregnancy),
    pickActive('protect', a, weights, pregnancy),
  ].map(step).filter(Boolean) as RoutineStep[];

  const pm = [
    pickActive('cleanse', a, weights, pregnancy),
    pickActive('treat-pm', a, weights, pregnancy),
    pickActive('hydrate', a, weights, pregnancy),
    pickActive('moisturize', a, weights, pregnancy),
  ].map(step).filter(Boolean) as RoutineStep[];

  const weekly = [pickActive('weekly', a, weights, pregnancy)].map(step).filter(Boolean) as RoutineStep[];

  // mark AM/PM phase on shared actives correctly
  am.forEach((s) => (s.phase = 'am'));
  pm.forEach((s) => (s.phase = 'pm'));
  weekly.forEach((s) => (s.phase = 'weekly'));
  return { am, pm, weekly };
}

/** Main entry. */
export function recommend(a: Answers): GlowResult {
  const weights = concernWeights(a);
  const pregnancy = (a.flags ?? []).includes('pregnancy');

  const treatments = pickTreatments(a, weights);
  const routine = buildRoutine(a, weights, pregnancy);

  const allConcerns = [a.primary].concat(a.secondary ?? []).filter(Boolean) as string[];
  const uniqConcerns = Array.from(new Set(allConcerns));

  // Cosmetic-interest summary for the lead record (NON-PHI: interests, not diagnoses).
  const interestParts: string[] = [];
  if (uniqConcerns.length) interestParts.push('Interests: ' + uniqConcerns.map(concernLabel).join(', '));
  if (a.skinType) interestParts.push(a.skinType + ' skin');
  if (treatments.length) interestParts.push('Top matches: ' + treatments.map((t) => t.name).join(', '));
  const interestSummary = interestParts.join(' · ');

  const serviceInterest = treatments[0]?.category ?? (a.primary ? concernLabel(a.primary) : 'Skin consultation');

  let safetyNote: string | null = null;
  if (pregnancy) safetyNote = 'Because you told us you may be pregnant or breastfeeding, we’ve shown only gentle, pregnancy-conscious options and swapped your routine to pregnancy-safe ingredients. Please confirm everything with your provider and OB.';
  else if ((a.flags ?? []).length) safetyNote = 'We’ve tailored these around the safety notes you shared. Your provider will confirm the final plan at your consultation.';

  return {
    profile: {
      primary: a.primary ? { id: a.primary, label: concernLabel(a.primary) } : null,
      concerns: uniqConcerns.map((id) => ({ id, label: concernLabel(id) })),
      skinType: a.skinType ?? null,
      sensitivity: a.sensitivity ?? null,
      pregnancy,
    },
    treatments,
    routine,
    interestSummary,
    serviceInterest,
    safetyNote,
  };
}

export default recommend;

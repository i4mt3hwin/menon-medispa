/**
 * packages.ts — multi-package services (e.g. Laser Hair Removal), where one
 * service is sold as several area-size tiers, each with a per-session price, a
 * 6-session package price, a duration, and a list of treatment areas.
 *
 * ONE source of truth (data/service-packages.json) feeds BOTH:
 *   1. the on-page pricing table  (components/PackageTable.astro)
 *   2. the booking-form area picker (components/BookingRequest.astro)
 *
 * so the prices a client sees and the choice they request can never drift.
 * An individual area may override its tier's package price (e.g. Brazilian is a
 * Large area but its 6-session package is $800, not the $600 Large default).
 */
import raw from '@/data/service-packages.json';

/** A single bookable treatment area, with its tier defaults resolved/overridden. */
export interface PackageArea {
  name: string;
  size: string;        // 'Small' | 'Medium' | 'Large' | 'XLarge'
  sizeLabel: string;   // 'Small Area'
  perSession: number;  // dollars
  packagePrice: number;// dollars, full 6-session series
  duration: string;    // '15 min'
}

export interface PackageTier {
  size: string;
  label: string;
  perSession: number;
  packagePrice: number;
  duration: string;
  areas: PackageArea[];
}

export interface ServicePackages {
  slug: string;        // page slug, e.g. 'laser-hair-removal'
  service: string;     // the booking service_interest value, e.g. 'Laser Hair Removal'
  sessions: number;    // sessions in a package, e.g. 6
  plan: string;        // 'X sessions, 4-6 weeks apart'
  note?: string;
  tiers: PackageTier[];
}

// Shape of an area entry as authored in JSON: a bare name or an override object.
type RawArea = string | { name: string; perSession?: number; packagePrice?: number; duration?: string };
interface RawTier {
  size: string; label: string; perSession: number; packagePrice: number; duration: string; areas: RawArea[];
}
interface RawService {
  service: string; sessions: number; plan: string; note?: string; tiers: RawTier[];
}

/** Format a whole-dollar amount as US currency, e.g. 1200 -> "$1,200". */
export function usd(n: number): string {
  return '$' + n.toLocaleString('en-US');
}

function normalizeTier(t: RawTier): PackageTier {
  const areas: PackageArea[] = t.areas.map((a) => {
    const o = typeof a === 'string' ? { name: a } : a;
    return {
      name: o.name,
      size: t.size,
      sizeLabel: t.label,
      perSession: o.perSession ?? t.perSession,
      packagePrice: o.packagePrice ?? t.packagePrice,
      duration: o.duration ?? t.duration,
    };
  });
  return { size: t.size, label: t.label, perSession: t.perSession, packagePrice: t.packagePrice, duration: t.duration, areas };
}

function normalize(slug: string, s: RawService): ServicePackages {
  return { slug, service: s.service, sessions: s.sessions, plan: s.plan, note: s.note, tiers: s.tiers.map(normalizeTier) };
}

const BY_SLUG: Record<string, ServicePackages> = Object.fromEntries(
  Object.entries(raw as Record<string, RawService>).map(([slug, s]) => [slug, normalize(slug, s)])
);

/** Every service that is sold as multiple packages. */
export function allPackageServices(): ServicePackages[] {
  return Object.values(BY_SLUG);
}

/** Look up a multi-package service by its page slug (e.g. 'laser-hair-removal'). */
export function getPackagesBySlug(slug: string): ServicePackages | null {
  return BY_SLUG[slug] ?? null;
}

/** Look up by the booking service_interest name (e.g. 'Laser Hair Removal'). */
export function getPackagesByService(service: string): ServicePackages | null {
  return allPackageServices().find((p) => p.service === service) ?? null;
}

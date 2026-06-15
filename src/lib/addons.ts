/**
 * addons.ts, resolves sidebar add-on data (service-addons.json) into renderable
 * items with real Astro ImageMetadata. JSON can't hold Astro image imports, so we
 * resolve filenames against an eager glob of the assets/images directory.
 *
 * getAddons(slug) → { heading, seeAllHref, items:[{name, price?, img?, alt}] } | null
 * Returns null when the service has no add-ons (sidebar block is then omitted).
 */
import type { ImageMetadata } from 'astro';
import addonsData from '@/data/service-addons.json';

const modules = import.meta.glob<{ default: ImageMetadata }>(
  '../assets/images/*.{png,jpg,jpeg,webp,avif}',
  { eager: true }
);

const byFilename: Record<string, ImageMetadata> = {};
for (const path in modules) {
  const base = path.split('/').pop();
  if (base) byFilename[base] = modules[path].default;
}

export interface SidebarAddon {
  name: string;
  price?: string;
  img?: ImageMetadata;
  alt?: string;
}
export interface AddonGroup {
  heading?: string;
  seeAllHref?: string;
  items: SidebarAddon[];
}

interface RawAddon {
  name: string;
  price?: string;
  image?: string;
  alt?: string;
}
interface RawGroup {
  heading?: string;
  seeAllHref?: string;
  items?: RawAddon[];
}

export function getAddons(slug: string): AddonGroup | null {
  const entry = (addonsData as Record<string, RawGroup>)[slug];
  if (!entry || !entry.items || entry.items.length === 0) return null;
  return {
    heading: entry.heading,
    seeAllHref: entry.seeAllHref,
    items: entry.items.map((it) => ({
      name: it.name,
      price: it.price,
      alt: it.alt ?? it.name,
      img: it.image ? byFilename[it.image] : undefined,
    })),
  };
}

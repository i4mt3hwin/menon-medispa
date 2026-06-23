/**
 * sales.ts — current promotional specials. ONE source of truth (data/sales.json)
 * feeds BOTH the /sale page (sale__section_1/2.astro) and the site-wide
 * SalePopup.astro, plus the booking deep-link for each offer.
 *
 * To add / change / remove a sale, edit one entry in data/sales.json: the page
 * grid, the popup, and the "Book Now" link all follow, and each Book Now lands
 * on /request-appointment pre-locked to that offer + price (so the front-desk
 * lead shows exactly which promo was clicked). Mirrors lib/packages.ts.
 *
 * The booking form accepts ANY service string (ensureOption locks + submits it)
 * and the slot grid is global, so a sale needs NO entry in services.json.
 */
import type { ImageMetadata } from 'astro';
import salesData from '@/data/sales.json';

export interface SaleWindow {
  eyebrow: string;
  heading: string;
  subtitle: string;
}

// An offer as authored in JSON. Only name/price/image are required.
interface RawOffer {
  name: string;
  price: string;
  image: string;          // filename under src/assets/images/
  imageAlt?: string;
  description?: string;
  popupOffer?: string;    // short line shown in the popup; defaults to price
  bookingLabel?: string;  // exact string locked in the form + sent to the front desk
  bookHref?: string;      // override the destination (e.g. tel:..., /consultation#options)
  ctaText?: string;       // button label; defaults to "Book Now"
  includes?: string[];    // bullet "what's included" detail (homepage + /hair flash-sale dialogs)
}
interface RawSales {
  window: SaleWindow;
  gridHeading: string;
  popupHeading: string;
  offers: RawOffer[];
}

const data = salesData as RawSales;

export const saleWindow: SaleWindow = data.window;
export const gridHeading: string = data.gridHeading;
export const popupHeading: string = data.popupHeading;

/** A sale offer with its image resolved and booking link built. */
export interface SaleOffer {
  name: string;
  price: string;
  description: string;
  image?: ImageMetadata;
  imageAlt: string;
  href: string;
  ctaText: string;
  popupOffer: string;
  includes: string[];
}

// Resolve image filenames to optimized assets. Aliases don't work inside
// import.meta.glob, so the pattern is relative to THIS file (src/lib -> src/assets).
const imageModules = import.meta.glob('../assets/images/*.{jpg,jpeg,png,webp}', {
  eager: true,
}) as Record<string, { default: ImageMetadata }>;

function resolveImage(file: string): ImageMetadata | undefined {
  const match = Object.entries(imageModules).find(([path]) => path.endsWith('/' + file));
  return match ? match[1].default : undefined;
}

function bookingHref(o: RawOffer): string {
  if (o.bookHref) return o.bookHref;
  const label = o.bookingLabel ?? `${o.name} - ${o.price}`;
  return `/request-appointment?service=${encodeURIComponent(label)}`;
}

/** Every current sale offer, normalized for the page grid and the popup. */
export function getSaleOffers(): SaleOffer[] {
  return data.offers.map((o) => ({
    name: o.name,
    price: o.price,
    description: o.description ?? '',
    image: resolveImage(o.image),
    imageAlt: o.imageAlt ?? o.name,
    href: bookingHref(o),
    ctaText: o.ctaText ?? 'Book Now',
    popupOffer: o.popupOffer ?? o.price,
    includes: o.includes ?? [],
  }));
}

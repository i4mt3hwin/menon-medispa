/**
 * glow-icons.ts, inline SVG line-icon set for Find Your Glow.
 * Shared by the page (server-rendered option cards) and the client script
 * (results). Each value is a full <svg> (24×24, stroke=currentColor) so it drops
 * into any container. Unknown keys fall back to `spark`.
 */

const S = (inner: string): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

export const icons: Record<string, string> = {
  // --- generic / concerns ---
  spark: S('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 4.5v3M20.5 6h-3"/>'),
  acne: S('<circle cx="12" cy="12" r="8"/><circle cx="10" cy="10" r="1.3"/><circle cx="15" cy="13" r="1"/><circle cx="11" cy="15" r=".8"/>'),
  aging: S('<path d="M3 8c3-2 5 2 8 0s5-2 8 0M3 13c3-2 5 2 8 0s5-2 8 0M5 18c2.5-1.5 4 1.5 7 0"/>'),
  firmness: S('<path d="M12 20V7"/><path d="M7 11l5-5 5 5"/><path d="M8 20h8"/>'),
  dullness: S('<circle cx="12" cy="12" r="4.2"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8"/>'),
  pigment: S('<circle cx="9" cy="9" r="2"/><circle cx="16" cy="11" r="1.4"/><circle cx="11" cy="16" r="1.7"/><circle cx="17" cy="16" r="1"/>'),
  redness: S('<path d="M12 3s5 4.5 5 9a5 5 0 0 1-10 0c0-1.8.8-3.4 1.6-4.6"/>'),
  texture: S('<circle cx="7" cy="7" r="1"/><circle cx="12" cy="7" r="1"/><circle cx="17" cy="7" r="1"/><circle cx="7" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="17" cy="12" r="1"/><circle cx="7" cy="17" r="1"/><circle cx="12" cy="17" r="1"/><circle cx="17" cy="17" r="1"/>'),
  dryness: S('<path d="M12 3.5C9 8 6.5 10.8 6.5 14a5.5 5.5 0 0 0 11 0c0-3.2-2.5-6-5.5-10.5z"/><path d="M10.5 14.5c0 1.2 1 2.2 2.2 2.2"/>'),
  undereye: S('<path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"/><circle cx="12" cy="12" r="2.4"/>'),
  scars: S('<path d="M5 14l3-3 2.5 2.5L14 9l2.5 2.5L20 8"/><path d="M5 18l3-3 2.5 2.5"/>'),

  // --- skin types ---
  oily: S('<path d="M12 3.5C9 8 6.5 10.8 6.5 14a5.5 5.5 0 0 0 11 0c0-3.2-2.5-6-5.5-10.5z"/><circle cx="14" cy="13" r="1"/>'),
  combination: S('<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17"/><path d="M12 7a5 5 0 0 1 0 10z" fill="currentColor" stroke="none"/>'),
  dry: S('<path d="M11 4c1.5 3 4 4 4 7a4 4 0 0 1-8 0c0-1 .3-1.9.8-2.7"/><path d="M11 20c0-3 1.5-4.5 4.5-5.5"/>'),
  normal: S('<circle cx="12" cy="12" r="8.5"/><path d="M8.5 13.5a4.5 4.5 0 0 0 7 0"/><circle cx="9.5" cy="10" r=".6" fill="currentColor"/><circle cx="14.5" cy="10" r=".6" fill="currentColor"/>'),

  // --- sensitivity ---
  shield: S('<path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/>'),
  leaf: S('<path d="M5 19c0-7 5-12 14-12 0 9-5 14-12 14"/><path d="M5 19c3-3 6-5 9-6.5"/>'),
  feather: S('<path d="M20 4C13 4 8 9 6 16l-2 4M9 15h6"/><path d="M19 5c-5 0-8 3-9 7"/>'),

  // --- lifestyle / about ---
  calendar: S('<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 9h16M9 3v4M15 3v4"/>'),
  drop: S('<path d="M12 3.5C9 8 6.5 10.8 6.5 14a5.5 5.5 0 0 0 11 0c0-3.2-2.5-6-5.5-10.5z"/>'),
  sun: S('<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.2 5.2l1.7 1.7M17.1 17.1l1.7 1.7M18.8 5.2l-1.7 1.7M6.9 17.1l-1.7 1.7"/>'),
  moon: S('<path d="M20 14.5A8 8 0 1 1 9.5 4 6.5 6.5 0 0 0 20 14.5z"/>'),

  // --- safety ---
  heart: S('<path d="M12 20S4 15 4 9.2A4.2 4.2 0 0 1 12 7a4.2 4.2 0 0 1 8 2.2C20 15 12 20 12 20z"/>'),
  pill: S('<rect x="3" y="8.5" width="18" height="7" rx="3.5"/><path d="M12 8.7v6.6"/>'),
  alert: S('<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17.2v.1"/>'),

  // --- treatments ---
  droplet: S('<path d="M12 3.5C9 8 6.5 10.8 6.5 14a5.5 5.5 0 0 0 11 0c0-3.2-2.5-6-5.5-10.5z"/><path d="M10 14a2 2 0 0 0 2 2"/>'),
  needle: S('<path d="M5 19l9-9M14 6l4 4-2 2-4-4zM12 12l-1 1 2 2 1-1"/>'),
  peel: S('<path d="M4 8l8-4 8 4-8 4z"/><path d="M4 12l8 4 8-4M4 16l8 4 8-4"/>'),
  blade: S('<path d="M14 4l6 6-9 9-3 1 1-3z"/><path d="M3 21l4-4"/>'),
  gem: S('<path d="M6 4h12l3 5-9 11L3 9z"/><path d="M3 9h18M9 4l-3 5 6 11 6-11-3-5"/>'),
  stone: S('<ellipse cx="12" cy="12" rx="8" ry="6"/><path d="M7 11c2-2 8-2 10 1"/>'),
  circle: S('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/>'),
  wave: S('<path d="M3 9c2-2 4 2 6 0s4-2 6 0 4 2 6 0M3 15c2-2 4 2 6 0s4-2 6 0 4 2 6 0"/>'),
  bubbles: S('<circle cx="9" cy="14" r="4"/><circle cx="16" cy="9" r="2.6"/><circle cx="17.5" cy="16" r="1.6"/>'),
  syringe: S('<path d="M4 20l4-4M8 16l-2-2 8-8 2 2zM12 6l4 4M14 4l6 6M15 13l-2-2"/>'),
  laser: S('<path d="M12 2v6M12 8l-3 7a3 3 0 0 0 6 0z"/><path d="M5 5l2 2M19 5l-2 2"/>'),
  target: S('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>'),

  // --- ui ---
  check: S('<path d="M5 12.5l4.5 4.5L19 7"/>'),
  arrow: S('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  refresh: S('<path d="M20 11a8 8 0 1 0-1.5 5.5"/><path d="M20 5v6h-6"/>'),
  back: S('<path d="M19 12H5M11 6l-6 6 6 6"/>'),
};

export const icon = (name?: string): string => icons[name ?? ''] ?? icons.spark;

export default icons;

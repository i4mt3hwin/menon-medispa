/**
 * glow-images.ts — real treatment photos for Find Your Glow result cards.
 * Each image is imported from the treatment's OWN page (confirmed depiction),
 * so Vite hashes/optimizes it. Treatments NOT listed here (the dynamic
 * service-page ones with no dedicated photo) fall back to the gradient aura
 * in find-your-glow.astro. Imported by the page's client <script>.
 */
import hydrafacial from '../assets/images/34ef44b50a1c.jpg';
import microneedling from '../assets/images/cebad624861f.jpg';
import chemicalPeel from '../assets/images/444eec26c889.jpg';
import dermaplaning from '../assets/images/a2e5efb60e6b.jpeg';
import acneFacial from '../assets/images/1616d1e9f4e9.png';
import vitaminC from '../assets/images/6608c4cfc0e4.png';
import glassFacial from '../assets/images/3cc130d2907a.png';
import cupping from '../assets/images/2d2699eae2a5.jpeg';
import lymphatic from '../assets/images/39875cd4ea73.png';
import botox from '../assets/images/f6d70f706248.jpg';
import juvederm from '../assets/images/8ec275b96db1.jpeg';
import clearlift from '../assets/images/5533cf5a75a8.png';
import dyevl from '../assets/images/8f23c1351be4.jpg';

export const treatmentImages: Record<string, string> = {
  hydrafacial: hydrafacial.src,
  microneedling: microneedling.src,
  'chemical-peel': chemicalPeel.src,
  dermaplaning: dermaplaning.src,
  'acne-facial': acneFacial.src,
  'vitamin-c-facial': vitaminC.src,
  'glass-facial': glassFacial.src,
  'cupping-facial': cupping.src,
  'lymphatic-facial': lymphatic.src,
  botox: botox.src,
  juvederm: juvederm.src,
  clearlift: clearlift.src,
  'dye-vl': dyevl.src,
};

export default treatmentImages;

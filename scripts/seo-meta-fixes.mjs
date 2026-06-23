/**
 * seo-meta-fixes.mjs — apply the 2026-06-22 SEO audit title/description rewrites.
 * Exact current->new string replacement per file; reports any mismatch (no silent
 * failures) so a stale entry is caught rather than skipped. Run once.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const FIX = {
  // ---- TITLES (trim to <=60, keyword+geo front, single brand suffix) ----
  'src/pages/dermaplaning-facial.astro': [
    ['Dermaplaning Facial Millburn NJ | Silky-Smooth Skin at Menon Medispa',
     'Dermaplaning Facial in Millburn, NJ | Menon Medispa'],
    ['Experience a professional dermaplaning facial in Millburn, NJ at Menon Medispa. Remove dead skin cells and peach fuzz for instantly smoother, brighter skin. Book today!',
     'Professional dermaplaning facial in Millburn, NJ. Removes dead skin and peach fuzz for instantly smoother, brighter skin. Book at Menon Medispa.'],
  ],
  'src/pages/face.astro': [
    ['Facial Treatments & Medical Aesthetics in Millburn NJ | Menon Medispa',
     'Face & Aesthetic Treatments in Millburn, NJ | Menon Medispa'],
  ],
  'src/pages/fillers-injectables.astro': [
    ['Fillers & Injectables Millburn NJ | BOTOX & Juvederm | Menon Medispa',
     'Fillers & Injectables in Millburn, NJ | Menon Medispa'],
  ],
  'src/pages/hair.astro': [
    ['Hair Restoration Millburn NJ | HydraFacial Keravive & PRP | Menon Medispa',
     'Hair Restoration in Millburn, NJ | Menon Medispa'],
  ],
  'src/pages/laser-hair-removal.astro': [
    ['Laser Hair Removal Millburn NJ | Permanent Hair Reduction | Menon Medispa',
     'Laser Hair Removal in Millburn, NJ | Menon Medispa'],
  ],
  'src/pages/sale.astro': [
    ['Sale | June Summer Specials | Menon Medispa & Wellness | Millburn, NJ',
     'Monthly Specials & Sales | Menon Medispa, Millburn NJ'],
  ],
  'src/pages/short-hills-medispa-treatments.astro': [
    ['Medispa Short Hills NJ | Menon Medispa & Wellness | Millburn, NJ',
     'Medispa Near Short Hills, NJ | Menon Medispa, Millburn'],
    ['Premier medispa near Short Hills, NJ. Botox, fillers, facials, laser treatments and more at Menon Medispa in Millburn, just 5 minutes from Short Hills Mall. Call (973) 494-8431.',
     'Medispa near Short Hills, NJ. Botox, fillers, facials, and laser treatments at Menon Medispa in Millburn, 5 minutes from Short Hills Mall. Call (973) 494-8431.'],
  ],
  'src/pages/targeted-health-solutions-iv.astro': [
    ['Targeted Health Solutions IV Therapy in Millburn NJ | Menon Medispa',
     'Targeted Health IV Therapy in Millburn, NJ | Menon Medispa'],
    ['Proactive nutritional support for your specific health journey. Specialized IV drips for pain management, heart health, prenatal care, and gut health. Book at Menon Medispa in Millburn, NJ.',
     'Specialized IV drips in Millburn, NJ for targeted health needs, from heart and gut health to prenatal support. Book at Menon Medispa.'],
  ],
  'src/pages/vascular-treatments.astro': [
    ['Vein & Vascular Treatments | Menon Medispa & Wellness | Millburn, NJ',
     'Vein & Vascular Treatments in Millburn, NJ | Menon Medispa'],
    ['Laser vein and vascular treatment in Millburn NJ. Dye-VL laser for facial spider veins, broken capillaries, rosacea, facial redness, and small leg spider veins. Book at Menon Medispa, call (973) 494-8431.',
     'Dye-VL laser vein treatment in Millburn, NJ for facial spider veins, broken capillaries, rosacea, and redness. Book at Menon Medispa: (973) 494-8431.'],
  ],
  'src/pages/find-your-glow.astro': [
    ['Find Your Glow | Skin Quiz & Treatment Finder | Menon Medispa, Millburn NJ',
     'Find Your Glow Skin Quiz | Menon Medispa, Millburn NJ'],
    ['Take the 2-minute Find Your Glow quiz for personalized treatment recommendations and an at-home skincare routine, tailored to your skin by Menon Medispa in Millburn, NJ.',
     'Take the 2-minute Find Your Glow quiz for personalized treatment and at-home skincare recommendations, tailored to your skin. Menon Medispa, Millburn NJ.'],
  ],

  // ---- DESCRIPTIONS (trim to ~150-160; drop superlatives/unverified claims) ----
  'src/pages/acne-facial.astro': [
    ["Experience our targeted 70-minute Acne Facial treatment in Millburn NJ. Medical-grade Korean skincare that clears pores, reduces breakouts, and restores your skin's natural balance.",
     'Targeted 70-minute acne facial in Millburn, NJ. Medical-grade Korean skincare that clears pores, reduces breakouts, and rebalances your skin. Book today.'],
  ],
  'src/pages/anti-aging-beauty.astro': [
    ['Rejuvenate from the inside out with our Anti-Aging & Beauty IV Therapy in Millburn NJ. Glutathione, Vitamin C, Biotin and more delivered directly for radiant skin, stronger hair, and lasting beauty.',
     'Anti-Aging & Beauty IV therapy in Millburn, NJ. Glutathione, Vitamin C, and Biotin to support radiant skin and stronger hair. Book at Menon Medispa.'],
  ],
  'src/pages/consultation.astro': [
    ['Complimentary skin consultations with a licensed esthetician. Injectables, Semaglutide, and microneedling include a $50 consult with Dr. Menon, credited toward your treatment. Custom plans for your goals. Menon Medispa, Millburn NJ.',
     'Complimentary skin consultations with a licensed esthetician in Millburn, NJ. Injectable, Semaglutide, and microneedling consults credit toward your treatment.'],
  ],
  'src/pages/glass-facial.astro': [
    ['The Glass Facial with Salmon DNA at Menon Medispa in Millburn, NJ uses regenerative PDRN to deeply hydrate and restore your skin, revealing an unparalleled luminous complexion.',
     'Glass Facial with Salmon DNA at Menon Medispa in Millburn, NJ. Regenerative PDRN deeply hydrates and restores skin for a luminous, glass-like glow.'],
  ],
  'src/pages/hydrafacial-keravive.astro': [
    ['Rejuvenate Your Scalp to Reveal Fuller, Healthier-Looking Hair. HydraFacial Keravive scalp treatment at Menon Medispa in Millburn, NJ. Book your consultation today.',
     'HydraFacial Keravive scalp treatment in Millburn, NJ. Cleanses, stimulates, and nourishes the scalp for fuller, healthier-looking hair. Book at Menon Medispa.'],
  ],
  'src/pages/immunity-support.astro': [
    ['Our Immune Support IV drips deliver a powerful blend of vitamins, antioxidants, and minerals directly to your bloodstream for 100% absorption. Recover faster, feel stronger, and maintain peak wellness. Book at Menon Medispa Millburn NJ.',
     'Immune Support IV drips in Millburn, NJ deliver vitamins, antioxidants, and minerals to help you recover faster and feel stronger. Book at Menon Medispa.'],
  ],
  'src/pages/iv-therapy-millburn-nj.astro': [
    ['Boost your energy and wellness with IV Therapy at Menon Medispa in Millburn, NJ. Customized infusions for immunity, energy, recovery, anti-aging, and more. Call (973) 494-8431.',
     'IV therapy at Menon Medispa in Millburn, NJ. Customized infusions for immunity, energy, recovery, and anti-aging. Call (973) 494-8431 to book.'],
  ],
  'src/pages/job-opportunities.astro': [
    ["Menon Medispa & Wellness is looking for a motivated individual to fill our Medical Spa job opportunity. We specialize in a wide variety of non-surgical beauty treatments and only use the latest equipment. Our staff is highly trained and licensed, so you can be sure that you're in good hands.",
     'Join the Menon Medispa & Wellness team in Millburn, NJ. We hire motivated, licensed professionals for our medical spa. See current openings and apply.'],
  ],
  'src/pages/juvedermfillers.astro': [
    ['Our board-certified practitioners use FDA-approved Juvéderm fillers to restore volume, smooth wrinkles, and enhance your natural features. Natural-looking results that last up to 2 years.',
     'Juvéderm dermal fillers in Millburn, NJ restore volume, smooth wrinkles, and enhance your features with natural-looking results. Book at Menon Medispa.'],
  ],
  'src/pages/myers-cocktail-iv-therapy.astro': [
    ["Experience the original Myers' Cocktail IV therapy in Millburn NJ. The gold standard formula with Vitamin C, B-Complex, B12, and Magnesium for energy, immunity, and overall wellness.",
     "Myers' Cocktail IV therapy in Millburn, NJ. The original formula with Vitamin C, B-Complex, B12, and Magnesium for energy and immunity. Book at Menon Medispa."],
  ],
  'src/pages/nad-iv-drip-therapy.astro': [
    ['Experience the future of wellness with NAD+ IV Therapy in Millburn, NJ. Our targeted infusions promote cellular repair, boost energy, and support longevity at Menon Medispa.',
     'NAD+ IV therapy in Millburn, NJ. Targeted infusions support cellular repair, energy, and healthy aging at Menon Medispa. Book your drip today.'],
  ],
  'src/pages/online-booking.astro': [
    ['Book your treatment at Menon Medispa in Millburn, NJ. Browse our full service menu or schedule a free consultation.',
     'Book your treatment or free consultation at Menon Medispa in Millburn, NJ. Browse our full menu of facials, injectables, laser, and IV therapy.'],
  ],
  'src/pages/privacy-policy.astro': [
    ['How Menon Medispa & Wellness collects, uses, shares, and protects your personal information, including our Find Your Glow quiz, marketing emails, and website analytics.',
     'How Menon Medispa & Wellness collects, uses, and protects your personal information, including the Find Your Glow quiz, marketing emails, and analytics.'],
  ],
  'src/pages/recovery-detox.astro': [
    ['Bounce back faster with our Recovery & Detox IV Drip in Millburn, NJ. Rehydrate, replenish nutrients, and flush toxins after workouts, illness, or a night out at Menon Medispa.',
     'Recovery & Detox IV drip in Millburn, NJ. Rehydrate, replenish nutrients, and bounce back after workouts, illness, or a night out. Book at Menon Medispa.'],
  ],
  'src/pages/shipping-and-returns.astro': [
    ['Menon Medispa shipping policy, free shipping, store pickup, and return & exchange policy details.',
     'Menon Medispa & Wellness shipping and returns policy: shipping options, in-store pickup, and how to return or exchange a product. Questions? Call (973) 494-8431.'],
  ],
  'src/pages/vitamin-c-facial.astro': [
    ['Experience professional Vitamin C Facials at Menon Medispa in Millburn, NJ. Instant glow, anti-aging benefits, and safe for all skin types. Book your appointment today.',
     'Professional Vitamin C facial at Menon Medispa in Millburn, NJ. Brightens, supports collagen, and suits all skin types. Book your appointment today.'],
  ],
};

let applied = 0;
const mismatches = [];
for (const [file, pairs] of Object.entries(FIX)) {
  let s = readFileSync(file, 'utf8');
  for (const [oldStr, newStr] of pairs) {
    if (!s.includes(oldStr)) { mismatches.push(`${file}: NOT FOUND -> "${oldStr.slice(0, 60)}..."`); continue; }
    s = s.replace(oldStr, newStr);
    applied++;
  }
  writeFileSync(file, s);
}
console.log(`Applied ${applied} meta rewrites across ${Object.keys(FIX).length} files.`);
if (mismatches.length) { console.log('\nMISMATCHES (handle manually):'); mismatches.forEach((m) => console.log('  ' + m)); }
else console.log('No mismatches — every current string matched.');

/**
 * businessSchema.ts — single source for the LocalBusiness (MedicalBusiness) JSON-LD
 * node, built from site.ts (NAP, geo, hours, social). Reused on the homepage AND the
 * contact page so both carry an identical node with the stable @id (site.schemaId),
 * which lets Google merge them into one entity. Added per the 2026-06-22 SEO audit
 * (the contact page previously shipped no structured data at all).
 */
import site from '@/lib/site';

/** The MedicalBusiness/LocalBusiness entity node. `opts.image` is accepted for
 *  backward compatibility but ignored: every page emits the SAME @id, so the node
 *  must carry identical image/logo values everywhere (the business logo). */
export function buildLocalBusiness(opts: { image?: string } = {}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'MedicalBusiness',
    '@id': site.schemaId,
    name: site.legalName,
    url: `${site.url}/`,
    telephone: site.phone.schema,
    email: site.email,
    image: site.logo,
    logo: { '@type': 'ImageObject', url: site.logo },
    priceRange: site.priceRange,
    description: site.description,
    founder: { '@type': 'Person', name: site.founder },
    address: {
      '@type': 'PostalAddress',
      streetAddress: site.address.street,
      addressLocality: site.address.locality,
      addressRegion: site.address.region,
      postalCode: site.address.postalCode,
      addressCountry: site.address.country,
    },
    geo: { '@type': 'GeoCoordinates', latitude: site.geo.lat, longitude: site.geo.lng },
    areaServed: site.areaServed,
    sameAs: Object.values(site.social),
    openingHoursSpecification: site.hours.map((h) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: h.days,
      opens: h.opens,
      closes: h.closes,
    })),
  };
}

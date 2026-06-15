/**
 * serviceSchema.ts, builds the JSON-LD node array for a service page, passed to
 * BaseLayout's `jsonld` prop (same pattern as index.astro). Emits a Service /
 * MedicalProcedure node + BreadcrumbList + optional FAQPage. The FAQ array is the
 * SAME source as the on-page FaqColumn (verbatim) so accordion and schema agree.
 */
import site from '@/lib/site';

export interface SchemaFaq {
  question: string;
  answer: string; // plain text (strip HTML before passing)
}
export interface Crumb {
  name: string;
  url: string; // path or absolute
}
export interface ServiceSchemaArgs {
  name: string;
  description: string;
  url: string;                                  // path or absolute (canonical)
  image?: string;                               // path or absolute
  type?: 'Service' | 'MedicalProcedure';        // default 'Service'
  category?: string;
  breadcrumb: Crumb[];
  faqs?: SchemaFaq[];
}

const abs = (u: string): string => {
  if (u.startsWith('http')) return u;
  return `${site.url}${u.startsWith('/') ? '' : '/'}${u}`;
};

export function buildServiceSchema(a: ServiceSchemaArgs): Record<string, unknown>[] {
  const nodes: Record<string, unknown>[] = [];

  const main: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': a.type ?? 'Service',
    name: a.name,
    description: a.description,
    url: abs(a.url),
    provider: {
      '@type': 'MedicalBusiness',
      '@id': site.schemaId,
      name: site.legalName,
      telephone: site.phone.schema,
      address: {
        '@type': 'PostalAddress',
        streetAddress: site.address.street,
        addressLocality: site.address.locality,
        addressRegion: site.address.region,
        postalCode: site.address.postalCode,
        addressCountry: site.address.country,
      },
    },
    areaServed: site.areaServed,
  };
  if (a.image) main.image = abs(a.image);
  if (a.category) main.category = a.category;
  nodes.push(main);

  nodes.push({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: a.breadcrumb.map((b, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: b.name,
      item: abs(b.url),
    })),
  });

  if (a.faqs && a.faqs.length > 0) {
    nodes.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: a.faqs.map((f) => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: f.answer },
      })),
    });
  }

  return nodes;
}

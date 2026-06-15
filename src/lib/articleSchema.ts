/**
 * articleSchema.ts, builds the JSON-LD node array for a blog post, passed to
 * BaseLayout's `jsonld` prop. Emits a BlogPosting node + BreadcrumbList.
 * Mirrors serviceSchema.ts so the two stay consistent.
 */
import site from '@/lib/site';

export interface Crumb {
  name: string;
  url: string; // path or absolute
}

export interface ArticleSchemaArgs {
  title: string;
  description: string;
  url: string;            // path or absolute (canonical)
  image?: string;
  datePublished: string;  // ISO
  dateModified?: string;  // ISO; defaults to datePublished
  topicLabel?: string;
  breadcrumb: Crumb[];
}

const abs = (u: string): string => {
  if (u.startsWith('http')) return u;
  return `${site.url}${u.startsWith('/') ? '' : '/'}${u}`;
};

export function buildArticleSchema(a: ArticleSchemaArgs): Record<string, unknown>[] {
  const article: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: a.title,
    description: a.description,
    datePublished: a.datePublished,
    dateModified: a.dateModified ?? a.datePublished,
    mainEntityOfPage: { '@type': 'WebPage', '@id': abs(a.url) },
    author: { '@type': 'Organization', name: site.legalName, url: site.url },
    publisher: {
      '@type': 'Organization',
      name: site.legalName,
      logo: { '@type': 'ImageObject', url: site.logo },
    },
  };
  if (a.image) article.image = abs(a.image);
  if (a.topicLabel) article.articleSection = a.topicLabel;

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: a.breadcrumb.map((b, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: b.name,
      item: abs(b.url),
    })),
  };

  return [article, breadcrumb];
}

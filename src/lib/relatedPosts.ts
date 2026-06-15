/**
 * relatedPosts.ts, joins service-blog-map.json against blog.json to produce the
 * related posts for a service's sidebar. Unknown/typo'd blog slugs are skipped,
 * so a service with no real matches yields [] and the sidebar block is omitted.
 */
import blog from '@/data/blog.json';
import map from '@/data/service-blog-map.json';

export interface RelatedPost {
  slug: string;
  title: string;
  coverImage?: string;
}

interface BlogEntry {
  slug: string;
  title: string;
  coverImage?: string;
}

const bySlug: Record<string, BlogEntry> = {};
for (const p of blog as BlogEntry[]) bySlug[p.slug] = p;

export function getRelatedPosts(serviceSlug: string, max = 3): RelatedPost[] {
  const slugs = (map as Record<string, string[]>)[serviceSlug] ?? [];
  const out: RelatedPost[] = [];
  for (const s of slugs) {
    const p = bySlug[s];
    if (p) out.push({ slug: p.slug, title: p.title, coverImage: p.coverImage });
    if (out.length >= max) break;
  }
  return out;
}

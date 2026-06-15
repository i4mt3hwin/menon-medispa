/**
 * blog.ts, the blog domain model.
 *
 * Joins blog.json (post list), blog-bodies.json (recovered verbatim article HTML),
 * and blog-taxonomy.json (6 topics + per-post assignment) into one enriched,
 * newest-first list. Everything the post route, blog hub, and topic pages need
 * (category, read time, related posts) is derived here so pages stay declarative.
 *
 * No fabrication: titles/excerpts/dates/images are verbatim from blog.json; topic
 * labels + read time are structural metadata.
 */
import blogData from '@/data/blog.json';
import bodies from '@/data/blog-bodies.json';
import taxonomy from '@/data/blog-taxonomy.json';

export interface Topic {
  slug: string;
  label: string;
  description: string;
  reviewTag: string;
  serviceSlug: string;
  serviceLabel: string;
}

export interface Post {
  slug: string;
  title: string;
  date: string;          // ISO (firstPublished)
  excerpt: string;
  coverImage?: string;
  topic: Topic;
  readTime: number;      // minutes
}

export interface PostCard {
  slug: string;
  title: string;
  coverImage?: string;
}

const TOPICS = taxonomy.topics as Topic[];
const ASSIGN = taxonomy.assignments as Record<string, string>;
const BODIES = bodies as Record<string, string>;
const TOPIC_BY_SLUG: Record<string, Topic> = Object.fromEntries(TOPICS.map((t) => [t.slug, t]));
const FALLBACK_TOPIC = TOPICS[0];

function readTime(slug: string): number {
  const html = BODIES[slug] ?? '';
  const words = html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

interface RawPost { slug: string; title: string; firstPublished: string; excerpt: string; coverImage?: string; }

function enrich(p: RawPost): Post {
  return {
    slug: p.slug,
    title: p.title,
    date: p.firstPublished,
    excerpt: p.excerpt,
    coverImage: p.coverImage,
    topic: TOPIC_BY_SLUG[ASSIGN[p.slug]] ?? FALLBACK_TOPIC,
    readTime: readTime(p.slug),
  };
}

// blog.json is already ordered newest-first.
const ALL: Post[] = (blogData as RawPost[]).map(enrich);

export function getAllPosts(): Post[] {
  return ALL;
}

export function getPost(slug: string): Post | null {
  return ALL.find((p) => p.slug === slug) ?? null;
}

export function getTopics(): (Topic & { count: number })[] {
  return TOPICS.map((t) => ({ ...t, count: ALL.filter((p) => p.topic.slug === t.slug).length }));
}

export function getTopic(slug: string): Topic | null {
  return TOPIC_BY_SLUG[slug] ?? null;
}

export function getPostsByTopic(slug: string): Post[] {
  return ALL.filter((p) => p.topic.slug === slug);
}

/**
 * Up to `max` related posts: same topic first (newest-first), then topped up with
 * the newest posts from other topics so the sidebar always has content (CRO).
 */
export function getRelatedByTopic(slug: string, max = 3): PostCard[] {
  const cur = getPost(slug);
  if (!cur) return [];
  const same = ALL.filter((p) => p.slug !== slug && p.topic.slug === cur.topic.slug);
  const others = ALL.filter((p) => p.slug !== slug && p.topic.slug !== cur.topic.slug);
  return [...same, ...others].slice(0, max).map((p) => ({ slug: p.slug, title: p.title, coverImage: p.coverImage }));
}

export function formatDate(iso: string | undefined): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return iso;
  }
}

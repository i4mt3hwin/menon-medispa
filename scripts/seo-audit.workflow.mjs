export const meta = {
  name: 'menon-seo-audit',
  description: 'Comprehensive on-page SEO audit of all 92 Menon Medispa pages (titles, descriptions, H1s, headings, alts, schema) + cross-page strategy',
  phases: [
    { title: 'Page audits', detail: 'One agent per page-cluster: grade title/desc/H1/headings/alts/schema, propose fixes' },
    { title: 'Site-wide', detail: 'Global chrome/meta + cannibalization/internal-linking + schema/duplicate-content/geo' },
  ],
};

const BUILD = 'd:/Claude/Website Builder/Menon Medispa/menon-medispa/05-build';
const PROJ = 'd:/Claude/Website Builder/Menon Medispa/menon-medispa';
const DIST = `${BUILD}/dist`;
const SRC = `${BUILD}/src`;
const PLAN = `${PROJ}/04-architecture/page-seo-plan.csv`;
const CHROME = `${BUILD}/scripts/.seo-chrome.json`;

// ---------- shared best-practice rubric ----------
const RUBRIC = `
SEO BEST-PRACTICE RUBRIC (grade pass / warn / fail against these):

TITLE TAG
- Unique per page. ~50-60 chars ideal; hard cap ~60-65 (Google truncates ~600px). <30 = too thin.
- Primary keyword near the front. Geo modifier ("Millburn, NJ" / "near Short Hills") for local-intent pages.
- Brand at the end ("| Menon Medispa") only if space allows; never let brand push the keyword past ~60 chars.
- Compelling for CTR but NO unsubstantiated superlatives ("BEST", "#1", "TOP-RATED", "GUARANTEED", "PAINLESS").
- Should align with (not duplicate verbatim) the H1.

META DESCRIPTION
- Unique per page. ~140-160 chars ideal (mobile shows ~120, desktop ~158). <120 = under-using the snippet; >165 truncates.
- Lead with primary keyword + value prop, end with a soft CTA ("Book a consultation", "Call (973) 494-8431").
- Geo where relevant. Active voice. No keyword stuffing.

H1
- Exactly ONE per page. Contains the primary keyword. Human, descriptive, matches search intent.
- Complements the title (not an exact copy). Visible, not hidden.

HEADING HIERARCHY (H2-H6)
- No skipped levels (h2 -> h4 is a fail; h1 -> h3 is a fail). Logical nesting.
- Keyword-relevant subheads where natural. Section structure should map the page's topics.

IMAGE ALT TEXT
- Descriptive of the image content/function. Keyword where genuinely relevant, never stuffed.
- NO redundant/generic alt ("image", "photo", "Picture of a Client Who Reviewed Us", "Injection cosmetology", filename-like).
- Decorative images SHOULD be alt="" (intentional empty) — flag decorative imgs that have meaningless non-empty alt.
- Logo alt = the business name ("Menon Medispa"), not "Medispa Logo". <=125 chars. No "image of"/"picture of" prefix.

STRUCTURED DATA (JSON-LD)
- Home/Contact: MedicalBusiness/LocalBusiness with NAP, hours, geo, sameAs.
- Service pages: Service or MedicalProcedure (+ FAQPage if FAQs exist, + BreadcrumbList).
- Blog posts: BlogPosting (author, datePublished, image). Team: Person. Flag missing/under-used schema opportunities.

TECHNICAL / CRAWL
- Canonical self-referential and correct. noindex only on thin/utility/thank-you pages.
- og:title/description/image + twitter card present. og:image ideally page-specific 1200x630 (site currently defaults to the horizontal logo — flag generic OG on key pages).
- Descriptive link text (no bare "Read More"/"click here"; use aria-label or contextual text).

BRAND VOICE for any rewrite you propose: NO em dashes, NO emojis, mobile-first, NO unsubstantiated SEO/medical claims.
GEO TRUTH: the business is located in MILLBURN, NJ. Short Hills / Livingston / Summit etc. are "serving / near" areas only — never write "Menon in Short Hills".
PRESERVED note: the page-seo-plan.csv marks some titles/H1s as PRESERVED (carried from the legacy Wix site). You may still recommend improving them, but note when a value is intentionally preserved.
`;

const LIGHTHOUSE = `
CORROBORATING LIGHTHOUSE DATA (mobile, Slow 4G) — use to confirm/extend findings:
- Performance 67. LCP 9.2s (FAILING Core Web Vitals — a ranking signal), FCP 1.8s, TBT 220ms, CLS 0.
- Image delivery: ~838 KiB wasted. Oversized images served far larger than displayed (e.g. service tiles 1333x2000 shown ~658x987; testimonial avatars are 240x240 PNG shown 77x77 and NOT webp). Render-blocking CSS ~1.4s. Facebook pixel ships legacy/polyfill JS.
- Accessibility 93: heading elements not in sequentially-descending order; aria-hidden mobile-nav contains focusable descendants; no <main> landmark; image alt that is redundant text; identical links with same purpose.
- SEO 92: 4 links without descriptive text on the homepage ("Read More").
- llms.txt is missing a required H1 and contains no links.
`;

// ---------- structured output schemas ----------
const gradeEnum = { type: 'string', enum: ['pass', 'warn', 'fail'] };
const prioEnum = { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'] };

const PAGE_SCHEMA = {
  type: 'object',
  required: ['pages'],
  additionalProperties: false,
  properties: {
    pages: {
      type: 'array',
      items: {
        type: 'object',
        required: ['route', 'pageType', 'title', 'description', 'h1', 'headings', 'images', 'schema', 'priority'],
        additionalProperties: false,
        properties: {
          route: { type: 'string' },
          pageType: { type: 'string' },
          title: {
            type: 'object', required: ['current', 'len', 'grade', 'recommendation'], additionalProperties: false,
            properties: { current: { type: 'string' }, len: { type: 'integer' }, grade: gradeEnum, issues: { type: 'array', items: { type: 'string' } }, recommendation: { type: 'string' }, recommendedLen: { type: 'integer' } },
          },
          description: {
            type: 'object', required: ['current', 'len', 'grade', 'recommendation'], additionalProperties: false,
            properties: { current: { type: 'string' }, len: { type: 'integer' }, grade: gradeEnum, issues: { type: 'array', items: { type: 'string' } }, recommendation: { type: 'string' }, recommendedLen: { type: 'integer' } },
          },
          h1: {
            type: 'object', required: ['current', 'count', 'grade', 'recommendation'], additionalProperties: false,
            properties: { current: { type: 'string' }, count: { type: 'integer' }, grade: gradeEnum, issues: { type: 'array', items: { type: 'string' } }, recommendation: { type: 'string' } },
          },
          headings: {
            type: 'object', required: ['grade'], additionalProperties: false,
            properties: { grade: gradeEnum, issues: { type: 'array', items: { type: 'string' } } },
          },
          images: {
            type: 'object', required: ['grade'], additionalProperties: false,
            properties: {
              grade: gradeEnum,
              issues: { type: 'array', items: { type: 'object', required: ['alt', 'problem', 'recommendation'], additionalProperties: false, properties: { alt: { type: 'string' }, problem: { type: 'string' }, recommendation: { type: 'string' } } } },
            },
          },
          schema: {
            type: 'object', required: ['present', 'grade'], additionalProperties: false,
            properties: { present: { type: 'array', items: { type: 'string' } }, grade: gradeEnum, missing: { type: 'array', items: { type: 'string' } } },
          },
          other: { type: 'array', items: { type: 'object', required: ['issue', 'severity', 'recommendation'], additionalProperties: false, properties: { issue: { type: 'string' }, severity: prioEnum, recommendation: { type: 'string' } } } },
          priority: prioEnum,
          topFixes: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
};

const CROSS_SCHEMA = {
  type: 'object',
  required: ['findings'],
  additionalProperties: false,
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['category', 'severity', 'title', 'detail', 'recommendation'],
        additionalProperties: false,
        properties: {
          category: { type: 'string' },
          severity: prioEnum,
          title: { type: 'string' },
          detail: { type: 'string' },
          affectedRoutes: { type: 'array', items: { type: 'string' } },
          recommendation: { type: 'string' },
        },
      },
    },
  },
};

// ---------- cluster definitions ----------
const CLUSTERS = [
  { name: 'core', label: 'core/conversion', effort: 'high', desc: 'homepage, about, contact, team, consultation, memberships, find-your-glow, gift-card, jobs' },
  { name: 'face', label: 'face pillar + facials', effort: 'high', desc: 'face pillar + all facial/skin treatment pages' },
  { name: 'inject-body-hair', label: 'injectables/body/hair', effort: 'high', desc: 'body & hair pillars, botox, fillers, semaglutide, laser hair, PRP, vascular' },
  { name: 'iv', label: 'IV therapy', effort: 'high', desc: 'IV therapy pillar + all IV drip / injection / vitamin-shot pages' },
  { name: 'utility', label: 'utility/legal/conversion', effort: 'medium', desc: 'sale, booking, legal, thank-you, coming-soon (audit noindex correctness + thin content)' },
  { name: 'blog-index', label: 'blog index + topics', effort: 'medium', desc: 'blog landing + 6 category pages' },
  { name: 'posts-1', label: 'blog posts (1/4)', effort: 'medium', desc: 'blog articles batch 1' },
  { name: 'posts-2', label: 'blog posts (2/4)', effort: 'medium', desc: 'blog articles batch 2' },
  { name: 'posts-3', label: 'blog posts (3/4)', effort: 'medium', desc: 'blog articles batch 3' },
  { name: 'posts-4', label: 'blog posts (4/4)', effort: 'medium', desc: 'blog articles batch 4' },
];

function clusterPrompt(c) {
  return `You are auditing the ON-PAGE SEO of the "${c.label}" pages of the Menon Medispa & Wellness website (a medical spa in Millburn, NJ). Pages in scope: ${c.desc}.

DATA SOURCES (read these):
1. Extracted facts for YOUR pages (title/desc lengths, H1s, full heading outline, headingSkips, content-image alts, jsonld types, generic links): read the file ${BUILD}/scripts/.seo-cluster-${c.name}.json
2. The intended/planned SEO values (with PRESERVED vs DERIVED markers): grep YOUR routes in ${PLAN}
3. The RENDERED HTML for any page where you need on-page context (alt text relative to surrounding content, content depth for keyword judgment, heading placement): read ${DIST}/<file> using the "file" field from the facts JSON.
4. Source components only if you need to understand where a value comes from: ${SRC}/pages and ${SRC}/components.

Site chrome (global header/footer logo + social icons + testimonial avatars) is audited separately — IGNORE chrome images; only audit page-CONTENT images (the facts file already strips chrome into "contentImages").

${RUBRIC}
${LIGHTHOUSE}

TASK: For EVERY page in your cluster, grade title, description, H1, heading hierarchy, image alt text, and structured data against the rubric, and propose a concrete fix where the grade is warn/fail. For title/description rewrites, give the exact replacement string and its character count (recommendedLen) and keep within length limits + brand voice. Be specific and page-by-page; do not skip any page. Assign each page a priority (P0 critical … P3 nice-to-have) based on the page's traffic value (money/service pages > legal pages) and severity of issues. Return via the structured schema.`;
}

// ---------- run ----------
phase('Page audits');
const pageRuns = CLUSTERS.map((c) => () =>
  agent(clusterPrompt(c), { label: `audit:${c.name}`, phase: 'Page audits', effort: c.effort, schema: PAGE_SCHEMA })
);

phase('Site-wide');
const globalRun = () =>
  agent(
    `You are auditing the SITE-WIDE / global SEO scaffolding of the Menon Medispa website (medical spa, Millburn NJ), not individual page bodies.

READ:
- The global head/meta scaffold: ${SRC}/layouts/BaseLayout.astro
- Header & footer (logo alt, social-icon alts, nav, mobile-nav aria): ${SRC}/components/SiteHeader.astro and ${SRC}/components/SiteFooter.astro
- Global chrome image alts (appear on ~every page): ${CHROME}
- Site constants: ${SRC}/lib/site.ts
- Crawl files in ${BUILD}/dist and ${BUILD}/public: robots.txt, sitemap-index.xml, sitemap-0.xml, llms.txt, og image defaults
- Spot-check 2-3 rendered pages in ${DIST} to confirm what actually ships.

${RUBRIC}
${LIGHTHOUSE}

Audit and report findings on: (1) global meta defaults & fallbacks (title fallback, default description, default og:image being the horizontal logo instead of a 1200x630 brand card); (2) logo alt = "Medispa Logo" (should be the business name) and other chrome alts ("Picture of a Client Who Reviewed Us", social icons duplicated 3x per page); (3) mobile-nav aria-hidden containing focusable links; missing <main> landmark; (4) robots.txt + sitemap correctness/coverage; (5) llms.txt missing H1 + links; (6) favicon/canonical/lang/viewport scaffold; (7) any global heading-structure or template issue. Give concrete recommendations. Return via schema.`,
    { label: 'global:chrome+meta', phase: 'Site-wide', effort: 'high', schema: CROSS_SCHEMA }
  );

const cannibalRun = () =>
  agent(
    `You are doing a CROSS-PAGE SEO strategy audit of the Menon Medispa website (medical spa, Millburn NJ). Read the compact facts for ALL 92 pages: ${BUILD}/scripts/.seo-compact.json (each entry has route, title, description, h1, outline, jsonld, internalLinks, genericLinks). Also consult ${PLAN} for intended targeting.

${RUBRIC}
${LIGHTHOUSE}

Focus on SITE-WIDE patterns (not single-page nits):
1. KEYWORD CANNIBALIZATION: multiple pages targeting the same query/intent (e.g. overlapping facial pages, botox vs fillers, /book-online vs /online-booking vs /request-appointment vs /consultation, /hair pillar vs PRP hair, /short-hills-medispa-treatments vs the real service pages). Identify clusters competing for the same term and recommend canonical owner / differentiation / consolidation.
2. TITLE & META PATTERN CONSISTENCY across the site (brand suffix usage, geo modifier usage, length distribution — 36 titles exceed 60 chars, 34 descriptions are under 120). Recommend a consistent template per page type.
3. INTERNAL LINKING: thin interlinking, pillar->service and service->pillar coverage, "Read More" generic anchors on blog cards, orphan pages.
4. URL / INDEXATION: pages that should arguably be noindex or consolidated.
Return concrete, prioritized findings via schema.`,
    { label: 'cross:cannibalization+linking', phase: 'Site-wide', effort: 'high', schema: CROSS_SCHEMA }
  );

const schemaRun = () =>
  agent(
    `You are auditing STRUCTURED DATA strategy, DUPLICATE CONTENT, and GEO consistency across the Menon Medispa website (medical spa, Millburn NJ). Read the compact facts for ALL 92 pages: ${BUILD}/scripts/.seo-compact.json (jsonld types per page are listed). Spot-check raw JSON-LD in rendered HTML under ${DIST} for completeness, and ${SRC}/lib/site.ts for NAP.

${RUBRIC}
${LIGHTHOUSE}

Focus on:
1. STRUCTURED DATA COVERAGE & QUALITY: 16 indexable pages have NO JSON-LD (incl /about, /contact, /meet-the-team, /memberships, /find-your-glow). Which need schema and what type? Are existing Service/MedicalProcedure/FAQPage/BreadcrumbList/BlogPosting/MedicalBusiness nodes complete (required props, valid values, @id, sameAs, aggregateRating only if real)? Flag any invalid or risky markup (e.g. fake reviews, unsubstantiated medical claims in schema).
2. DUPLICATE CONTENT: two blog posts ship as "-1" duplicates with identical meta (lymphatic-drainage-massage & QWO). Recommend canonical/redirect/consolidation. Any other near-duplicates?
3. GEO CONSISTENCY: business is in Millburn NJ. Flag any title/desc/H1 that misattributes the location (e.g. "in Short Hills") vs correctly using "serving/near". Note /short-hills-medispa-treatments framing.
4. NAP consistency between site.ts and schema output.
Return concrete, prioritized findings via schema.`,
    { label: 'cross:schema+duplicate+geo', phase: 'Site-wide', effort: 'high', schema: CROSS_SCHEMA }
  );

// Page audits + site-wide all run concurrently (one barrier), then return everything for synthesis.
const all = await parallel([...pageRuns, globalRun, cannibalRun, schemaRun]);

const pageResults = all.slice(0, CLUSTERS.length).filter(Boolean);
const [globalRes, cannibalRes, schemaRes] = all.slice(CLUSTERS.length);

const pages = pageResults.flatMap((r) => (r && r.pages) ? r.pages : []);
const siteWide = {
  global: (globalRes && globalRes.findings) || [],
  cannibalization: (cannibalRes && cannibalRes.findings) || [],
  schema: (schemaRes && schemaRes.findings) || [],
};

log(`Audited ${pages.length} pages; site-wide findings: ${siteWide.global.length + siteWide.cannibalization.length + siteWide.schema.length}`);

return { pages, siteWide, clustersReturned: pageResults.length, clustersTotal: CLUSTERS.length };

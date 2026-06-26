# CLAUDE.md — Ad landing pages (`get.menonmedispa.com`)

Guidance for building/editing pages in this `landing/` app. This is a **second, self-contained Astro
app** (separate build, separate Cloudflare Pages project `menon-medispa-lp` → `get.menonmedispa.com`)
for Google/Meta ad traffic. Header-free, `noindex`. It does NOT share the main site's build or routes.

**Build + deploy (separate from the main site):**
```sh
cd landing && npm run build && npx wrangler pages deploy dist --project-name=menon-medispa-lp --branch=main
```

## The one thing that must never break: ad attribution

Every lead must carry its **Google Ads click id** so WhatConverts can attribute it to Paid Search and
push the conversion back to Google Ads. This is the part that's easy to silently drop. The rules:

**1. All leads POST to the main site's API, cross-origin.**
Forms send JSON to `https://www.menonmedispa.com/api/lead` (CORS-allowlisted in the main app's
`functions/api/lead.js`). That one endpoint is the single intake: D1 + Resend emails + WhatConverts +
lead manager. Do not add per-page lead tracking that duplicates it (e.g. a GTM-side WhatConverts lead
tag → double-counts).

**2. Two things ride along with every lead, captured first-touch:**
- **UTMs** → `localStorage.menonUtm`
- **Google Ads click ids** `gclid` / `gbraid` / `wbraid` → `localStorage.menonClickIds`

They're captured by an inline `<head>` script that reads the URL params (with a `_gcl_aw` cookie
fallback for `gclid`) on landing, first-touch wins. The form handler then folds **both** into the POST
body.

**3. Why the body/URL and NOT cookies — the core constraint:**
These pages are a **different origin** (`get.` vs `www.`). Cookies and `localStorage` do **not** cross
that boundary, so the gclid can only reach the main site by travelling in:
- the **POST body** (pages with their own form), or
- the **URL** of the "Book" deep-link (pages that hand off to the main booking site).

Relying on the shared `_gcl_aw` cookie alone is unreliable — always carry it explicitly.

**4. Server side (already handled in the main app's `functions/api/lead.js`, for context):**
WhatConverts displays **only the `lead_source`/`lead_medium` we send** — the `gclid` field does NOT set
the dashboard source. So `lead.js` labels any lead carrying a click id as `google` / `cpc` (= Paid
Search); otherwise it passes the captured UTMs. The gclid is also stored in the D1 `leads` table.

## Building a NEW landing page — the checklist

**Strongly prefer the shared layout `src/layouts/LandingPage.astro`.** If you use it, you inherit all of
this for free: the first-touch UTM + click-id capture, the form handler that folds them into the body,
and the deep-link rewriter. Then your page just needs ONE of:
- a **form** with `data-lead-form` (its inputs' `name` attrs map 1:1 to `/api/lead`: `name`, `email`,
  `phone`, `service_interest`, `message`, `type`, `consent_email[_text]`, honeypot `company_website`), or
- a **"Book" link** to `https://www.menonmedispa.com/request-appointment?service=...` — the layout's
  `rewriteBookingLinks()` automatically appends the captured gclid to it.

**If a page is STANDALONE (does NOT use `LandingPage.astro`) — e.g. `pages/botox/` — you MUST replicate
three things, or attribution silently breaks (this exact trap hit the $189 botox page):**
1. the first-touch capture script (`menonUtm` **and** `menonClickIds`, incl. the `_gcl_aw` fallback),
2. the form `collect()` that folds `menonUtm` **and** `menonClickIds` into the POST body,
3. if it has "Book" deep-links, the `rewriteBookingLinks()` logic.
Copy these verbatim from `LandingPage.astro` — keep them in sync.

**Each landing page also keeps its own ad-conversion events** (GTM `lead_submit`/`form_submit`, Meta
`CompleteRegistration`, GA4 `generate_lead`) fired on form success. The page's GTM/Meta/GA stack
(`GTM-MSMM2PHT`, Meta Pixel, WhatConverts script) loads in the layout `<head>`.

## Page types currently in this app
- **Own form** (gclid in body): `laser-hair-removal`, `treatments`, and standalone `botox` ($189).
- **Deep-link** to the main booking site (gclid appended to the URL): `acne-facial`,
  `chemical-peel-facial`, `dermaplaning-facial`, `hydrafacial`.

## Testing a new page's attribution (avoid the traps that produce false negatives)
1. Use an **Incognito window** (or clear `menonUtm` + `menonClickIds` on the SAME origin first) —
   `localStorage` is per-origin and stale first-touch values leak otherwise.
2. Land with `?gclid=TEST-x`. For a deep-link page, click "Book" and confirm the destination URL now
   contains `&gclid=TEST-x`.
3. Submit with a **unique, valid email** (Gmail plus-tag: `you+wc1@gmail.com`, bump the number each
   test). Never use junk like `phone: test` — WhatConverts rejects an invalid phone and hides
   duplicates under its "Unique" filter, so the lead "vanishes" even though the pipeline worked.
4. Verify: the lead lands in D1 with the gclid
   (`wrangler d1 execute menon-medispa-leads --remote --command "SELECT created_at,name,gclid FROM leads ORDER BY created_at DESC LIMIT 1"`)
   and shows in WhatConverts (Date=Today, **All** leads, search the email) as **google / cpc**.
5. A **fake** gclid validates the dashboard label only. The conversion pushed back to Google Ads needs a
   **real** click id to match — only real ad traffic proves that final hop.

# Monthly Specials runbook

How to swap the medspa's monthly specials. The whole thing is **one data file**. You do not touch
any page, component, or the booking form.

## The one rule

`sales.json` is the single source of truth. Edit it and everything follows automatically:

- the homepage **Monthly Specials** band (`src/pages/index.astro`)
- the site-wide **popup** (`src/components/SalePopup.astro`)
- the **`/sale`** page grid + its SEO meta (`src/pages/sale.astro`)
- each offer's **"Book Now"** deep-link into `/request-appointment`

No offer needs an entry in `services.json`. The booking form accepts ANY `bookingLabel` string,
locks it on screen, and sends it to the front desk so they see exactly which promo was clicked.

## The staging ritual (how we do it without going live early)

To prepare next month's specials without changing the live site, we draft into a sibling file:

- **`sales.next.json`** = next month's specials, staged and ready. The site does NOT read this file,
  so editing it has zero effect on production. (`sales.ts` only imports `sales.json`.)
- **Going live = promote it:** copy `sales.next.json` over `sales.json`, then build + deploy.

So the monthly cadence is:

1. Drop next month's content into `sales.next.json` (use this guide).
2. When it's time, say **"go live for <Month> specials"** and it gets promoted + deployed.

`sales.next.json` is a normal copy of the `sales.json` shape, so anything below applies to both.

## File shape

```jsonc
{
  "window":       { "eyebrow": "...", "heading": "July Summer Specials", "subtitle": "Valid from July 1 - July 31 2026" },
  "gridHeading":  "Explore Our Current Specials",   // heading above the /sale grid
  "popupHeading": "This Month's Specials",           // title inside the popup
  "offers":       [ /* one object per special, see template */ ]
}
```

- `window` (eyebrow / heading / subtitle) renders the header on the **/sale** page and feeds the
  `/sale` SEO description. **Update the heading + subtitle every month** (month name + date range).
- `gridHeading` and `popupHeading` rarely change.

## Offer fields

| Field          | Required | What it does |
|----------------|----------|--------------|
| `name`         | **yes**  | Card title on all three surfaces. |
| `price`        | **yes**  | Bold price on the homepage + /sale card. (The popup shows `popupOffer` instead.) Free-form string, e.g. `"$400 / session"` or `"Buy 3, Get 1 Free"`. |
| `image`        | **yes**  | Filename only, must exist in `src/assets/images/`. See Images below. |
| `imageAlt`     | no       | Alt text. Defaults to `name`. |
| `description`  | no       | One-line pitch on the /sale card. |
| `popupOffer`   | no       | Short line under the name in the popup, e.g. `"$800 value for $400"`. Defaults to `price`. |
| `bookingLabel` | no       | The exact string locked into the booking form and sent to the front desk. Defaults to `"{name} - {price}"`. Make it self-explanatory, e.g. `"PRP Hair Restoration - $400/session (July Special, $800 value)"`. |
| `bookHref`     | no       | Override the destination entirely (e.g. `"tel:+1..."`, `"/consultation#options"`). Skip it for normal offers. |
| `ctaText`      | no       | Button label. Defaults to `"Book Now"`. |
| `includes`     | no       | Bullet list of what's included, shown on the homepage + /sale card. Keep to 3 short lines. |

## Copy-paste offer template

```json
{
  "name": "Offer Name",
  "price": "$000",
  "image": "filename-in-assets-images.jpg",
  "imageAlt": "Short description, <Month> special at Menon Medispa",
  "description": "One short sentence that sells it.",
  "popupOffer": "$000 value for $000",
  "bookingLabel": "Offer Name - $000 (<Month> Special)",
  "includes": [
    "Line one",
    "Line two",
    "Line three"
  ]
}
```

## Images

- Put the file in `src/assets/images/` and reference the **filename only** (e.g. `"foo.webp"`).
- **Reuse, don't re-upload.** If a special maps to a service we already have, point `image` at that
  service page's existing hero (already optimized, already cached). The July set does exactly this:
  PRP → `61235f21d512.jpeg`, ClearLift → `5533cf5a75a8.webp`, NAD+/Peptides → `f5915ad94d9a.webp`.
- For a brand-new image: cards crop **landscape 4:3**, the popup crops an **84px square** (center the
  subject). Aim for ~1200-1600px on the long side. The homepage band and popup serve the source file
  as-is (plain `<img>`, no auto-resize), so optimize first: `node _optimize-images.mjs` (longest side
  capped at 2000, recompresses in place, backs up the original to `_img-backup/`). Match the existing
  `.jpg`/`.webp` formats; avoid heavy PNGs for photos.

## Voice (these are client-facing)

- No em dashes, no emojis, mobile-first, short lines.
- **Never fabricate** a price or a service the spa does not offer. Prices come from the owner.
- **No unsubstantiated medical claims.** Keep benefits to what the matching service page already
  says. (Example: we describe the NAD+ / glutathione shot as "cellular energy and antioxidant
  support," not as treating any condition.)

## Go live

```sh
# from this folder's repo root (05-build/)
cp src/data/sales.next.json src/data/sales.json   # promote the staged month
npm run build                                      # validates JSON + resolves images
node _shot-qa.mjs / /sale                           # visual QA: homepage band + /sale grid
npx wrangler pages deploy dist --project-name=menon-medispa --branch=main
```

`--branch=main` is the only branch that serves the live domain. Any other branch is a Preview URL
that will NOT update the site. After deploy, open `https://www.menonmedispa.com/sale` and the
homepage, confirm all offers show, and click each **Book Now** to confirm it lands on
`/request-appointment` pre-locked to the right promo label.

## Roll back

The previous month is in git history. `git checkout <prev-commit> -- src/data/sales.json`, rebuild,
redeploy.

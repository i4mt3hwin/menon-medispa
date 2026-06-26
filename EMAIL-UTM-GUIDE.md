# Email UTM Tracking Guide — Menon Medispa

How to tag links in marketing emails so a booking that starts from an email gets attributed back to
that email. Grounded in 2026 UTM/GA4 best practice and tailored to how this site already tracks leads.

Last updated: 2026-06-23.

---

## The one rule to remember

- **Tag MARKETING emails** on every link: the welcome email, newsletters, monthly-specials blasts,
  re-engagement/win-back sends.
- **Do NOT campaign-tag TRANSACTIONAL emails**: the booking-request confirmation and the contact
  confirmation. They are receipts, not a marketing source, and tagging them pollutes your campaign
  reports. (If you ever need to track a link inside one, give it its own `utm_source=appointment_confirmation`,
  never `utm_source=newsletter`, so it stays out of campaign data.)

---

## The five parameters

| Parameter | What to put | Notes |
|---|---|---|
| `utm_source` | The email program / list: `welcome`, `newsletter`, `reengagement` | The audience, **not** the tool. Never `utm_source=resend`. |
| `utm_medium` | Always the literal word `email` | GA4 only files a click under the **Email** channel when medium is exactly `email`. `newsletter`, `e-blast`, etc. fall into "Unassigned". |
| `utm_campaign` | `topic_month_year`, lowercase, **unique per send** | So each email's bookings are separable. The always-on welcome uses a stable `welcome_evergreen` (no per-send date). |
| `utm_content` | The per-link placement: `hero_button`, `book_button`, `sale_button`, `glow_button`, `footer_cta` | The **only** param that changes between links in the same email. Keep `source/medium/campaign` identical across every link in one send. |
| `utm_term` | Leave blank for email | It is for paid-search keywords, not email. |

---

## Master value list (keep these consistent forever)

Rename nothing mid-stream — `newsletter` and `news-letter` (or `Newsletter`) become two permanent,
split rows in your reports.

- **Sources:** `welcome` · `newsletter` · `reengagement`
- **Campaign examples:** `welcome_evergreen` · `specials_jul_2026` · `botox_aug_2026` · `reengage_aug_2026`
- **Content examples:** `hero_button` · `body_link` · `book_button` · `sale_button` · `glow_button` · `footer_cta`

Lowercase everything. No spaces, `&`, `?`, `%`, or `#` in values — use `_` or `-`. Keep values to 2–4 words.

---

## Copy-paste examples

**Monthly-specials newsletter** (vary only `utm_content` between links in the same email):
```
https://www.menonmedispa.com/sale/?utm_source=newsletter&utm_medium=email&utm_campaign=specials_jul_2026&utm_content=hero_button
https://www.menonmedispa.com/sale/?utm_source=newsletter&utm_medium=email&utm_campaign=specials_jul_2026&utm_content=footer_cta
https://www.menonmedispa.com/request-appointment/?utm_source=newsletter&utm_medium=email&utm_campaign=specials_jul_2026&utm_content=book_button
```

**Re-engagement / win-back blast:**
```
https://www.menonmedispa.com/request-appointment/?utm_source=reengagement&utm_medium=email&utm_campaign=reengage_aug_2026&utm_content=book_button
```

**Welcome email** (already tagged automatically in the site code — listed here for reference):
```
https://www.menonmedispa.com/request-appointment/?utm_source=welcome&utm_medium=email&utm_campaign=welcome_evergreen&utm_content=book_button
https://www.menonmedispa.com/sale/?utm_source=welcome&utm_medium=email&utm_campaign=welcome_evergreen&utm_content=sale_button
https://www.menonmedispa.com/find-your-glow/?utm_source=welcome&utm_medium=email&utm_campaign=welcome_evergreen&utm_content=glow_button
```

---

## Don'ts

- **No PII in a UTM.** Never put a name, email, phone, lead id, or subscriber id in a parameter. It
  leaks into URLs, analytics, and server logs, and violates Google's policy. Personalization tokens
  stay in the email body/subject only.
- **Don't double-tag.** If Resend's click-tracking is on (it rewrites links for click stats), confirm
  it preserves your full query string to the final landing URL. Don't also let a second tool append
  its own UTMs, or you get `utm_source=newsletter&utm_source=resend` and analytics reads only the first.
- **Don't tag internal site-to-site links.** UTMs belong only on the email → site entry link. A tagged
  link between two pages on the site starts a fresh analytics session and overwrites the real email credit.
- **Don't campaign-tag the transactional confirmations** (booking/contact receipts).

---

## How this flows at Menon (the capture side is already built)

1. Someone clicks a tagged link in an email and lands on the site (e.g. `/sale/?utm_source=newsletter...`).
2. The site stashes those UTMs first-touch (`BaseLayout` → `localStorage.menonUtm`).
3. When they later submit a booking, `leadForm.ts` writes those UTMs onto the lead row in D1 — so the
   **booking auto-attributes to the email**, even if they booked on a different page later.
4. The lead's `utm_source` + `utm_campaign` are also written as Resend audience contact properties for
   later segmenting.
5. GA4 (via GTM) credits the tagged session for the `lead_submit` conversion.

**One caveat to know:** the lead store is **first-touch** (the earliest source in that browser wins and is
never overwritten), while GA4 session attribution is **last-click**. So for someone who first arrived from
Google/Instagram and clicked the email later, your D1 lead columns will credit the original source while
GA4 credits the email. Both are "correct" under their own model — email will simply look stronger in GA4
than in your own lead data. Just be consistent about which you are quoting.

---

## Verify before any real send

Send a Resend test to yourself, click a tagged link, and confirm the `utm_source` / `utm_medium` /
`utm_campaign` values survive all the way to the landing URL in your address bar, and that the visit
shows under the **Email** channel in GA4 Realtime. Re-check roughly monthly for typos, case variants,
or unexpected "Direct/Unassigned" spikes.

---

## Status

- **Welcome email** (sent from the site code, `functions/api/lead.js` → `withUtm()`): tagged
  automatically with `utm_source=welcome` / `utm_campaign=welcome_evergreen`. Nothing to do.
- **Newsletters / specials / re-engagement broadcasts** (composed in Resend): tag by hand per send
  using this guide.
- **Booking & contact confirmations:** intentionally left untagged (transactional).

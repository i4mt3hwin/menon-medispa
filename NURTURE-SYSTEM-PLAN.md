# Lead Nurture System — Build Plan (Menon Medispa)

Forward-looking design for the service-aware, multi-channel lead nurture. **Not built yet** — this is
the spec to pick up later. The welcome email (already live) is step one and the reference implementation.

Last updated: 2026-06-23. Companion plan: `C:\Users\kcd17\.claude\plans\question-eventually-i-calm-shamir.md`.

---

## Goal

When a new lead comes in, walk them toward a booking with **service-specific** emails (a Botox inquiry
gets Botox content, a laser inquiry gets laser content). If staff convert them and set an appointment,
**switch tracks** from "let's get you in" to "let's get you excited and prepped for what you booked."
Channel-aware so SMS (Twilio) slots in later without rework.

---

## Architecture

**Front Desk is the brain. Resend delivers email. Twilio delivers SMS (later).**

- **Front Desk** (`D:\Claude\Menon Front Desk`, Express / Azure SQL / Microsoft Graph) is the only system
  that knows lead status, the service of interest, whether they converted, and the appointment date/time.
  So it owns enrollment and the track logic. It already has a lead pipeline (New → Contacted → Follow-up →
  Converted), a background job scheduler (`jobs/leadManagerSync.js` runs every 30 min), and email infra.
- **Resend** delivers the marketing/relationship emails (from the `news.menonmedispa.com` subdomain, same
  as the welcome + broadcasts). Use Resend **scheduled sends** (`scheduled_at`) for date-relative emails and
  optionally Resend **Automations** for the standardized pre-conversion track.
- **Twilio** (future) delivers SMS for reminders/nudges, gated on the SMS consent already captured.

**Model every step as a channel-agnostic "touch":** `{ step, channel: 'email' | 'sms', template, offset }`.
The orchestrator picks the channel per step from the lead's consent (email opt-in → Resend, SMS opt-in →
Twilio) and the content type (reminders suit SMS, rich content suits email). This is the key SMS-ready
abstraction — build it channel-agnostic from day one even while only email is wired.

---

## The two tracks

### Track A — pre-conversion, service-aware "let's get you in"
Lead is in Front Desk, not yet converted. Service-flavored sequence. Cadence (medspa-proven, see Research):

| When | Touch | Notes |
|---|---|---|
| Day 0 | Instant acknowledgment | Already exists (booking/contact confirmation). |
| ~Day 2 (48h) | **Welcome** | Already built + live. Warm intro from Dr. Menon. |
| ~Day 3 | Treatment info | About the *specific* service they asked about. |
| ~Day 5 | Social proof | Review / before-after for that service (reuse `reviews.json`). |
| ~Day 10 | Soft offer | Limited-time consult incentive or "this week" booking prompt. |
| ~Day 21 | "Still interested?" | Final check-in, then drop to the long-term newsletter list. |

~5-6 touches, 80/20 value-to-ask, under 300 words each, send Tue–Thu mid-morning / early-afternoon local.
**Branch by service category** (see mapping below). **Enroll** when the lead lands; **unenroll** on conversion.

Implementation options: Resend **Automations** (one automation branching on a `service_category` contact
property, or one per category) OR Front-Desk-driven scheduled sends. Automations = less code; scheduled
sends = more control. Either works.

### Track B — post-conversion, appointment-relative "get excited + prepped"
Staff set the lead to Converted with a date/time. Front Desk schedules sends **relative to the appointment**
(so this is best as Front-Desk-orchestrated `scheduled_at`, since timing varies per booking):

| When | Touch | Notes |
|---|---|---|
| On booking | Confirmation + anticipation | "You're booked — here's what to look forward to." |
| ~7 days before | Build excitement | Service-specific: what to expect from their Botox/laser/etc. |
| 48h before | Confirm / reschedule | Easy confirm + reschedule link. **SMS-suited** once Twilio is in. |
| Morning of | Directions + prep | Service-specific prep instructions. **SMS-suited.** |
| 1–2h before (optional) | "We're ready for you" | Positive anticipation. |

One clear confirmation cuts no-shows ~40%; reminder sequences up to ~50%. **Entering Track B cancels Track A.**

---

## Service → category mapping

Map `service_interest` → a category, then pick that category's copy. Suggested categories:
- `injectables` (Botox, Dysport, fillers, Juvederm)
- `laser` (laser hair removal, laser facials, Dye-VL)
- `skin` (HydraFacial, facials, chemical peel, microneedling, dermaplaning)
- `body` (Semaglutide / weight, body treatments)
- `iv` (IV therapy, vitamin shots)
- `other` / `unknown` → generic nurture

Reuse the existing category logic from `src/lib/services.ts` / `src/lib/consult.ts` as a starting point.

---

## State model (per lead)

A `nurture_state` record (in Front Desk's DB, or D1 if built there):
```
lead_id, email, phone,
service_category,
track            -- 'A' | 'B' | 'none'
step             -- current step index
status           -- 'active' | 'converted' | 'unsubscribed' | 'completed' | 'dropped'
converted        -- bool
appt_datetime    -- set when staff convert (drives Track B timing)
next_send_at,
last_channel     -- 'email' | 'sms'
created_at, updated_at
```

---

## Prerequisites / decisions before building

1. **Lead routing into Front Desk (the main fork).** Today the website forwards leads (dormant) to the
   **Content Engine** lead manager (`D:\Claude\Social Media Tool`), and Front Desk pulls from **WhatConverts**.
   The nurture can't be Front-Desk-driven until website leads (with email, phone, service, consent) reliably
   land in Front Desk. Pick one: point the website's `maybeForwardLead` at Front Desk, have Front Desk ingest
   the website endpoint, or reconcile via WhatConverts. **This is the first thing to settle.**
2. **Conversion + appointment hook in Front Desk.** When staff set status = Converted with a date/time, fire
   an action that (a) unenrolls Track A and (b) schedules Track B relative to the appointment.
3. **Service → category map + per-category, per-channel copy** (Track A and Track B).
4. **Suppression + opt-out.** Reuse the `email_suppression` pattern (already built for the welcome). Add SMS
   STOP/HELP handling when Twilio is added.

---

## What's already built that this leverages

- **Welcome email = the reference implementation.** `functions/api/lead.js` → `maybeScheduleWelcome()` shows
  the pattern: Resend `scheduled_at`, once-ever dedup (`welcome_log`), suppression check + in-window cancel
  (`email_suppression`, `unsubscribe.js`), and `withUtm()` link tagging. Copy this shape for nurture sends.
- **Lead capture (NON-PHI):** name/email/phone, `service_interest`, `utm_*`, and **both consents** —
  `consent_email` and `consent_sms` are already logged to `consent_log` (TCPA-grade), so the SMS opt-in
  plumbing is half there.
- **UTM attribution:** first-touch capture → lead record; tag nurture links per `EMAIL-UTM-GUIDE.md`
  (use `utm_source=nurture` or per-track sources). A nurture-sourced booking auto-attributes.
- **Provider-safe testimonials:** `src/data/reviews.json` + `getReviews` for the social-proof touch.

---

## Suggested build order

1. **Foundation:** settle lead routing into Front Desk (#1 above) + create the `nurture_state` table +
   the service→category map.
2. **Track A, email-only:** enroll new non-converted leads, send the service-specific sequence via Resend
   (Automations or scheduled sends), unenroll on conversion. Ship + measure.
3. **Track B, email-only:** on the conversion+appointment hook, cancel Track A and schedule the
   appointment-countdown sequence. Ship + measure no-show impact.
4. **SMS via Twilio:** add a Twilio sender; route the reminder-type touches (48h-before, morning-of) to SMS
   when the lead has SMS consent. Dedup SMS by phone (analogous to `welcome_log` by email). Add STOP/HELP +
   quiet hours.

---

## Compliance

- **Keep it cosmetic/marketing, non-clinical** — even though Front Desk is the HIPAA-scoped system, nurture
  content must stay non-PHI (reference the booked *cosmetic service*, never health detail). The website's
  NON-PHI posture (`service_interest` = marketing data) carries through.
- **Email:** unsubscribe link + `List-Unsubscribe` header on every send (reuse the existing chrome).
- **SMS (Twilio):** TCPA explicit opt-in (captured), STOP/HELP keyword handling, quiet hours, identify the
  sender. Dedup/suppress like email.
- **Voice:** no em dashes, no emojis, mobile-first, no unsubstantiated medical claims.

---

## Research-backed cadence (sources)

Nurture cadence + medspa specifics: PatientNow med-spa email guide, Moxie, Smartlead, HubSpot.
Pre-appointment / no-show reduction: SchedulingKit, Acuity. (Full source list in the companion plan file.)
Welcome-series + subject/preheader best practice: Klaviyo, InboxArmy (see `EMAIL-UTM-GUIDE.md` neighbor work).

---

## Open decisions

- Resend **Automations** vs Front-Desk **scheduled sends** for Track A (recommendation: Automations for the
  standardized pre-conversion track, Front-Desk scheduled sends for the appointment-relative Track B).
- Where `nurture_state` lives (Front Desk Azure SQL vs a D1 table).
- Lead-routing approach into Front Desk (prereq #1).

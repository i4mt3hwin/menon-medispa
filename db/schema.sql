-- Menon Medispa — lead + appointment-request capture. NON-PHI ONLY.
-- HIPAA: do NOT add columns for medical history, treatment details, photos, or
-- clinical notes. See prompts/shared/reference/customer-data-best-practices.md.
CREATE TABLE IF NOT EXISTS leads (
  id               TEXT PRIMARY KEY,         -- uuid
  created_at       TEXT NOT NULL,            -- ISO 8601
  type             TEXT NOT NULL,            -- 'contact' | 'appointment_request'
  status           TEXT NOT NULL DEFAULT 'new',
  name             TEXT,
  email            TEXT,
  phone            TEXT,
  service_interest TEXT,                     -- a category the visitor selected (NOT a clinical record)
  message          TEXT,                     -- free text; form label warns "no medical details"
  preferred_date   TEXT,                     -- appointment-request only
  preferred_window TEXT,                     -- requested time, e.g. '2:30 PM' (legacy: morning/afternoon/evening)
  source_page      TEXT,
  utm_source       TEXT,
  utm_medium       TEXT,
  utm_campaign     TEXT,
  utm_term         TEXT,
  utm_content      TEXT,
  -- Google Ads click ids (NON-PHI advertising telemetry, like utm_*). gclid is the standard click id;
  -- gbraid/wbraid cover some iOS traffic. Captured first-touch on the page, sent in the /api/lead body,
  -- and also forwarded to WhatConverts. Durable own-system-of-record for paid-vs-direct attribution.
  gclid            TEXT,
  gbraid           TEXT,
  wbraid           TEXT,
  user_agent       TEXT
);

-- Consent audit trail — proof of TCPA/CAN-SPAM consent. Keep >=5 years.
CREATE TABLE IF NOT EXISTS consent_log (
  id               TEXT PRIMARY KEY,         -- uuid
  lead_id          TEXT NOT NULL,
  channel          TEXT NOT NULL,            -- 'email' | 'sms'
  granted          INTEGER NOT NULL,         -- 1 if the (unchecked-by-default) box was ticked
  consent_text     TEXT NOT NULL,            -- the EXACT checkbox copy the user saw
  consent_version  TEXT,                     -- bump when the copy changes
  ip               TEXT,                     -- cf-connecting-ip at submission
  created_at       TEXT NOT NULL,
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);

CREATE INDEX IF NOT EXISTS idx_leads_created  ON leads(created_at);
CREATE INDEX IF NOT EXISTS idx_consent_lead   ON consent_log(lead_id);

-- One-time "Welcome to Menon Medispa" email dedup. One row per email address EVER (across booking,
-- contact, and newsletter), so the welcome is sent at most once per person. NON-PHI: just the email
-- (already stored in leads) + when we first welcomed them. Written by maybeScheduleWelcome in
-- functions/api/lead.js via INSERT OR IGNORE (a fresh insert == first sighting == schedule the send).
-- scheduled_email_id holds the Resend id of the queued welcome so unsubscribe.js can CANCEL it if the
-- person opts out during its 24-48h delay window.
CREATE TABLE IF NOT EXISTS welcome_log (
  email              TEXT PRIMARY KEY,    -- lowercased
  first_seen_at      TEXT NOT NULL,       -- ISO 8601
  channel            TEXT,                -- 'booking' | 'contact' | 'newsletter' (first touch that triggered it)
  scheduled_email_id TEXT                 -- Resend email id of the queued welcome (for cancellation)
);

-- Marketing-email suppression list. An address lands here when it unsubscribes (functions/api/
-- unsubscribe.js). maybeScheduleWelcome consults it and will NEVER schedule a new welcome for a
-- suppressed address. This is required because Resend's audience "unsubscribed" flag only suppresses
-- Broadcasts, not the single scheduled sends the welcome uses. NON-PHI (just the email + when).
CREATE TABLE IF NOT EXISTS email_suppression (
  email      TEXT PRIMARY KEY,            -- lowercased
  created_at TEXT NOT NULL,               -- ISO 8601
  source     TEXT                         -- e.g. 'unsubscribe_link'
);

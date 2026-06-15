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

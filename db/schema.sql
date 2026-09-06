-- LWP CRM schema
-- Postgres, designed for Supabase free tier

-- --------------------------------------------------------------
-- Organisations: the core CRM table
-- --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organisations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  country TEXT,
  city TEXT,
  priority TEXT CHECK (priority IN ('Tier 1', 'Tier 2', 'Tier 3', '')),
  status TEXT CHECK (status IN (
    'Not started', 'Researching', 'Contact made', 'In dialogue',
    'Meeting scheduled', 'Met', 'Partner active', 'On hold', 'Not a fit', ''
  )),
  contact_name TEXT,
  contact_role TEXT,
  email TEXT,
  phone TEXT,
  website TEXT,
  why_relevant TEXT,
  source_intro_path TEXT,
  notes TEXT,
  next_action TEXT,
  next_action_date DATE,
  last_contact DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_priority ON organisations(priority);
CREATE INDEX IF NOT EXISTS idx_org_status ON organisations(status);
CREATE INDEX IF NOT EXISTS idx_org_category ON organisations(category);
CREATE INDEX IF NOT EXISTS idx_org_country ON organisations(country);
CREATE INDEX IF NOT EXISTS idx_org_next_action_date ON organisations(next_action_date);

-- --------------------------------------------------------------
-- Outreach log: every interaction, linked to an organisation
-- --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS outreach_log (
  id SERIAL PRIMARY KEY,
  organisation_id INTEGER NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  channel TEXT CHECK (channel IN ('Email', 'LinkedIn', 'Phone', 'Meeting', 'Event', 'Other', '')),
  entry_type TEXT CHECK (entry_type IN ('Outbound', 'Inbound', 'Follow-up', 'Intro', 'Materials', 'Proposal', '')),
  summary TEXT NOT NULL,
  follow_up_needed BOOLEAN DEFAULT FALSE,
  follow_up_date DATE,
  status_update TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_log_org ON outreach_log(organisation_id);
CREATE INDEX IF NOT EXISTS idx_log_date ON outreach_log(entry_date DESC);

-- --------------------------------------------------------------
-- Email templates: 7 purposes x 2 languages
-- --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_templates (
  id SERIAL PRIMARY KEY,
  purpose TEXT NOT NULL,
  language TEXT NOT NULL CHECK (language IN ('en', 'pt')),
  purpose_label TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  UNIQUE(purpose, language)
);

CREATE INDEX IF NOT EXISTS idx_tpl_lang ON email_templates(language);

-- --------------------------------------------------------------
-- Settings: key/value store for app-wide config
-- --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed known settings if they don't exist
INSERT INTO settings (key, value) VALUES
  ('last_backup_at', ''),
  ('sender_name', 'Lara'),
  ('sender_role', 'Head of Business Development'),
  ('sender_email', 'info@leadingwithppl.com'),
  ('default_language', 'en'),
  ('excel_imported', 'false')
ON CONFLICT (key) DO NOTHING;

-- --------------------------------------------------------------
-- Trigger to keep updated_at fresh on organisations edits
-- --------------------------------------------------------------
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_org_touch ON organisations;
CREATE TRIGGER trg_org_touch
BEFORE UPDATE ON organisations
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Round 4: contract import columns
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS kaufdatum        date;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS kaufbetrag       numeric;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS auftragsnummer   text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS original_produkt text;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_contacts_appt_at ON contacts(appt_at) WHERE appt_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_status  ON contacts(status);

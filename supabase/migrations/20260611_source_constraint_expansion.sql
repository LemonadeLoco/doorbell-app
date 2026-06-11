-- Expand contacts source constraint to include new lead acquisition channels
ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_source_check;
ALTER TABLE contacts ADD CONSTRAINT contacts_source_check
  CHECK (source = ANY (ARRAY[
    'tür',
    'anruf',
    'messe',
    'markt',
    'interessent',
    'aroundhome'
  ]));

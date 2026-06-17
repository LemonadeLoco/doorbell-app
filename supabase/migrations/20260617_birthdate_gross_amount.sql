-- Add birthdate to contacts, gross_amount to purchases
-- and rebuild call_queue views to expose birthdate

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS birthdate date;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS gross_amount numeric;

-- Rebuild views to include birthdate from contacts
DROP VIEW IF EXISTS call_queue CASCADE;
DROP VIEW IF EXISTS call_queue_on_cooldown CASCADE;
DROP VIEW IF EXISTS call_queue_dropped CASCADE;

CREATE VIEW call_queue AS
WITH cooldown(months) AS (
  SELECT COALESCE((SELECT value::int FROM settings WHERE key = 'call_cooldown_months'), 12)
), latest_call AS (
  SELECT DISTINCT ON (contact_id) contact_id, result AS last_result, called_at AS last_called_at
  FROM call_log ORDER BY contact_id, called_at DESC
), last_non_nr AS (
  SELECT DISTINCT ON (contact_id) contact_id, called_at AS reset_at
  FROM call_log WHERE result <> 'nicht_erreicht'
  ORDER BY contact_id, called_at DESC
), nr_streak AS (
  SELECT cl.contact_id, count(*) AS streak
  FROM call_log cl LEFT JOIN last_non_nr ln ON cl.contact_id = ln.contact_id
  WHERE cl.result = 'nicht_erreicht' AND (ln.reset_at IS NULL OR cl.called_at > ln.reset_at)
  GROUP BY cl.contact_id
), latest_purchase AS (
  SELECT DISTINCT ON (contact_id) contact_id, purchased_at AS last_purchased_at
  FROM purchases ORDER BY contact_id, purchased_at DESC
), total_purchase AS (
  SELECT contact_id, sum(amount) AS total_purchased FROM purchases GROUP BY contact_id
), attempt_count AS (
  SELECT contact_id, count(*) AS attempts FROM call_log GROUP BY contact_id
)
SELECT
  c.id, c.name, c.phone, c.phone2, c.address, c.email, c.birthdate,
  c.product, c.status, c.callback_at, c.interest, c.notes, c.source,
  c.user_id,
  lp.last_purchased_at, tp.total_purchased,
  lc.last_result, lc.last_called_at,
  COALESCE(ac.attempts, 0) AS attempt_count
FROM contacts c
CROSS JOIN cooldown cd
LEFT JOIN latest_call lc ON c.id = lc.contact_id
LEFT JOIN last_non_nr ln ON c.id = ln.contact_id
LEFT JOIN nr_streak nrs ON c.id = nrs.contact_id
LEFT JOIN latest_purchase lp ON c.id = lp.contact_id
LEFT JOIN total_purchase tp ON c.id = tp.contact_id
LEFT JOIN attempt_count ac ON c.id = ac.contact_id
WHERE
  c.source = ANY(ARRAY['anruf','bestandskunde'])
  AND c.status = ANY(ARRAY['anrufen','kontakt'])
  AND (lc.last_result IS NULL OR lc.last_result <> ALL(ARRAY['kein_interesse','falsche_nummer','kein_eigentuemer','reklamation']))
  AND COALESCE(nrs.streak, 0) < 3
  AND (c.callback_at IS NULL OR c.callback_at <= now())
  AND (lp.last_purchased_at IS NULL OR lp.last_purchased_at < CURRENT_DATE - (cd.months * INTERVAL '1 month'))
ORDER BY
  CASE WHEN c.callback_at IS NOT NULL AND c.callback_at <= now() THEN 0 ELSE 1 END,
  c.callback_at,
  CASE WHEN lc.last_called_at IS NULL THEN 0 ELSE 1 END,
  lp.last_purchased_at;

CREATE VIEW call_queue_on_cooldown AS
WITH cooldown(months) AS (
  SELECT COALESCE((SELECT value::int FROM settings WHERE key = 'call_cooldown_months'), 12)
), latest_call AS (
  SELECT DISTINCT ON (contact_id) contact_id, result AS last_result, called_at AS last_called_at
  FROM call_log ORDER BY contact_id, called_at DESC
), last_non_nr AS (
  SELECT DISTINCT ON (contact_id) contact_id, called_at AS reset_at
  FROM call_log WHERE result <> 'nicht_erreicht'
  ORDER BY contact_id, called_at DESC
), nr_streak AS (
  SELECT cl.contact_id, count(*) AS streak
  FROM call_log cl LEFT JOIN last_non_nr ln ON cl.contact_id = ln.contact_id
  WHERE cl.result = 'nicht_erreicht' AND (ln.reset_at IS NULL OR cl.called_at > ln.reset_at)
  GROUP BY cl.contact_id
), latest_purchase AS (
  SELECT DISTINCT ON (contact_id) contact_id, purchased_at AS last_purchased_at
  FROM purchases ORDER BY contact_id, purchased_at DESC
), total_purchase AS (
  SELECT contact_id, sum(amount) AS total_purchased FROM purchases GROUP BY contact_id
), attempt_count AS (
  SELECT contact_id, count(*) AS attempts FROM call_log GROUP BY contact_id
)
SELECT
  c.id, c.name, c.phone, c.phone2, c.address, c.email, c.birthdate,
  c.product, c.status, c.notes, c.interest,
  c.user_id,
  lp.last_purchased_at, tp.total_purchased,
  lc.last_result, lc.last_called_at,
  COALESCE(ac.attempts, 0) AS attempt_count,
  cd.months AS cooldown_months
FROM contacts c
CROSS JOIN cooldown cd
LEFT JOIN latest_call lc ON c.id = lc.contact_id
LEFT JOIN last_non_nr ln ON c.id = ln.contact_id
LEFT JOIN nr_streak nrs ON c.id = nrs.contact_id
LEFT JOIN latest_purchase lp ON c.id = lp.contact_id
LEFT JOIN total_purchase tp ON c.id = tp.contact_id
LEFT JOIN attempt_count ac ON c.id = ac.contact_id
WHERE
  c.source = ANY(ARRAY['anruf','bestandskunde'])
  AND c.status = ANY(ARRAY['anrufen','kontakt'])
  AND (lc.last_result IS NULL OR lc.last_result <> ALL(ARRAY['kein_interesse','falsche_nummer','kein_eigentuemer','reklamation']))
  AND COALESCE(nrs.streak, 0) < 3
  AND (c.callback_at IS NULL OR c.callback_at <= now())
  AND lp.last_purchased_at IS NOT NULL
  AND lp.last_purchased_at >= CURRENT_DATE - (cd.months * INTERVAL '1 month')
ORDER BY lp.last_purchased_at DESC;

CREATE VIEW call_queue_dropped AS
WITH latest_call AS (
  SELECT DISTINCT ON (contact_id) contact_id, result AS last_result, called_at AS last_called_at
  FROM call_log ORDER BY contact_id, called_at DESC
), last_non_nr AS (
  SELECT DISTINCT ON (contact_id) contact_id, called_at AS reset_at
  FROM call_log WHERE result <> 'nicht_erreicht'
  ORDER BY contact_id, called_at DESC
), nr_streak AS (
  SELECT cl.contact_id, count(*) AS streak
  FROM call_log cl LEFT JOIN last_non_nr ln ON cl.contact_id = ln.contact_id
  WHERE cl.result = 'nicht_erreicht' AND (ln.reset_at IS NULL OR cl.called_at > ln.reset_at)
  GROUP BY cl.contact_id
)
SELECT
  c.id, c.name, c.phone, c.phone2, c.address, c.email, c.birthdate,
  c.status, c.notes,
  c.user_id,
  lc.last_result, lc.last_called_at
FROM contacts c
LEFT JOIN latest_call lc ON c.id = lc.contact_id
LEFT JOIN nr_streak nrs ON c.id = nrs.contact_id
WHERE
  c.source = ANY(ARRAY['anruf','bestandskunde'])
  AND (
    c.status = ANY(ARRAY['kein_int','archiv','nicht_erreichbar'])
    OR lc.last_result = 'reklamation'
    OR COALESCE(nrs.streak, 0) >= 3
  )
ORDER BY lc.last_called_at DESC NULLS LAST;

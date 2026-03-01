
-- Add flexible recurrence and per-event reminder columns to agenda_items
ALTER TABLE public.agenda_items
  ADD COLUMN IF NOT EXISTS recurrence_type TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS recurrence_interval INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS recurrence_weekdays TEXT,
  ADD COLUMN IF NOT EXISTS reminder_unit TEXT DEFAULT 'minutes',
  ADD COLUMN IF NOT EXISTS reminder_value INTEGER DEFAULT 30;

-- Migrate existing recurrence data (which stored reminder info like "30min") to new columns
UPDATE public.agenda_items
SET
  reminder_unit = CASE
    WHEN recurrence ~ '^\d+min$' THEN 'minutes'
    WHEN recurrence ~ '^\d+hours$' THEN 'hours'
    WHEN recurrence ~ '^\d+days$' THEN 'days'
    ELSE 'minutes'
  END,
  reminder_value = CASE
    WHEN recurrence ~ '^\d+' THEN (regexp_match(recurrence, '(\d+)'))[1]::INTEGER
    ELSE 30
  END
WHERE recurrence IS NOT NULL AND recurrence != '';

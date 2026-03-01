
-- Remove the old every-minute schedule
SELECT cron.unschedule('send-notifications-every-minute');

-- Create new every-5-minutes schedule
SELECT cron.schedule(
  'send-notifications-every-5min',
  '*/5 * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://ydycczdidgmphrrnucim.supabase.co/functions/v1/send-notifications',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkeWNjemRpZGdtcGhycm51Y2ltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2ODQyOTAsImV4cCI6MjA4NjI2MDI5MH0.aoobdHvE-ObpB2_eGszvHZDMjnYg1BYsXTRBvI1V-WQ"}'::jsonb,
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

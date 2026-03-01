-- Add phone and auto_notify to important_events
ALTER TABLE public.important_events ADD COLUMN phone text;
ALTER TABLE public.important_events ADD COLUMN auto_notify boolean DEFAULT false;

-- Add phone and auto_notify to agenda_items
ALTER TABLE public.agenda_items ADD COLUMN phone text;
ALTER TABLE public.agenda_items ADD COLUMN auto_notify boolean DEFAULT false;

-- Create notification_settings table for global templates
CREATE TABLE public.notification_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  setting_type text NOT NULL,
  message_template text NOT NULL DEFAULT '',
  send_on_day boolean DEFAULT true,
  send_days_before integer DEFAULT 0,
  send_both boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, setting_type)
);

ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own notification_settings"
  ON public.notification_settings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create notification_log table to prevent duplicates
CREATE TABLE public.notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source_type text NOT NULL,
  source_id uuid NOT NULL,
  send_type text NOT NULL,
  event_date date NOT NULL,
  sent_at timestamptz DEFAULT now(),
  webhook_status integer,
  UNIQUE(source_id, send_type, event_date)
);

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notification_log"
  ON public.notification_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service can insert notification_log"
  ON public.notification_log FOR INSERT
  WITH CHECK (true);

-- Trigger for updated_at on notification_settings
CREATE TRIGGER update_notification_settings_updated_at
  BEFORE UPDATE ON public.notification_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
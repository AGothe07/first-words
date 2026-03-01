
-- Create user_preferences table for all settings
CREATE TABLE public.user_preferences (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  -- Financial
  default_currency text DEFAULT 'BRL',
  date_format text DEFAULT 'DD/MM/YYYY',
  financial_month_start integer DEFAULT 1,
  default_person_id uuid,
  -- Goals
  default_goal_unit text DEFAULT 'R$',
  goal_progress_mode text DEFAULT 'total',
  -- Agenda
  default_agenda_view text DEFAULT 'month',
  business_hours_start text DEFAULT '08:00',
  business_hours_end text DEFAULT '18:00',
  default_event_duration integer DEFAULT 60,
  default_event_notify boolean DEFAULT true,
  -- Appearance
  theme text DEFAULT 'light',
  primary_color text DEFAULT '#8B5CF6',
  font_size text DEFAULT 'medium',
  layout_density text DEFAULT 'comfortable',
  -- Security
  max_session_hours integer DEFAULT 24,
  -- Notifications
  notifications_enabled boolean DEFAULT true,
  birthday_send_time text DEFAULT '09:00',
  events_send_time text DEFAULT '09:00',
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own preferences" ON public.user_preferences
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Auto-create preferences on profile creation
CREATE OR REPLACE FUNCTION public.auto_create_preferences()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.user_preferences (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_auto_create_preferences
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.auto_create_preferences();

-- Update trigger
CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

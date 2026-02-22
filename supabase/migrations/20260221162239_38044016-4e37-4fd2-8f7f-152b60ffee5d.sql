
-- Módulo Agenda: compromissos e lembretes
CREATE TABLE public.agenda_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  item_type TEXT NOT NULL DEFAULT 'appointment' CHECK (item_type IN ('appointment', 'reminder', 'task')),
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE,
  all_day BOOLEAN DEFAULT false,
  recurrence TEXT CHECK (recurrence IN ('none', 'daily', 'weekly', 'monthly', 'yearly')),
  recurrence_end DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  color TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.agenda_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own agenda items" ON public.agenda_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own agenda items" ON public.agenda_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own agenda items" ON public.agenda_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own agenda items" ON public.agenda_items FOR DELETE USING (auth.uid() = user_id);

-- Módulo Metas: objetivos pessoais e financeiros
CREATE TABLE public.goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  goal_type TEXT NOT NULL DEFAULT 'personal' CHECK (goal_type IN ('personal', 'financial', 'health', 'career', 'education', 'other')),
  target_value NUMERIC,
  current_value NUMERIC DEFAULT 0,
  unit TEXT,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  target_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'cancelled')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  color TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own goals" ON public.goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own goals" ON public.goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own goals" ON public.goals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own goals" ON public.goals FOR DELETE USING (auth.uid() = user_id);

-- Checkpoints de metas (marcos intermediários)
CREATE TABLE public.goal_checkpoints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  goal_id UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  target_value NUMERIC,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  due_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.goal_checkpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own checkpoints" ON public.goal_checkpoints FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own checkpoints" ON public.goal_checkpoints FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own checkpoints" ON public.goal_checkpoints FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own checkpoints" ON public.goal_checkpoints FOR DELETE USING (auth.uid() = user_id);

-- Módulo Eventos: aniversários e datas importantes
CREATE TABLE public.important_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  person_name TEXT,
  event_type TEXT NOT NULL DEFAULT 'birthday' CHECK (event_type IN ('birthday', 'anniversary', 'holiday', 'commemoration', 'other')),
  event_date DATE NOT NULL,
  is_recurring BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.important_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own events" ON public.important_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own events" ON public.important_events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own events" ON public.important_events FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own events" ON public.important_events FOR DELETE USING (auth.uid() = user_id);

-- Mensagens automáticas vinculadas a eventos
CREATE TABLE public.auto_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  event_id UUID REFERENCES public.important_events(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  message_template TEXT NOT NULL,
  channel TEXT DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'email', 'sms', 'push')),
  send_at_offset_days INTEGER DEFAULT 0,
  send_time TIME DEFAULT '09:00:00',
  is_active BOOLEAN DEFAULT true,
  last_sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.auto_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own auto messages" ON public.auto_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own auto messages" ON public.auto_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own auto messages" ON public.auto_messages FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own auto messages" ON public.auto_messages FOR DELETE USING (auth.uid() = user_id);

-- Triggers para updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_agenda_items_updated_at BEFORE UPDATE ON public.agenda_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_goals_updated_at BEFORE UPDATE ON public.goals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_important_events_updated_at BEFORE UPDATE ON public.important_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_auto_messages_updated_at BEFORE UPDATE ON public.auto_messages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

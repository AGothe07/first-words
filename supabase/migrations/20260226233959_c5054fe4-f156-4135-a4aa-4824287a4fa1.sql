
CREATE TABLE public.whatsapp_instances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  token TEXT NOT NULL,
  instance_name TEXT,
  status TEXT NOT NULL DEFAULT 'disconnected',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own instance" ON public.whatsapp_instances FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own instance" ON public.whatsapp_instances FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own instance" ON public.whatsapp_instances FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER update_whatsapp_instances_updated_at
BEFORE UPDATE ON public.whatsapp_instances
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

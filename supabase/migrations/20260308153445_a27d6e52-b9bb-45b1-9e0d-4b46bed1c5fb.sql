
CREATE TABLE public.debts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  creditor text NOT NULL,
  total_value numeric NOT NULL,
  remaining_value numeric NOT NULL,
  installments integer NOT NULL DEFAULT 1,
  installments_paid integer NOT NULL DEFAULT 0,
  interest_rate numeric NOT NULL DEFAULT 0,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  notes text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own debts" ON public.debts
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

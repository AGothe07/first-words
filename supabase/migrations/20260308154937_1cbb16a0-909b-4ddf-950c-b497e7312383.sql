
-- Households
CREATE TABLE public.households (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL DEFAULT 'Minha Família',
  owner_user_id uuid NOT NULL,
  plan_type text NOT NULL DEFAULT 'family',
  extra_member_price numeric NOT NULL DEFAULT 20,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;

-- Household members
CREATE TABLE public.household_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  status text NOT NULL DEFAULT 'active',
  permissions jsonb NOT NULL DEFAULT '{"edit_others_transactions": false, "view_assets": true, "view_debts": true}'::jsonb,
  monthly_limit numeric,
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(household_id, user_id)
);
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;

-- Family invites
CREATE TABLE public.family_invites (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'member',
  token text NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '7 days'),
  UNIQUE(household_id, email)
);
ALTER TABLE public.family_invites ENABLE ROW LEVEL SECURITY;

-- Add household_id to transactions
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS household_id uuid REFERENCES public.households(id) ON DELETE SET NULL;

-- Security definer functions
CREATE OR REPLACE FUNCTION public.is_household_member(_user_id uuid, _household_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.household_members
    WHERE household_id = _household_id AND user_id = _user_id AND status = 'active'
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_household_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT household_id FROM public.household_members
  WHERE user_id = _user_id AND status = 'active' LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.get_household_role(_user_id uuid, _household_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.household_members
  WHERE user_id = _user_id AND household_id = _household_id AND status = 'active' LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.get_household_dashboard(_user_id uuid, _month_start date, _month_end date)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_hid uuid;
  v_members jsonb;
  v_categories jsonb;
BEGIN
  SELECT get_user_household_id(_user_id) INTO v_hid;
  IF v_hid IS NULL THEN RETURN jsonb_build_object('error', 'no_household'); END IF;

  SELECT COALESCE(jsonb_agg(m ORDER BY m.total_expense DESC), '[]'::jsonb) INTO v_members
  FROM (
    SELECT hm.user_id, hm.role,
      COALESCE(p.display_name, p.email, 'Membro') as display_name,
      COALESCE(SUM(t.amount) FILTER (WHERE t.type='expense'), 0) as total_expense,
      COALESCE(SUM(t.amount) FILTER (WHERE t.type='income'), 0) as total_income,
      COUNT(t.id) FILTER (WHERE t.type='expense') as tx_count
    FROM household_members hm
    LEFT JOIN profiles p ON p.id = hm.user_id
    LEFT JOIN transactions t ON t.user_id = hm.user_id AND t.date >= _month_start AND t.date <= _month_end
    WHERE hm.household_id = v_hid AND hm.status = 'active'
    GROUP BY hm.user_id, hm.role, p.display_name, p.email
  ) m;

  SELECT COALESCE(jsonb_agg(c ORDER BY c.total DESC), '[]'::jsonb) INTO v_categories
  FROM (
    SELECT cat.name, SUM(t.amount) as total
    FROM transactions t
    JOIN household_members hm ON hm.user_id = t.user_id AND hm.household_id = v_hid AND hm.status = 'active'
    JOIN categories cat ON cat.id = t.category_id
    WHERE t.type = 'expense' AND t.date >= _month_start AND t.date <= _month_end
    GROUP BY cat.name ORDER BY SUM(t.amount) DESC LIMIT 10
  ) c;

  RETURN jsonb_build_object(
    'household_id', v_hid,
    'members', v_members,
    'categories', v_categories,
    'combined_expense', (SELECT COALESCE(SUM((x->>'total_expense')::numeric),0) FROM jsonb_array_elements(v_members) x),
    'combined_income', (SELECT COALESCE(SUM((x->>'total_income')::numeric),0) FROM jsonb_array_elements(v_members) x),
    'member_count', (SELECT COUNT(*) FROM household_members WHERE household_id = v_hid AND status = 'active'),
    'monthly_cost', (SELECT h.extra_member_price * GREATEST((SELECT COUNT(*) FROM household_members WHERE household_id = v_hid AND status='active') - 1, 0) FROM households h WHERE h.id = v_hid)
  );
END;
$$;

-- RLS Policies
CREATE POLICY "Owner manages household" ON public.households FOR ALL TO authenticated
  USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "Members view household" ON public.households FOR SELECT TO authenticated
  USING (public.is_household_member(auth.uid(), id));

CREATE POLICY "Members view members" ON public.household_members FOR SELECT TO authenticated
  USING (public.is_household_member(auth.uid(), household_id));

CREATE POLICY "Owner insert members" ON public.household_members FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM households h WHERE h.id = household_id AND h.owner_user_id = auth.uid()) OR user_id = auth.uid());

CREATE POLICY "Owner update members" ON public.household_members FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM households h WHERE h.id = household_id AND h.owner_user_id = auth.uid()));

CREATE POLICY "Owner or self delete members" ON public.household_members FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM households h WHERE h.id = household_id AND h.owner_user_id = auth.uid()) OR user_id = auth.uid());

CREATE POLICY "Owner manages invites" ON public.family_invites FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM households h WHERE h.id = household_id AND h.owner_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM households h WHERE h.id = household_id AND h.owner_user_id = auth.uid()));

CREATE POLICY "Invited view own" ON public.family_invites FOR SELECT TO authenticated
  USING (email = (SELECT email FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Invited update own" ON public.family_invites FOR UPDATE TO authenticated
  USING (email = (SELECT email FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Household members view family tx" ON public.transactions FOR SELECT TO authenticated
  USING (household_id IS NOT NULL AND public.is_household_member(auth.uid(), household_id));

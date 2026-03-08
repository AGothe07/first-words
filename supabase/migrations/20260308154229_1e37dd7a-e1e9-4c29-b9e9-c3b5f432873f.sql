
-- Family groups
CREATE TABLE public.families (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL DEFAULT 'Minha Família',
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;

-- Family members
CREATE TABLE public.family_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  user_id uuid,
  invited_email text,
  role text NOT NULL DEFAULT 'member',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(family_id, user_id),
  UNIQUE(family_id, invited_email)
);

ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;

-- Function to check if user is in same family
CREATE OR REPLACE FUNCTION public.is_family_member(_user_id uuid, _family_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.family_members
    WHERE family_id = _family_id
      AND user_id = _user_id
      AND status = 'active'
  )
$$;

-- Function to get user's family id
CREATE OR REPLACE FUNCTION public.get_user_family_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT family_id FROM public.family_members
  WHERE user_id = _user_id AND status = 'active'
  LIMIT 1
$$;

-- Function to get family spending summary (cross-user aggregation)
CREATE OR REPLACE FUNCTION public.get_family_summary(_user_id uuid, _month_start date, _month_end date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_family_id uuid;
  v_result jsonb;
  v_members jsonb;
BEGIN
  -- Get user's family
  SELECT get_user_family_id(_user_id) INTO v_family_id;
  IF v_family_id IS NULL THEN
    RETURN jsonb_build_object('error', 'no_family');
  END IF;

  -- Get member spending
  SELECT COALESCE(jsonb_agg(member_data), '[]'::jsonb)
  INTO v_members
  FROM (
    SELECT jsonb_build_object(
      'user_id', fm.user_id,
      'display_name', COALESCE(p.display_name, p.email, 'Membro'),
      'total_expense', COALESCE((
        SELECT SUM(t.amount) FROM transactions t
        WHERE t.user_id = fm.user_id AND t.type = 'expense'
          AND t.date >= _month_start AND t.date <= _month_end
      ), 0),
      'total_income', COALESCE((
        SELECT SUM(t.amount) FROM transactions t
        WHERE t.user_id = fm.user_id AND t.type = 'income'
          AND t.date >= _month_start AND t.date <= _month_end
      ), 0)
    ) as member_data
    FROM family_members fm
    LEFT JOIN profiles p ON p.id = fm.user_id
    WHERE fm.family_id = v_family_id AND fm.status = 'active' AND fm.user_id IS NOT NULL
  ) sub;

  -- Get combined category breakdown
  SELECT jsonb_build_object(
    'family_id', v_family_id,
    'members', v_members,
    'combined_expense', COALESCE((
      SELECT SUM(t.amount) FROM transactions t
      INNER JOIN family_members fm ON fm.user_id = t.user_id AND fm.family_id = v_family_id AND fm.status = 'active'
      WHERE t.type = 'expense' AND t.date >= _month_start AND t.date <= _month_end
    ), 0),
    'combined_income', COALESCE((
      SELECT SUM(t.amount) FROM transactions t
      INNER JOIN family_members fm ON fm.user_id = t.user_id AND fm.family_id = v_family_id AND fm.status = 'active'
      WHERE t.type = 'income' AND t.date >= _month_start AND t.date <= _month_end
    ), 0),
    'top_categories', COALESCE((
      SELECT jsonb_agg(cat_data) FROM (
        SELECT jsonb_build_object('name', c.name, 'total', SUM(t.amount)) as cat_data
        FROM transactions t
        INNER JOIN family_members fm ON fm.user_id = t.user_id AND fm.family_id = v_family_id AND fm.status = 'active'
        INNER JOIN categories c ON c.id = t.category_id
        WHERE t.type = 'expense' AND t.date >= _month_start AND t.date <= _month_end
        GROUP BY c.name ORDER BY SUM(t.amount) DESC LIMIT 5
      ) sub2
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- RLS for families: members can view their family
CREATE POLICY "Family members can view family" ON public.families
  FOR SELECT TO authenticated
  USING (public.is_family_member(auth.uid(), id) OR created_by = auth.uid());

CREATE POLICY "Creator can manage family" ON public.families
  FOR ALL TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- RLS for family_members
CREATE POLICY "Members can view family members" ON public.family_members
  FOR SELECT TO authenticated
  USING (
    public.is_family_member(auth.uid(), family_id)
    OR user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM families f WHERE f.id = family_id AND f.created_by = auth.uid())
  );

CREATE POLICY "Owner can manage members" ON public.family_members
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM families f WHERE f.id = family_id AND f.created_by = auth.uid())
    OR user_id = auth.uid()
  );

CREATE POLICY "Owner can update members" ON public.family_members
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM families f WHERE f.id = family_id AND f.created_by = auth.uid())
    OR user_id = auth.uid()
  );

CREATE POLICY "Owner can delete members" ON public.family_members
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM families f WHERE f.id = family_id AND f.created_by = auth.uid())
  );

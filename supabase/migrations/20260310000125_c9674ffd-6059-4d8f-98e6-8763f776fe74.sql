
-- Add family_mode_enabled to user_preferences
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS family_mode_enabled boolean DEFAULT false;

-- Update default permissions JSON to be more granular
-- (existing rows keep their current permissions, new ones get the expanded default)
ALTER TABLE public.household_members 
  ALTER COLUMN permissions SET DEFAULT '{
    "can_create_transactions": true,
    "can_edit_own_transactions": true,
    "can_delete_own_transactions": true,
    "can_edit_others_transactions": false,
    "can_delete_others_transactions": false,
    "can_view_family_expenses": true,
    "can_view_family_income": false,
    "can_view_family_balance": false,
    "can_view_only_own_expenses": false,
    "can_view_only_own_balance": true,
    "view_assets": true,
    "view_debts": true
  }'::jsonb;

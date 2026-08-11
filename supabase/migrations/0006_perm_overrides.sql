-- =====================================================================
-- Per-user permission overrides — admin can toggle individual capabilities
-- on top of the role + access_level base. Any key present here wins.
-- Example row: { "canDeleteExpense": false, "canExportExcel": true }
-- =====================================================================

alter table public.profiles
  add column if not exists permissions_overrides jsonb not null default '{}'::jsonb;

comment on column public.profiles.permissions_overrides is
  'Per-user permission overrides. Any key in this object wins over role+access_level defaults.';

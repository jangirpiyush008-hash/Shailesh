-- =====================================================================
-- Coordinator access levels — admin can customize what each coordinator
-- can do. Admin always has full access; employees are always view-only.
-- =====================================================================

alter table public.profiles
  add column if not exists access_level text default 'full'
  check (access_level in ('full', 'edit', 'read', 'view'));

-- Backfill: employees default to 'view', everyone else to 'full'
update public.profiles set access_level = 'view'
  where role = 'employee' and (access_level is null or access_level = 'full');

update public.profiles set access_level = 'full'
  where role in ('admin', 'coordinator') and access_level is null;

comment on column public.profiles.access_level is
  'For coordinators: full/edit/read/view. Admin always full. Employee always view.';

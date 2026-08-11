-- =====================================================================
-- Add coordinator_name text field on projects so admins can select from a
-- preset list of family/team names without those people needing to sign up.
-- The coordinator_id FK still exists for when a real user IS linked.
-- =====================================================================

alter table public.projects
  add column if not exists coordinator_name text;

-- Backfill from any existing coordinator_id linkage
update public.projects p
set coordinator_name = pf.full_name
from public.profiles pf
where p.coordinator_id = pf.id
  and (p.coordinator_name is null or p.coordinator_name = '');

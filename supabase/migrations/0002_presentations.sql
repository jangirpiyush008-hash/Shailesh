-- =====================================================================
-- Phase 2 — Presentations (Gamma-powered)
-- =====================================================================

create type presentation_status as enum (
  'draft',       -- outline being edited
  'generating',  -- submitted to Gamma, waiting
  'completed',   -- ready, gamma_url populated
  'failed'       -- Gamma returned error
);

create type presentation_source as enum ('project', 'upload');

create table public.presentations (
  id                    uuid primary key default gen_random_uuid(),
  title                 text not null,
  source_type           presentation_source not null default 'project',
  source_url            text,                       -- for uploads: storage path
  project_id            uuid references public.projects(id) on delete set null,
  outline_json          jsonb not null default '{}'::jsonb,
  theme                 text default 'Chisel',
  num_cards             int default 10,
  gamma_generation_id   text,                       -- returned by Gamma
  gamma_url             text,                       -- shareable Gamma link
  pptx_url              text,                       -- direct .pptx download (if exportAs: pptx)
  status                presentation_status default 'draft',
  error_message         text,
  created_by            uuid references public.profiles(id) on delete set null,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

create index presentations_project_idx on public.presentations(project_id);
create index presentations_status_idx  on public.presentations(status);
create index presentations_created_idx on public.presentations(created_at desc);

-- ---------- RLS ----------
alter table public.presentations enable row level security;

create policy "presentations readable to team + coord/admin"
on public.presentations for select using (
  public.is_coord_or_admin()
  or created_by = auth.uid()
  or (project_id is not null and exists(
       select 1 from public.project_team pt
       where pt.project_id = presentations.project_id and pt.user_id = auth.uid()
     ))
);

create policy "coord/admin insert presentations"
on public.presentations for insert with check (public.is_coord_or_admin());

create policy "coord/admin update presentations"
on public.presentations for update using (public.is_coord_or_admin())
with check (public.is_coord_or_admin());

create policy "admins delete presentations"
on public.presentations for delete using (public.is_admin());

-- ---------- Storage bucket for uploaded Excel files ----------
insert into storage.buckets (id, name, public)
values ('presentation-sources', 'presentation-sources', false)
on conflict (id) do nothing;

create policy "authed upload presentation sources"
on storage.objects for insert
with check (bucket_id = 'presentation-sources' and auth.uid() is not null);

create policy "authed read presentation sources"
on storage.objects for select
using (bucket_id = 'presentation-sources' and auth.uid() is not null);

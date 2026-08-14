-- =====================================================================
-- WhatsApp Bot backend
--
-- Flow:
--   Coord/employee sends WA msg → webhook receives → phone lookup:
--     • unknown number → reply "Access denied. Contact your administrator."
--     • known number   → run state machine (menu → pick project → pick category → enter details)
--   Every entry saved fires a notification to all admins.
-- =====================================================================

-- ------ 1. Phone number on profiles (WhatsApp identity) ------
alter table public.profiles
  add column if not exists phone_number text,
  add column if not exists whatsapp_verified boolean default false,
  add column if not exists notify_on_updates boolean default true;  -- admin toggle for notifications

create unique index if not exists profiles_phone_number_key
  on public.profiles(phone_number)
  where phone_number is not null;

-- ------ 2. Session state (one row per active phone conversation) ------
create table if not exists public.whatsapp_sessions (
  phone_number text primary key,
  profile_id   uuid references public.profiles(id) on delete cascade,
  state        text not null default 'idle',
    -- states: idle | menu | picking_project | picking_side | picking_category |
    --         entering_description | entering_quantity | entering_unit |
    --         entering_hours | entering_rate | confirming
  context      jsonb default '{}'::jsonb,
    -- rolling scratch: { project_id, side, category_id, description, unit, quantity, hours, unit_price }
  updated_at   timestamptz default now()
);

-- ------ 3. Message log (audit trail — every inbound + outbound) ------
create table if not exists public.whatsapp_messages (
  id            uuid primary key default gen_random_uuid(),
  direction     text not null check (direction in ('inbound', 'outbound')),
  phone_number  text not null,
  profile_id    uuid references public.profiles(id) on delete set null,
  wa_message_id text,                                          -- Meta's message id
  body          text,
  parsed_intent text,                                          -- what state machine understood
  meta          jsonb default '{}'::jsonb,                     -- raw payload for debugging
  created_at    timestamptz default now()
);

create index if not exists whatsapp_messages_phone_idx   on public.whatsapp_messages(phone_number);
create index if not exists whatsapp_messages_created_idx on public.whatsapp_messages(created_at desc);

-- ------ 4. RLS ------
alter table public.whatsapp_sessions enable row level security;
alter table public.whatsapp_messages enable row level security;

-- Only admin can view — sessions + messages are ops data
create policy "admin read whatsapp sessions" on public.whatsapp_sessions
  for select using (public.is_admin());
create policy "admin manage whatsapp sessions" on public.whatsapp_sessions
  for all using (public.is_admin()) with check (public.is_admin());

create policy "admin read whatsapp messages" on public.whatsapp_messages
  for select using (public.is_admin());
create policy "admin manage whatsapp messages" on public.whatsapp_messages
  for all using (public.is_admin()) with check (public.is_admin());

-- ------ 5. Helper: lookup profile from phone ------
create or replace function public.wa_profile_from_phone(p_phone text)
returns table (id uuid, full_name text, role user_role, access_level text, notify_on_updates boolean)
language sql stable security definer set search_path = public as $$
  select id, full_name, role, access_level, notify_on_updates
  from public.profiles
  where phone_number = p_phone
  limit 1;
$$;

-- ------ 6. Helper: list projects a user is assigned to ------
create or replace function public.wa_projects_for(p_user_id uuid)
returns table (id uuid, job_card_number text, project_name text, client_name text, status project_status)
language sql stable security definer set search_path = public as $$
  select distinct p.id, p.job_card_number, p.project_name, p.client_name, p.status
  from public.projects p
  where p.status in ('active', 'pending')
    and (
      p.coordinator_id = p_user_id
      or p.created_by  = p_user_id
      or exists(select 1 from public.project_team pt where pt.project_id = p.id and pt.user_id = p_user_id)
      or exists(select 1 from public.profiles pf where pf.id = p_user_id and pf.role = 'admin')
    )
  order by p.job_card_number;
$$;

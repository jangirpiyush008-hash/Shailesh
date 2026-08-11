-- =====================================================================
-- JobCard Pro — Initial Schema
-- Roles: admin, coordinator, employee
-- Tables: profiles, projects, expense_categories, expenses, documents,
--         activity_log
-- =====================================================================

-- ---------- ENUMS ----------
create type user_role as enum ('admin', 'coordinator', 'employee');
create type project_status as enum ('active', 'pending', 'completed', 'closed', 'on_hold');
create type project_priority as enum ('low', 'medium', 'high', 'urgent');
create type expense_side as enum ('left', 'right');
create type approval_status as enum ('pending', 'approved', 'rejected');

-- ---------- PROFILES (mirrors auth.users) ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  role user_role not null default 'employee',
  avatar_url text,
  phone text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------- EXPENSE CATEGORIES ----------
create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  side expense_side not null default 'left',
  color text default '#7C3AED',
  is_active boolean default true,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- ---------- PROJECTS (one Job Card per project) ----------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  job_card_number text not null unique,   -- e.g. SBJ-JC-26-415
  project_name text not null,
  client_name text not null,
  client_address text,
  client_lpo_no text,
  client_lpo_date date,
  stand_name text,
  exhibition_name text,
  country text,
  city text,
  venue text,
  coordinator_id uuid references public.profiles(id) on delete set null,
  sales_person text,
  project_value numeric(14,2) default 0,
  estimated_profit numeric(14,2) default 0,
  status project_status default 'active',
  priority project_priority default 'medium',
  start_date date,
  end_date date,
  description text,
  instructions text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  closed_at timestamptz
);

create index projects_status_idx on public.projects(status);
create index projects_coord_idx on public.projects(coordinator_id);
create index projects_created_by_idx on public.projects(created_by);

-- ---------- PROJECT TEAM (many-to-many for employee assignment) ----------
create table public.project_team (
  project_id uuid references public.projects(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  role text default 'member',
  assigned_at timestamptz default now(),
  primary key (project_id, user_id)
);

-- ---------- EXPENSES ----------
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  category_id uuid references public.expense_categories(id) on delete set null,
  category_name text,             -- denormalized for exports
  side expense_side not null default 'left',
  entry_date date not null default current_date,
  description text not null,
  vendor text,
  unit text,                       -- Sheet, NOS, RM, SQY, Litre, Drum, PKT, Trip
  quantity numeric(14,3) default 0,
  total_hours numeric(14,2),       -- labour only
  unit_price numeric(14,2) default 0,
  amount numeric(14,2) generated always as (
    case when total_hours is not null and total_hours > 0
         then total_hours * unit_price
         else quantity * unit_price end
  ) stored,
  gst_percent numeric(5,2) default 0,
  invoice_number text,
  invoice_url text,
  receipt_url text,
  notes text,
  approval_status approval_status default 'approved',
  added_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index expenses_project_idx on public.expenses(project_id);
create index expenses_side_idx on public.expenses(project_id, side);
create index expenses_date_idx on public.expenses(entry_date);

-- ---------- DOCUMENTS ----------
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  file_name text not null,
  file_url text not null,
  file_size bigint,
  mime_type text,
  category text,                   -- invoice, po, cad, photo, contract, other
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

create index documents_project_idx on public.documents(project_id);

-- ---------- ACTIVITY LOG ----------
create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,            -- project.created, expense.added, doc.uploaded, project.closed, ...
  entity_type text,                -- project, expense, document
  entity_id uuid,
  meta jsonb,
  ip_address text,
  created_at timestamptz default now()
);

create index activity_project_idx on public.activity_log(project_id);
create index activity_user_idx on public.activity_log(user_id);
create index activity_created_idx on public.activity_log(created_at desc);

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_team enable row level security;
alter table public.expenses enable row level security;
alter table public.documents enable row level security;
alter table public.expense_categories enable row level security;
alter table public.activity_log enable row level security;

-- Helper: current user's role
create or replace function public.current_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin() returns boolean
language sql stable as $$ select public.current_role() = 'admin'; $$;

create or replace function public.is_coord_or_admin() returns boolean
language sql stable as $$ select public.current_role() in ('admin','coordinator'); $$;

-- PROFILES
create policy "profiles self read" on public.profiles for select using (auth.uid() = id or public.is_coord_or_admin());
create policy "profiles self update" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "admins manage profiles" on public.profiles for all using (public.is_admin()) with check (public.is_admin());

-- EXPENSE CATEGORIES
create policy "categories read all" on public.expense_categories for select using (auth.uid() is not null);
create policy "admins manage categories" on public.expense_categories for all using (public.is_admin()) with check (public.is_admin());

-- PROJECTS: everyone assigned can read; coord/admin can write
create policy "projects readable to team + coord/admin" on public.projects for select using (
  public.is_coord_or_admin()
  or exists(select 1 from public.project_team pt where pt.project_id = projects.id and pt.user_id = auth.uid())
  or coordinator_id = auth.uid()
  or created_by = auth.uid()
);
create policy "coord/admin insert projects" on public.projects for insert with check (public.is_coord_or_admin());
create policy "coord/admin update projects" on public.projects for update using (public.is_coord_or_admin()) with check (public.is_coord_or_admin());
create policy "admins delete projects" on public.projects for delete using (public.is_admin());

-- PROJECT TEAM
create policy "team read own membership + coord/admin" on public.project_team for select using (user_id = auth.uid() or public.is_coord_or_admin());
create policy "coord/admin manage team" on public.project_team for all using (public.is_coord_or_admin()) with check (public.is_coord_or_admin());

-- EXPENSES
create policy "expenses readable to team + coord/admin" on public.expenses for select using (
  public.is_coord_or_admin()
  or exists(select 1 from public.project_team pt where pt.project_id = expenses.project_id and pt.user_id = auth.uid())
);
create policy "team can insert expenses" on public.expenses for insert with check (
  public.is_coord_or_admin()
  or exists(select 1 from public.project_team pt where pt.project_id = expenses.project_id and pt.user_id = auth.uid())
);
create policy "coord/admin update expenses" on public.expenses for update using (public.is_coord_or_admin()) with check (public.is_coord_or_admin());
create policy "coord/admin delete expenses" on public.expenses for delete using (public.is_coord_or_admin());

-- DOCUMENTS
create policy "documents readable to team + coord/admin" on public.documents for select using (
  public.is_coord_or_admin()
  or exists(select 1 from public.project_team pt where pt.project_id = documents.project_id and pt.user_id = auth.uid())
);
create policy "team can insert documents" on public.documents for insert with check (
  public.is_coord_or_admin()
  or exists(select 1 from public.project_team pt where pt.project_id = documents.project_id and pt.user_id = auth.uid())
);
create policy "coord/admin delete documents" on public.documents for delete using (public.is_coord_or_admin());

-- ACTIVITY LOG (readable to admins + coordinators; anyone can insert)
create policy "activity read coord/admin" on public.activity_log for select using (public.is_coord_or_admin());
create policy "any authed can log activity" on public.activity_log for insert with check (auth.uid() is not null);

-- =====================================================================
-- Auto-create profile row when a new auth.users record appears
-- =====================================================================
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'employee')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- =====================================================================
-- Seed data: expense categories
-- =====================================================================
insert into public.expense_categories (name, side, color, sort_order) values
  ('Material',       'left',  '#7C3AED', 10),
  ('Transport',      'left',  '#F59E0B', 20),
  ('Food',           'left',  '#10B981', 30),
  ('Paint Work',     'left',  '#0EA5E9', 40),
  ('Electric',       'left',  '#F43F5E', 50),
  ('Graphics',       'left',  '#8B5CF6', 60),
  ('Labour',         'right', '#7C3AED', 10),
  ('Vehicle',        'right', '#F59E0B', 20),
  ('Accommodation',  'right', '#10B981', 30),
  ('Rental',         'right', '#0EA5E9', 40),
  ('Equipment',      'right', '#F43F5E', 50),
  ('Miscellaneous',  'right', '#94A3B8', 90)
on conflict (name) do nothing;

-- =====================================================================
-- Storage bucket for documents (run once in Supabase dashboard OR:)
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy "authed can upload docs" on storage.objects for insert with check (
  bucket_id = 'documents' and auth.uid() is not null
);
create policy "authed can read docs" on storage.objects for select using (
  bucket_id = 'documents' and auth.uid() is not null
);
create policy "authed can delete own docs" on storage.objects for delete using (
  bucket_id = 'documents' and auth.uid() = owner
);

-- ============================================================
--  AI Grievance System – Supabase Database Setup
--  Run this entire file in the Supabase SQL Editor:
--  Dashboard → SQL Editor → New Query → Paste → Run
-- ============================================================

-- ── 1. PROFILES TABLE (citizen users) ───────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  phone       text,
  age         int,
  gender      text,
  created_at  timestamptz default now()
);

-- Row-Level Security: users can only read/update their own profile
alter table public.profiles enable row level security;
drop policy if exists "Users manage own profile" on public.profiles;
create policy "Users manage own profile"
  on public.profiles for all
  using  (auth.uid() = id)
  with check (auth.uid() = id);

-- Auto-create profile row on new auth signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name, phone, age, gender)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'phone',
    (new.raw_user_meta_data->>'age')::int,
    new.raw_user_meta_data->>'gender'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ── 2. DEPARTMENTS TABLE ─────────────────────────────────────
create table if not exists public.departments (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  email         text not null unique,
  password_hash text not null,
  created_at    timestamptz default now()
);

-- No RLS needed (backend uses service-role key for dept queries)
alter table public.departments disable row level security;


-- ── 3. COMPLAINTS TABLE ──────────────────────────────────────
create table if not exists public.complaints (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid references auth.users(id) on delete set null,
  user_email           text,
  description          text,
  image_url            text,
  image_public_id      text,          -- Cloudinary public_id for deletion
  completion_image_url text,          -- proof photo after resolution
  lat                  double precision,
  lng                  double precision,
  category             text,
  severity             text check (severity in ('low','medium','high')),
  ai_summary           text,
  department_id        uuid references public.departments(id) on delete set null,
  department_name      text,
  status               text default 'pending'
                         check (status in ('pending','in_process','completed')),
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);

-- Row-Level Security
alter table public.complaints enable row level security;

-- Logged-in users can insert their own complaints
drop policy if exists "Users can insert complaints" on public.complaints;
create policy "Users can insert complaints"
  on public.complaints for insert
  with check (auth.uid() = user_id or user_id is null);

-- Users can view only their own complaints
drop policy if exists "Users can view own complaints" on public.complaints;
create policy "Users can view own complaints"
  on public.complaints for select
  using (auth.uid() = user_id);

-- Backend service role can do everything (uses SUPABASE_SERVICE_KEY)
-- No extra policy needed – service role bypasses RLS automatically.

-- Index for fast user-based lookups
create index if not exists complaints_user_id_idx on public.complaints(user_id);
create index if not exists complaints_dept_id_idx  on public.complaints(department_id);
create index if not exists complaints_status_idx   on public.complaints(status);


-- ── 4. SEED DEPARTMENTS (run once) ──────────────────────────
-- Passwords below are bcrypt hashes of "dept@1234"
-- Change them after first login!
insert into public.departments (name, email, password_hash) values
  ('Roads & Infrastructure', 'roads@smartcity.gov', '$2b$10$K7L1OJ45/4Y2nIvhRVpCe.FxQScByHh0ghWJGYOBUMbDGIH4Q2gR2'),
  ('Electrical Department',  'electric@smartcity.gov', '$2b$10$K7L1OJ45/4Y2nIvhRVpCe.FxQScByHh0ghWJGYOBUMbDGIH4Q2gR2'),
  ('Water Supply',           'water@smartcity.gov', '$2b$10$K7L1OJ45/4Y2nIvhRVpCe.FxQScByHh0ghWJGYOBUMbDGIH4Q2gR2'),
  ('Sanitation Department',  'sanitation@smartcity.gov', '$2b$10$K7L1OJ45/4Y2nIvhRVpCe.FxQScByHh0ghWJGYOBUMbDGIH4Q2gR2'),
  ('Municipal Corporation',  'municipal@smartcity.gov', '$2b$10$K7L1OJ45/4Y2nIvhRVpCe.FxQScByHh0ghWJGYOBUMbDGIH4Q2gR2'),
  ('Other',                  'other@smartcity.gov', '$2b$10$K7L1OJ45/4Y2nIvhRVpCe.FxQScByHh0ghWJGYOBUMbDGIH4Q2gR2')
on conflict (email) do nothing;

-- ── DONE ────────────────────────────────────────────────────
-- Tables: profiles, departments, complaints
-- All departments seeded with password: dept@1234

-- ============================================================
-- TileRoom: Consolidated Master Database Schema
-- Run this in the Supabase SQL Editor of your new project
-- Idempotent: safe to run on a fresh or existing database
-- ============================================================

-- ---------- EXTENSIONS ----------
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ---------- ENUMS ----------
do $$ begin
  create type room_upload_status as enum ('uploaded', 'analyzing', 'analyzed', 'failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type room_type as enum (
    'kitchen', 'bedroom', 'bathroom', 'living_room', 'dining_room', 'balcony', 'corridor', 'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type construction_state as enum (
    'unfinished', 'under_construction', 'finished_needs_renovation'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type surface_type as enum (
    'floor', 'wall', 'backsplash', 'shower_wall', 'step_tread', 'step_riser'
  );
exception when duplicate_object then null; end $$;

-- If surface_type already existed without the newer values, append them safely
alter type surface_type add value if not exists 'backsplash';
alter type surface_type add value if not exists 'shower_wall';
alter type surface_type add value if not exists 'step_tread';
alter type surface_type add value if not exists 'step_riser';

do $$ begin
  create type tile_category as enum ('floor', 'wall', 'both');
exception when duplicate_object then null; end $$;

do $$ begin
  create type visualization_status as enum ('pending', 'generating', 'completed', 'failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type job_status as enum ('pending', 'processing', 'completed', 'failed');
exception when duplicate_object then null; end $$;

-- ---------- UPDATED_AT TRIGGER HELPER ----------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ============================================================
-- 1. profiles
-- ============================================================
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_profiles_updated_at on profiles;
create trigger trg_profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();

alter table profiles enable row level security;

drop policy if exists "profiles_select_own" on profiles;
create policy "profiles_select_own" on profiles
  for select using (auth.uid() = id);

-- ============================================================
-- 2. projects
-- ============================================================
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_projects_user_id on projects(user_id);

drop trigger if exists trg_projects_updated_at on projects;
create trigger trg_projects_updated_at
  before update on projects
  for each row execute function set_updated_at();

alter table projects enable row level security;

drop policy if exists "projects_select_own" on projects;
create policy "projects_select_own" on projects
  for select using (auth.uid() = user_id);

-- ============================================================
-- 3. room_uploads
-- ============================================================
create table if not exists room_uploads (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  file_size_bytes integer not null check (file_size_bytes > 0 and file_size_bytes <= 10485760),
  image_width integer,
  image_height integer,
  status room_upload_status not null default 'uploaded',
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_room_uploads_project_id on room_uploads(project_id);
create index if not exists idx_room_uploads_user_id on room_uploads(user_id);
create index if not exists idx_room_uploads_status on room_uploads(status);

drop trigger if exists trg_room_uploads_updated_at on room_uploads;
create trigger trg_room_uploads_updated_at
  before update on room_uploads
  for each row execute function set_updated_at();

alter table room_uploads enable row level security;

drop policy if exists "room_uploads_select_own" on room_uploads;
create policy "room_uploads_select_own" on room_uploads
  for select using (auth.uid() = user_id);

-- ============================================================
-- 4. room_analyses
-- ============================================================
create table if not exists room_analyses (
  id uuid primary key default gen_random_uuid(),
  room_upload_id uuid not null unique references room_uploads(id) on delete cascade,
  room_type room_type not null,
  confidence numeric(3,2) not null check (confidence >= 0 and confidence <= 1),
  construction_state construction_state not null,
  floor_visible boolean not null default false,
  floor_current_material text,
  floor_condition_notes text,
  wall_visible boolean not null default false,
  wall_current_material text,
  wall_condition_notes text,
  recommended_surfaces surface_type[] not null default '{}',
  door_count integer not null default 0 check (door_count >= 0),
  window_count integer not null default 0 check (window_count >= 0),
  fixtures text[] not null default '{}',
  lighting text check (lighting in ('natural','artificial','mixed','low_light')),
  perspective text check (perspective in ('straight_on','angled','wide_angle')),
  warnings text[] not null default '{}',
  raw_ai_response jsonb not null,
  analysis_model text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_room_analyses_room_upload_id on room_analyses(room_upload_id);

alter table room_analyses enable row level security;

drop policy if exists "room_analyses_select_own" on room_analyses;
create policy "room_analyses_select_own" on room_analyses
  for select using (
    exists (
      select 1 from room_uploads ru
      where ru.id = room_upload_id and ru.user_id = auth.uid()
    )
  );

-- ============================================================
-- 5. tiles
-- ============================================================
create table if not exists tiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  sku text not null,
  name text not null,
  brand text,
  category tile_category not null,
  material text,
  finish text,
  color_family text,
  size_mm text,
  price_per_sqft numeric(10,2) check (price_per_sqft >= 0),
  currency text not null default 'INR',
  storage_path text not null,
  suitable_rooms room_type[] not null default '{}',
  is_active boolean not null default true,
  description text check (description is null or char_length(description) <= 2000),
  tile_type text,
  pattern text,
  stock_status text not null default 'in_stock' check (stock_status in ('in_stock', 'low_stock', 'out_of_stock', 'made_to_order')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tiles_owner_id on tiles(owner_id);
create unique index if not exists idx_tiles_owner_sku on tiles(owner_id, sku);
create index if not exists idx_tiles_category on tiles(category);
create index if not exists idx_tiles_is_active on tiles(is_active);
create index if not exists idx_tiles_category_active on tiles(category, is_active);

drop trigger if exists trg_tiles_updated_at on tiles;
create trigger trg_tiles_updated_at
  before update on tiles
  for each row execute function set_updated_at();

alter table tiles enable row level security;

drop policy if exists "tiles_select_own" on tiles;
create policy "tiles_select_own" on tiles
  for select using (auth.uid() = owner_id);

-- ============================================================
-- 6. tile_recommendations
-- ============================================================
create table if not exists tile_recommendations (
  id uuid primary key default gen_random_uuid(),
  room_analysis_id uuid not null references room_analyses(id) on delete cascade,
  tile_id uuid not null references tiles(id) on delete restrict,
  surface surface_type not null,
  rank integer not null check (rank >= 1),
  reason text not null default '',
  created_at timestamptz not null default now(),
  unique (room_analysis_id, tile_id, surface)
);

create index if not exists idx_tile_recs_room_analysis_id on tile_recommendations(room_analysis_id);
create index if not exists idx_tile_recs_tile_id on tile_recommendations(tile_id);

alter table tile_recommendations enable row level security;

drop policy if exists "tile_recs_select_own" on tile_recommendations;
create policy "tile_recs_select_own" on tile_recommendations
  for select using (
    exists (
      select 1 from room_analyses ra
      join room_uploads ru on ru.id = ra.room_upload_id
      where ra.id = room_analysis_id and ru.user_id = auth.uid()
    )
  );

-- ============================================================
-- 7. visualizations
-- ============================================================
create table if not exists visualizations (
  id uuid primary key default gen_random_uuid(),
  room_upload_id uuid not null references room_uploads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  tile_id uuid not null references tiles(id) on delete restrict,
  applied_surfaces surface_type[] not null check (array_length(applied_surfaces, 1) > 0),
  status visualization_status not null default 'pending',
  result_storage_path text,
  error_message text,
  requirements text check (requirements is null or char_length(requirements) <= 2000),
  room_type text check (room_type is null or room_type in ('kitchen','bedroom','bathroom','living_room','dining_room','balcony','corridor','other')),
  credits_charged integer not null default 0 check (credits_charged >= 0),
  is_public boolean not null default false,
  design jsonb,
  design_hash text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_visualizations_room_upload_id on visualizations(room_upload_id);
create index if not exists idx_visualizations_user_id on visualizations(user_id);
create index if not exists idx_visualizations_tile_id on visualizations(tile_id);
create index if not exists idx_visualizations_status on visualizations(status);
create index if not exists idx_visualizations_is_public on visualizations(is_public) where is_public = true;
create index if not exists idx_visualizations_room_design on visualizations (room_upload_id, design_hash);

alter table visualizations enable row level security;

drop policy if exists "visualizations_select_own" on visualizations;
create policy "visualizations_select_own" on visualizations
  for select using (auth.uid() = user_id);

drop policy if exists "visualizations_select_public" on visualizations;
create policy "visualizations_select_public" on visualizations
  for select using (is_public = true);

-- ============================================================
-- 8. visualization_tiles
-- ============================================================
create table if not exists visualization_tiles (
  visualization_id uuid not null references visualizations(id) on delete cascade,
  tile_id uuid not null references tiles(id) on delete restrict,
  primary key (visualization_id, tile_id)
);

create index if not exists idx_visualization_tiles_tile on visualization_tiles (tile_id);
alter table visualization_tiles enable row level security;

-- ============================================================
-- 9. generation_jobs
-- ============================================================
create table if not exists generation_jobs (
  id uuid primary key default gen_random_uuid(),
  visualization_id uuid not null references visualizations(id) on delete cascade,
  status job_status not null default 'pending',
  attempt_number integer not null default 1 check (attempt_number >= 1),
  generation_model text,
  request_payload jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (visualization_id, attempt_number)
);

create index if not exists idx_generation_jobs_visualization_id_status
  on generation_jobs(visualization_id, status);

alter table generation_jobs enable row level security;

drop policy if exists "generation_jobs_select_own" on generation_jobs;
create policy "generation_jobs_select_own" on generation_jobs
  for select using (
    exists (
      select 1 from visualizations v
      where v.id = visualization_id and v.user_id = auth.uid()
    )
  );

-- ============================================================
-- 10. credit_accounts
-- ============================================================
create table if not exists credit_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table credit_accounts enable row level security;

drop policy if exists "credit_accounts_select_own" on credit_accounts;
create policy "credit_accounts_select_own" on credit_accounts
  for select using (auth.uid() = user_id);

-- ============================================================
-- 11. credit_transactions
-- ============================================================
create table if not exists credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('purchase', 'generation_hold', 'generation_release', 'adjustment', 'promotional', 'refund')),
  amount integer not null check (amount <> 0),
  balance_after integer not null check (balance_after >= 0),
  status text not null default 'posted' check (status in ('posted', 'held', 'committed', 'released')),
  reference_type text,
  reference_id text,
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists idx_credit_tx_user_created on credit_transactions (user_id, created_at desc);
create index if not exists idx_credit_tx_reference on credit_transactions (reference_type, reference_id);
create index if not exists idx_credit_tx_held on credit_transactions (status, created_at) where status = 'held';

alter table credit_transactions enable row level security;

drop policy if exists "credit_transactions_select_own" on credit_transactions;
create policy "credit_transactions_select_own" on credit_transactions
  for select using (auth.uid() = user_id);

-- ============================================================
-- 12. credit_packages
-- ============================================================
create table if not exists credit_packages (
  id text primary key,
  name text not null,
  description text,
  credits integer not null check (credits > 0),
  bonus_credits integer not null default 0 check (bonus_credits >= 0),
  price_paise integer not null check (price_paise > 0),
  currency text not null default 'INR',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table credit_packages enable row level security;

drop policy if exists "credit_packages_select_active" on credit_packages;
create policy "credit_packages_select_active" on credit_packages
  for select using (is_active);

-- Seed packages
insert into credit_packages (id, name, description, credits, bonus_credits, price_paise, sort_order) values
  ('starter',      'Starter',      'Try the visualizer on a few rooms.',            100,    0,  49900, 1),
  ('professional', 'Professional', 'For a working showroom with regular customers.', 300,   30, 129900, 2),
  ('business',     'Business',     'High-volume showroom or multiple staff.',       1000,  150, 399900, 3)
on conflict (id) do nothing;

-- ============================================================
-- 13. payments
-- ============================================================
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'razorpay',
  provider_order_id text not null unique,
  provider_payment_id text unique,
  package_id text not null,
  package_name text not null,
  amount_paise integer not null check (amount_paise > 0),
  currency text not null default 'INR',
  credits integer not null check (credits > 0),
  status text not null default 'created' check (status in ('created', 'paid', 'failed', 'refunded')),
  failure_reason text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists idx_payments_user_created on payments (user_id, created_at desc);

alter table payments enable row level security;

drop policy if exists "payments_select_own" on payments;
create policy "payments_select_own" on payments
  for select using (auth.uid() = user_id);

-- ============================================================
-- 14. payment_events
-- ============================================================
create table if not exists payment_events (
  provider_event_id text primary key,
  provider text not null default 'razorpay',
  event_type text not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

alter table payment_events enable row level security;

-- ============================================================
-- FUNCTIONS & PROCEDURES
-- ============================================================

-- Ledger immutability trigger function
create or replace function credit_tx_guard() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.id, new.user_id, new.type, new.amount, new.balance_after, new.reference_type, new.reference_id, new.description, new.metadata, new.idempotency_key, new.created_at)
     is distinct from
     (old.id, old.user_id, old.type, old.amount, old.balance_after, old.reference_type, old.reference_id, old.description, old.metadata, old.idempotency_key, old.created_at) then
    raise exception 'credit_transactions rows are immutable';
  end if;
  if new.status is distinct from old.status and not (old.status = 'held' and new.status in ('committed', 'released')) then
    raise exception 'illegal ledger status change % -> %', old.status, new.status;
  end if;
  return new;
end $$;

drop trigger if exists trg_credit_tx_guard on credit_transactions;
create trigger trg_credit_tx_guard
  before update on credit_transactions
  for each row execute function credit_tx_guard();

-- Atomic signed balance change
create or replace function credit_apply(
  p_user uuid, p_amount integer, p_type text, p_desc text,
  p_ref_type text, p_ref_id text, p_meta jsonb, p_idem text, p_status text default 'posted'
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  acct credit_accounts%rowtype;
  existing credit_transactions%rowtype;
  tx credit_transactions%rowtype;
begin
  if p_amount = 0 then raise exception 'INVALID_AMOUNT'; end if;
  if p_idem is null or length(p_idem) = 0 then raise exception 'IDEMPOTENCY_KEY_REQUIRED'; end if;

  insert into credit_accounts (user_id) values (p_user) on conflict (user_id) do nothing;
  select * into acct from credit_accounts where user_id = p_user for update;

  select * into existing from credit_transactions where idempotency_key = p_idem;
  if found then
    if existing.user_id <> p_user then raise exception 'IDEMPOTENCY_KEY_CONFLICT'; end if;
    return jsonb_build_object('transaction_id', existing.id, 'balance', acct.balance, 'duplicate', true, 'status', existing.status);
  end if;

  if acct.balance + p_amount < 0 then raise exception 'INSUFFICIENT_CREDITS'; end if;

  update credit_accounts set balance = balance + p_amount, updated_at = now() where user_id = p_user returning * into acct;
  insert into credit_transactions (user_id, type, amount, balance_after, status, reference_type, reference_id, description, metadata, idempotency_key)
    values (p_user, p_type, p_amount, acct.balance, p_status, p_ref_type, p_ref_id, p_desc, coalesce(p_meta, '{}'::jsonb), p_idem)
    returning * into tx;
  return jsonb_build_object('transaction_id', tx.id, 'balance', acct.balance, 'duplicate', false, 'status', tx.status);
end $$;

-- Reserve credits
create or replace function credit_hold(p_user uuid, p_amount integer, p_ref_id text, p_idem text, p_meta jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  if p_amount <= 0 then raise exception 'INVALID_AMOUNT'; end if;
  return credit_apply(p_user, -p_amount, 'generation_hold', 'Visualization generation', 'visualization', p_ref_id, p_meta, p_idem, 'held');
end $$;

-- Finalize reserved credits
create or replace function credit_commit(p_hold_id uuid) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare h credit_transactions%rowtype;
begin
  select * into h from credit_transactions where id = p_hold_id and type = 'generation_hold' for update;
  if not found then raise exception 'HOLD_NOT_FOUND'; end if;
  if h.status = 'released' then raise exception 'HOLD_ALREADY_RELEASED'; end if;
  if h.status = 'held' then update credit_transactions set status = 'committed' where id = h.id; end if;
  return jsonb_build_object('hold_id', h.id, 'credits', -h.amount, 'status', 'committed');
end $$;

-- Release reserved credits on failure
create or replace function credit_release(p_hold_id uuid, p_reason text default 'Generation did not complete') returns jsonb
language plpgsql security definer set search_path = public
as $$
declare h credit_transactions%rowtype; r jsonb;
begin
  select * into h from credit_transactions where id = p_hold_id and type = 'generation_hold' for update;
  if not found then raise exception 'HOLD_NOT_FOUND'; end if;
  if h.status = 'committed' then raise exception 'HOLD_ALREADY_COMMITTED'; end if;
  if h.status = 'released' then
    return jsonb_build_object('hold_id', h.id, 'released', false, 'duplicate', true);
  end if;
  update credit_transactions set status = 'released' where id = h.id;
  r := credit_apply(h.user_id, -h.amount, 'generation_release', p_reason, 'visualization', h.reference_id,
                    jsonb_build_object('hold_id', h.id), 'release:' || h.id::text, 'posted');
  return jsonb_build_object('hold_id', h.id, 'released', true, 'credits', -h.amount, 'balance', r->'balance');
end $$;

-- Release stale holds
create or replace function credit_release_stale_holds(p_user uuid default null, p_older_than interval default interval '15 minutes') returns integer
language plpgsql security definer set search_path = public
as $$
declare h record; n integer := 0;
begin
  for h in
    select id from credit_transactions
     where type = 'generation_hold' and status = 'held' and created_at < now() - p_older_than
       and (p_user is null or user_id = p_user)
     order by created_at
  loop
    perform credit_release(h.id, 'Generation did not finish - credits returned');
    n := n + 1;
  end loop;
  return n;
end $$;

-- Mark payment paid and credit user
create or replace function payment_apply_paid(
  p_order_id text, p_payment_id text, p_amount_paise integer, p_currency text
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare p payments%rowtype; r jsonb;
begin
  select * into p from payments where provider_order_id = p_order_id for update;
  if not found then raise exception 'PAYMENT_NOT_FOUND'; end if;
  if p.status = 'paid' then
    return jsonb_build_object('payment_id', p.id, 'credited', false, 'duplicate', true, 'credits', p.credits);
  end if;
  if p.amount_paise <> p_amount_paise or upper(p.currency) <> upper(p_currency) then raise exception 'PAYMENT_AMOUNT_MISMATCH'; end if;

  update payments set status = 'paid', provider_payment_id = p_payment_id, paid_at = now(), updated_at = now(), failure_reason = null where id = p.id;
  r := credit_apply(p.user_id, p.credits, 'purchase', 'Purchased ' || p.package_name || ' credits', 'payment', p.id::text,
                    jsonb_build_object('provider_order_id', p_order_id, 'provider_payment_id', p_payment_id, 'package_id', p.package_id, 'amount_paise', p.amount_paise, 'currency', p.currency),
                    'payment:' || p_order_id, 'posted');
  return jsonb_build_object('payment_id', p.id, 'credited', true, 'duplicate', false, 'credits', p.credits, 'balance', r->'balance');
end $$;

create or replace function payment_mark_failed(p_order_id text, p_reason text) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare p payments%rowtype;
begin
  select * into p from payments where provider_order_id = p_order_id for update;
  if not found then return jsonb_build_object('updated', false); end if;
  if p.status <> 'created' then return jsonb_build_object('updated', false, 'status', p.status); end if;
  update payments set status = 'failed', failure_reason = left(coalesce(p_reason, 'Payment failed'), 300), updated_at = now() where id = p.id;
  return jsonb_build_object('updated', true);
end $$;

create or replace function payment_apply_refund(p_order_id text, p_refund_id text) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare p payments%rowtype; take integer; bal integer;
begin
  select * into p from payments where provider_order_id = p_order_id for update;
  if not found then raise exception 'PAYMENT_NOT_FOUND'; end if;
  if p.status = 'refunded' then return jsonb_build_object('duplicate', true); end if;
  if p.status <> 'paid' then return jsonb_build_object('ignored', true, 'status', p.status); end if;
  update payments set status = 'refunded', updated_at = now() where id = p.id;
  select balance into bal from credit_accounts where user_id = p.user_id for update;
  take := least(p.credits, coalesce(bal, 0));
  if take > 0 then
    perform credit_apply(p.user_id, -take, 'refund', 'Refund for ' || p.package_name || ' credits', 'payment', p.id::text,
                         jsonb_build_object('provider_refund_id', p_refund_id, 'credits_purchased', p.credits, 'credits_reclaimed', take),
                         'refund:' || p_order_id, 'posted');
  end if;
  return jsonb_build_object('refunded', true, 'credits_reclaimed', take);
end $$;

create or replace function billing_summary(p_user uuid) returns jsonb
language sql security definer set search_path = public stable
as $$
  with
  day0 as (select date_trunc('day', now() at time zone 'Asia/Kolkata') as d),
  used as (
    select
      coalesce(sum(-amount) filter (where (created_at at time zone 'Asia/Kolkata') >= (select d from day0)), 0)                        as today,
      coalesce(sum(-amount) filter (where (created_at at time zone 'Asia/Kolkata') >= (select d from day0) - interval '6 days'), 0)    as week,
      coalesce(sum(-amount) filter (where (created_at at time zone 'Asia/Kolkata') >= date_trunc('month', (select d from day0))), 0)   as month,
      coalesce(sum(-amount), 0)                                                                                                         as total,
      coalesce(sum(-amount) filter (where status = 'held'), 0)                                                                          as reserved
    from credit_transactions where user_id = p_user and type = 'generation_hold' and status in ('held', 'committed')
  ),
  gens as (
    select count(*) as total,
           count(*) filter (where status = 'completed') as completed,
           count(*) filter (where status = 'failed') as failed,
           count(*) filter (where status in ('pending', 'generating')) as in_progress
    from visualizations where user_id = p_user
  ),
  pays as (
    select count(*) filter (where status = 'paid') as paid,
           count(*) filter (where status = 'created') as pending,
           count(*) filter (where status = 'failed') as failed,
           count(*) filter (where status = 'refunded') as refunded,
           coalesce(sum(amount_paise) filter (where status = 'paid'), 0) as paid_paise,
           coalesce(sum(amount_paise) filter (where status = 'refunded'), 0) as refunded_paise
    from payments where user_id = p_user
  )
  select jsonb_build_object(
    'balance', coalesce((select balance from credit_accounts where user_id = p_user), 0),
    'used', jsonb_build_object('today', used.today, 'week', used.week, 'month', used.month, 'total', used.total, 'reserved', used.reserved),
    'generations', jsonb_build_object('total', gens.total, 'completed', gens.completed, 'failed', gens.failed, 'in_progress', gens.in_progress),
    'payments', jsonb_build_object('paid', pays.paid, 'pending', pays.pending, 'failed', pays.failed, 'refunded', pays.refunded,
                                    'paid_paise', pays.paid_paise, 'refunded_paise', pays.refunded_paise)
  ) from used, gens, pays;
$$;

create or replace function admin_overview() returns jsonb
language sql security definer set search_path = public stable
as $$
  select jsonb_build_object(
    'users', jsonb_build_object(
      'total', (select count(*) from auth.users),
      'active_30d', (select count(distinct user_id) from visualizations where created_at > now() - interval '30 days')),
    'credits', jsonb_build_object(
      'purchased', coalesce((select sum(amount) from credit_transactions where type = 'purchase'), 0),
      'consumed', coalesce((select sum(-amount) from credit_transactions where type = 'generation_hold' and status = 'committed'), 0),
      'reserved', coalesce((select sum(-amount) from credit_transactions where type = 'generation_hold' and status = 'held'), 0),
      'outstanding', coalesce((select sum(balance) from credit_accounts), 0)),
    'generations', jsonb_build_object(
      'total', (select count(*) from visualizations),
      'completed', (select count(*) from visualizations where status = 'completed'),
      'failed', (select count(*) from visualizations where status = 'failed')),
    'payments', jsonb_build_object(
      'paid_count', (select count(*) from payments where status = 'paid'),
      'paid_paise', coalesce((select sum(amount_paise) from payments where status = 'paid'), 0),
      'failed_count', (select count(*) from payments where status = 'failed'),
      'refunded_count', (select count(*) from payments where status = 'refunded')),
    'recent_transactions', coalesce((select jsonb_agg(t) from (
        select id, user_id, type, amount, balance_after, status, description, created_at from credit_transactions order by created_at desc limit 15) t), '[]'::jsonb),
    'recent_errors', coalesce((select jsonb_agg(e) from (
        select v.id, v.user_id, left(v.error_message, 200) as error_message, v.created_at from visualizations v where v.status = 'failed' order by v.created_at desc limit 10) e), '[]'::jsonb)
  );
$$;

-- ============================================================
-- STORAGE BUCKETS & POLICIES
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('room-images', 'room-images', false, 10485760, array['image/jpeg','image/png','image/webp']),
  ('tile-images', 'tile-images', true, 5242880, array['image/jpeg','image/png','image/webp']),
  ('generated-visualizations', 'generated-visualizations', false, 15728640, array['image/jpeg','image/png'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "room_images_select_own" on storage.objects;
create policy "room_images_select_own" on storage.objects
  for select using (
    bucket_id = 'room-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "room_images_insert_own" on storage.objects;
drop policy if exists "room_images_delete_own" on storage.objects;

drop policy if exists "generated_viz_select_own" on storage.objects;
create policy "generated_viz_select_own" on storage.objects
  for select using (
    bucket_id = 'generated-visualizations'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "generated_viz_delete_own" on storage.objects;

drop policy if exists "tile_images_public_select" on storage.objects;
create policy "tile_images_public_select" on storage.objects
  for select using (bucket_id = 'tile-images');

-- ============================================================
-- PRIVILEGES & SECURITY HARDENING
-- ============================================================
grant usage on schema public to service_role, authenticated;

grant all on all tables in schema public to service_role;
revoke all on all tables in schema public from anon;

-- authenticated read access
grant select on profiles              to authenticated;
grant select on projects              to authenticated;
grant select on room_uploads          to authenticated;
grant select on room_analyses         to authenticated;
grant select on tiles                 to authenticated;
grant select on tile_recommendations  to authenticated;
grant select on visualizations        to authenticated;
grant select on generation_jobs       to authenticated;
grant select on credit_accounts       to authenticated;
grant select on credit_transactions   to authenticated;
grant select on credit_packages       to authenticated;
grant select on payments              to authenticated;

-- Revoke write privileges from authenticated (all writes go through service_role API)
revoke insert, update, delete on profiles            from authenticated;
revoke insert, update, delete on projects            from authenticated;
revoke insert, update, delete on room_uploads        from authenticated;
revoke insert, update, delete on visualizations      from authenticated;
revoke insert, update, delete on room_analyses       from authenticated;
revoke insert, update, delete on tiles               from authenticated;
revoke insert, update, delete on tile_recommendations from authenticated;
revoke insert, update, delete on generation_jobs     from authenticated;
revoke insert, update, delete on credit_accounts     from authenticated;
revoke insert, update, delete on credit_transactions from authenticated;
revoke insert, update, delete on credit_packages     from authenticated;
revoke insert, update, delete on payments            from authenticated;
revoke insert, update, delete on payment_events      from authenticated;

revoke truncate, trigger, references on all tables in schema public from authenticated, anon;

-- Function execute privileges
revoke all on function credit_apply(uuid, integer, text, text, text, text, jsonb, text, text) from public, anon, authenticated;
revoke all on function credit_hold(uuid, integer, text, text, jsonb)                          from public, anon, authenticated;
revoke all on function credit_commit(uuid)                                                    from public, anon, authenticated;
revoke all on function credit_release(uuid, text)                                             from public, anon, authenticated;
revoke all on function credit_release_stale_holds(uuid, interval)                             from public, anon, authenticated;
revoke all on function payment_apply_paid(text, text, integer, text)                          from public, anon, authenticated;
revoke all on function payment_mark_failed(text, text)                                        from public, anon, authenticated;
revoke all on function payment_apply_refund(text, text)                                       from public, anon, authenticated;
revoke all on function billing_summary(uuid)                                                  from public, anon, authenticated;
revoke all on function admin_overview()                                                       from public, anon, authenticated;
revoke all on function credit_tx_guard()                                                      from public, anon, authenticated;

grant execute on function credit_apply(uuid, integer, text, text, text, text, jsonb, text, text) to service_role;
grant execute on function credit_hold(uuid, integer, text, text, jsonb)                          to service_role;
grant execute on function credit_commit(uuid)                                                    to service_role;
grant execute on function credit_release(uuid, text)                                             to service_role;
grant execute on function credit_release_stale_holds(uuid, interval)                             to service_role;
grant execute on function payment_apply_paid(text, text, integer, text)                          to service_role;
grant execute on function payment_mark_failed(text, text)                                        to service_role;
grant execute on function payment_apply_refund(text, text)                                       to service_role;
grant execute on function billing_summary(uuid)                                                  to service_role;
grant execute on function admin_overview()                                                       to service_role;

-- Realtime for credit_accounts
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'credit_accounts') then
    alter publication supabase_realtime add table credit_accounts;
  end if;
end $$;

-- ============================================================
-- DONE! All 14 tables, buckets, functions and policies ready.
-- ============================================================

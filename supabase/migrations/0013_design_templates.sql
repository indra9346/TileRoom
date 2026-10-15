-- ============================================================
-- 0013: Custom design templates.
--
-- A showroom owner can save the room template + areas they built in the
-- Design Studio (surfaces switched on, patterns, notes, sizes and the tiles
-- chosen for each area) under a name, and re-apply it to any later room.
--
--  * base_template : id of the built-in room template it starts from
--                    (washroom, kitchen, free, ...); defines the 3D scene
--                    and the numbered-wall layout.
--  * areas         : jsonb array of { surface, location, wall?, pattern,
--                    patternNote?, tileIds[], dimensions? }. Validated by the
--                    API (server/lib/validation.ts) before every write.
--
-- Reads and writes go through the server API only (service_role); the
-- authenticated role may only SELECT its own rows, like every other table.
-- Additive and idempotent: safe to re-run.
-- ============================================================

create table if not exists design_templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  base_template text not null default 'free',
  areas jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table design_templates add column if not exists description text;
alter table design_templates add column if not exists base_template text not null default 'free';
alter table design_templates add column if not exists areas jsonb not null default '[]'::jsonb;
alter table design_templates add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'design_templates_name_len') then
    alter table design_templates add constraint design_templates_name_len check (char_length(name) between 1 and 60);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'design_templates_areas_array') then
    alter table design_templates add constraint design_templates_areas_array check (jsonb_typeof(areas) = 'array');
  end if;
end $$;

create index if not exists idx_design_templates_owner on design_templates (owner_id, updated_at desc);

drop trigger if exists trg_design_templates_updated_at on design_templates;
create trigger trg_design_templates_updated_at
  before update on design_templates
  for each row execute function set_updated_at();

alter table design_templates enable row level security;

drop policy if exists "design_templates_select_own" on design_templates;
create policy "design_templates_select_own" on design_templates
  for select using (auth.uid() = owner_id);

grant all on design_templates to service_role;
grant select on design_templates to authenticated;
revoke insert, update, delete, truncate, trigger, references on design_templates from authenticated, anon;
revoke all on design_templates from anon;

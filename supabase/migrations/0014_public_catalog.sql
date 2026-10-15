-- ============================================================
-- 0014: Public tile catalog.
--
--  * tiles.is_public : the showroom owner shows this tile in the public
--                      catalog (browsable without signing in). Only the
--                      owner can still edit a tile or use it in a design.
--
-- Existing tiles stay private (false) until their owner switches them on;
-- tiles created after this migration default to public.
-- Additive and idempotent: safe to re-run.
-- ============================================================

alter table tiles add column if not exists is_public boolean not null default false;
alter table tiles alter column is_public set default true;

create index if not exists idx_tiles_public_active on tiles (created_at desc) where is_public and is_active;

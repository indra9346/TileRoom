-- ============================================================
-- 0015: Unique indexes the application relies on.
--
-- Found missing on the production database (probed 2026-10-15: every one
-- answered 42P10 "no unique or exclusion constraint matching the ON CONFLICT
-- specification"). Without them:
--   * tile_recommendations : the recommendation upsert failed, so
--                            GET /api/tiles/recommend returned 500 (the code
--                            now falls back to replace-in-place, but the index
--                            is still the correct guarantee);
--   * room_analyses        : two concurrent "Analyze" clicks can store two
--                            analyses for one room, after which that room's
--                            analysis lookup errors;
--   * generation_jobs      : concurrent generate requests can create duplicate
--                            attempt numbers;
--   * payments             : the same provider payment id could be recorded twice.
--
-- Each index is created only if missing. If old duplicate rows block one, a
-- NOTICE names it instead of failing the script: remove the duplicates, re-run.
-- Idempotent: safe to re-run. Mirrors the heal block in master_schema.sql.
-- ============================================================
do $$
begin
  begin
    create unique index if not exists uq_room_analyses_room_upload on room_analyses (room_upload_id);
  exception when unique_violation then
    raise notice 'room_analyses has duplicate room_upload_id rows; unique index not created';
  end;
  begin
    create unique index if not exists uq_tile_recommendations_analysis_tile_surface on tile_recommendations (room_analysis_id, tile_id, surface);
  exception when unique_violation then
    raise notice 'tile_recommendations has duplicate (room_analysis_id, tile_id, surface) rows; unique index not created';
  end;
  begin
    create unique index if not exists uq_generation_jobs_visualization_attempt on generation_jobs (visualization_id, attempt_number);
  exception when unique_violation then
    raise notice 'generation_jobs has duplicate (visualization_id, attempt_number) rows; unique index not created';
  end;
  begin
    create unique index if not exists uq_payments_provider_payment on payments (provider_payment_id) where provider_payment_id is not null;
  exception when unique_violation then
    raise notice 'payments has duplicate provider_payment_id rows; unique index not created';
  end;
end $$;

notify pgrst, 'reload schema';

-- Verification: should list all four index names.
select indexname from pg_indexes
where schemaname = 'public'
  and indexname in ('uq_room_analyses_room_upload', 'uq_tile_recommendations_analysis_tile_surface', 'uq_generation_jobs_visualization_attempt', 'uq_payments_provider_payment')
order by indexname;

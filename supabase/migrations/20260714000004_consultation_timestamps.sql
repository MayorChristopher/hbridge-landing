alter table consultations
  add column if not exists started_at  timestamptz,
  add column if not exists ended_at    timestamptz;

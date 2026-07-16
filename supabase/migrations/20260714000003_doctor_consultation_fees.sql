-- Per-type consultation fees for doctors
-- Structure: { "audio": 3000, "video": 5000, "in_person": 8000, "follow_up": 2000 }
alter table doctors
  add column if not exists consultation_fees jsonb default '{}'::jsonb;

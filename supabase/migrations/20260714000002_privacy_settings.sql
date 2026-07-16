create table if not exists privacy_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_visible boolean not null default true,
  share_health_data boolean not null default false,
  two_factor_enabled boolean not null default false,
  data_analytics boolean not null default true,
  location_sharing boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (user_id)
);

alter table privacy_settings enable row level security;

create policy "Users manage own privacy settings"
  on privacy_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

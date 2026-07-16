-- Add hbridge_id to profiles
alter table profiles
  add column if not exists hbridge_id text unique;

-- Add hbridge_id to hospitals
alter table hospitals
  add column if not exists hbridge_id text unique;

-- Function to generate a unique HBridge ID
create or replace function generate_hbridge_id(prefix text) returns text as $$
declare
  chars  text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  new_id text;
  taken  boolean;
begin
  loop
    new_id := prefix || '-' ||
      substr(chars, floor(random()*length(chars))::int + 1, 1) ||
      substr(chars, floor(random()*length(chars))::int + 1, 1) ||
      substr(chars, floor(random()*length(chars))::int + 1, 1) ||
      substr(chars, floor(random()*length(chars))::int + 1, 1) ||
      substr(chars, floor(random()*length(chars))::int + 1, 1) ||
      substr(chars, floor(random()*length(chars))::int + 1, 1);

    select exists(
      select 1 from profiles where hbridge_id = new_id
      union all
      select 1 from hospitals where hbridge_id = new_id
    ) into taken;

    exit when not taken;
  end loop;
  return new_id;
end;
$$ language plpgsql;

-- Trigger function for profiles
create or replace function set_profile_hbridge_id() returns trigger as $$
begin
  if new.hbridge_id is null then
    new.hbridge_id := generate_hbridge_id(
      case new.user_type
        when 'patient'        then 'HBP'
        when 'doctor'         then 'HBM'
        when 'hospital_admin' then 'HBH'
        else                       'HBU'
      end
    );
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_profile_hbridge_id on profiles;
create trigger trg_profile_hbridge_id
  before insert on profiles
  for each row execute function set_profile_hbridge_id();

-- Trigger function for hospitals
create or replace function set_hospital_hbridge_id() returns trigger as $$
begin
  if new.hbridge_id is null then
    new.hbridge_id := generate_hbridge_id('HBH');
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_hospital_hbridge_id on hospitals;
create trigger trg_hospital_hbridge_id
  before insert on hospitals
  for each row execute function set_hospital_hbridge_id();

-- Backfill existing profiles
update profiles
set hbridge_id = generate_hbridge_id(
  case user_type
    when 'patient'        then 'HBP'
    when 'doctor'         then 'HBM'
    when 'hospital_admin' then 'HBH'
    else                       'HBU'
  end
)
where hbridge_id is null;

-- Backfill existing hospitals
update hospitals
set hbridge_id = generate_hbridge_id('HBH')
where hbridge_id is null;

-- Index for fast lookup
create index if not exists idx_profiles_hbridge_id  on profiles(hbridge_id);
create index if not exists idx_hospitals_hbridge_id on hospitals(hbridge_id);

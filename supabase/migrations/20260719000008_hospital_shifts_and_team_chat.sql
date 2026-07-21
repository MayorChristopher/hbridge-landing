-- Facility staff shifts + a shared per-hospital team chat channel.
-- Shifts are a weekly recurring pattern (day_of_week + time range), not a
-- full dated calendar -- simplest version that's actually useful; can be
-- extended with dated exceptions later without breaking this.

create table if not exists staff_shifts (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references hospitals(id) on delete cascade,
  doctor_id uuid not null references doctors(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_staff_shifts_hospital on staff_shifts(hospital_id);
create index if not exists idx_staff_shifts_doctor on staff_shifts(doctor_id);

alter table staff_shifts enable row level security;

drop policy if exists "hospital_admin_manage_shifts" on staff_shifts;
create policy "hospital_admin_manage_shifts"
  on staff_shifts for all
  using (
    exists (
      select 1 from hospitals h
      join profiles p on p.id = auth.uid()
      where h.id = staff_shifts.hospital_id
        and lower(p.hospital_name) = lower(h.name)
    )
  );

drop policy if exists "staff_view_hospital_shifts" on staff_shifts;
create policy "staff_view_hospital_shifts"
  on staff_shifts for select
  using (
    exists (
      select 1 from hospital_staff hs
      join doctors d on d.id = hs.doctor_id
      where hs.hospital_id = staff_shifts.hospital_id
        and hs.status = 'active'
        and d.user_id = auth.uid()
    )
  );

create table if not exists hospital_team_messages (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references hospitals(id) on delete cascade,
  sender_id uuid not null references profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_hospital_team_messages_hospital on hospital_team_messages(hospital_id, created_at);

alter table hospital_team_messages enable row level security;

drop policy if exists "hospital_team_chat_access" on hospital_team_messages;
create policy "hospital_team_chat_access"
  on hospital_team_messages for all
  using (
    exists (
      select 1 from hospitals h
      join profiles p on p.id = auth.uid()
      where h.id = hospital_team_messages.hospital_id
        and lower(p.hospital_name) = lower(h.name)
    )
    or exists (
      select 1 from hospital_staff hs
      join doctors d on d.id = hs.doctor_id
      where hs.hospital_id = hospital_team_messages.hospital_id
        and hs.status = 'active'
        and d.user_id = auth.uid()
    )
  )
  with check (sender_id = auth.uid());

-- PHI access audit trail: who touched what patient data, when, from where.
-- Two write paths feed this table:
--   1. Automatic triggers on tables holding PHI, logging every create/update/delete.
--   2. An explicit RPC (log_phi_access) that screens call when a user VIEWS a
--      record — Postgres has no SELECT trigger, so reads can only be logged
--      by the application explicitly requesting it at the moment of viewing.
-- Nothing but this table's own SECURITY DEFINER functions can write to it,
-- and no one (not even the actor) can read it directly — audit trails that
-- can be edited or read by the people they watch aren't real audit trails.
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_role text,
  patient_user_id uuid references auth.users(id) on delete set null,
  table_name text not null,
  record_id uuid,
  action text not null check (action in ('view', 'create', 'update', 'delete')),
  ip_address text,
  location text,
  user_agent text
);

create index if not exists audit_logs_patient_idx on public.audit_logs (patient_user_id, created_at desc);
create index if not exists audit_logs_actor_idx on public.audit_logs (actor_user_id, created_at desc);
create index if not exists audit_logs_table_record_idx on public.audit_logs (table_name, record_id, created_at desc);

alter table public.audit_logs enable row level security;
-- Deliberately no SELECT/INSERT/UPDATE/DELETE policies for anon/authenticated
-- at all. Reads happen via the Supabase dashboard/service role during an
-- actual investigation; writes happen only via the functions below.

-- Best-effort extraction of the caller's IP/user-agent from the request
-- headers PostgREST exposes during a live request. Returns nulls (not an
-- error) when called outside a request context, e.g. from `supabase db query`.
create or replace function public._audit_request_ip()
returns text
language plpgsql
stable
as $$
begin
  return current_setting('request.headers', true)::json->>'x-forwarded-for';
exception when others then
  return null;
end;
$$;

create or replace function public._audit_request_user_agent()
returns text
language plpgsql
stable
as $$
begin
  return current_setting('request.headers', true)::json->>'user-agent';
exception when others then
  return null;
end;
$$;

-- Explicit view-event logging, called by the app the moment a screen
-- actually displays a patient's PHI (a medical record, a case file, etc).
create or replace function public.log_phi_access(
  p_table_name text,
  p_record_id uuid,
  p_action text default 'view',
  p_patient_user_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  select coalesce(user_type, 'unknown') into v_role from public.profiles where id = auth.uid();

  insert into public.audit_logs (actor_user_id, actor_role, patient_user_id, table_name, record_id, action, ip_address, user_agent)
  values (auth.uid(), v_role, p_patient_user_id, p_table_name, p_record_id, p_action, public._audit_request_ip(), public._audit_request_user_agent());
end;
$$;

grant execute on function public.log_phi_access(text, uuid, text, uuid) to authenticated;

-- Automatic write-event logging for every insert/update/delete on tables
-- that hold PHI, regardless of which screen or code path triggered it.
create or replace function public._audit_write_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_patient_id uuid;
  v_record_id uuid;
  v_action text;
  v_role text;
begin
  v_action := case tg_op when 'INSERT' then 'create' when 'UPDATE' then 'update' when 'DELETE' then 'delete' end;
  v_record_id := (case when tg_op = 'DELETE' then old.id else new.id end);

  if tg_table_name = 'medical_records' then
    v_patient_id := case when tg_op = 'DELETE' then old.user_id else new.user_id end;
  elsif tg_table_name in ('consultations', 'medical_record_access') then
    v_patient_id := case when tg_op = 'DELETE' then old.patient_id else new.patient_id end;
  elsif tg_table_name = 'record_folders' then
    v_patient_id := case when tg_op = 'DELETE' then old.owner_id else new.owner_id end;
  elsif tg_table_name = 'profiles' then
    v_patient_id := case when tg_op = 'DELETE' then old.id else new.id end;
  else
    v_patient_id := null;
  end if;

  select coalesce(user_type, 'unknown') into v_role from public.profiles where id = auth.uid();

  insert into public.audit_logs (actor_user_id, actor_role, patient_user_id, table_name, record_id, action, ip_address, user_agent)
  values (auth.uid(), v_role, v_patient_id, tg_table_name, v_record_id, v_action, public._audit_request_ip(), public._audit_request_user_agent());

  return coalesce(new, old);
end;
$$;

drop trigger if exists audit_medical_records on public.medical_records;
create trigger audit_medical_records
  after insert or update or delete on public.medical_records
  for each row execute function public._audit_write_trigger();

drop trigger if exists audit_consultations on public.consultations;
create trigger audit_consultations
  after insert or update or delete on public.consultations
  for each row execute function public._audit_write_trigger();

drop trigger if exists audit_medical_record_access on public.medical_record_access;
create trigger audit_medical_record_access
  after insert or update or delete on public.medical_record_access
  for each row execute function public._audit_write_trigger();

drop trigger if exists audit_record_folders on public.record_folders;
create trigger audit_record_folders
  after insert or update or delete on public.record_folders
  for each row execute function public._audit_write_trigger();

drop trigger if exists audit_profiles on public.profiles;
create trigger audit_profiles
  after update or delete on public.profiles
  for each row execute function public._audit_write_trigger();

-- Consultation recording — from the practitioner meeting: "recording and
-- transcribing consultations to create online documentation." Building
-- recording + secure storage now; transcription is deliberately deferred
-- until a transcription provider/API key is chosen.
--
-- Important constraint this schema reflects: our calling is peer-to-peer
-- WebRTC (no media server), so there is no single mixed recording of "the
-- call." Each participant can locally record their own microphone (with
-- mutual consent) — this is the standard workaround telehealth systems use
-- without an SFU/media server, and is reflected here as two separate
-- recording slots per consultation rather than one merged file.

create table if not exists consultation_recordings (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid not null references consultations(id) on delete cascade,
  doctor_consent boolean not null default false,
  patient_consent boolean not null default false,
  doctor_recording_url text,
  patient_recording_url text,
  doctor_recorded_at timestamptz,
  patient_recorded_at timestamptz,
  created_at timestamptz not null default now(),
  unique (consultation_id)
);

alter table consultation_recordings enable row level security;

-- Only the consultation's own doctor or patient may see or touch its
-- recording row — mirrors the access pattern already used for consultations
-- and messages (matching via the doctors table for the doctor side).
create policy "consultation_recordings_participant_access"
  on consultation_recordings for all
  using (
    exists (
      select 1 from consultations c
      where c.id = consultation_recordings.consultation_id
        and (
          c.patient_id = auth.uid()
          or exists (select 1 from doctors d where d.id = c.doctor_id and d.user_id = auth.uid())
        )
    )
  )
  with check (
    exists (
      select 1 from consultations c
      where c.id = consultation_recordings.consultation_id
        and (
          c.patient_id = auth.uid()
          or exists (select 1 from doctors d where d.id = c.doctor_id and d.user_id = auth.uid())
        )
    )
  );

-- Private bucket — recordings are sensitive medical data, never publicly
-- readable. Access is only ever via signed URLs minted server-side, same
-- pattern as the existing medical-records/attachments buckets.
insert into storage.buckets (id, name, public)
values ('call-recordings', 'call-recordings', false)
on conflict (id) do nothing;

drop policy if exists "call_recordings_participant_upload" on storage.objects;
create policy "call_recordings_participant_upload"
  on storage.objects for insert
  with check (
    bucket_id = 'call-recordings'
    and exists (
      select 1 from consultations c
      where c.id::text = (storage.foldername(name))[1]
        and (
          c.patient_id = auth.uid()
          or exists (select 1 from doctors d where d.id = c.doctor_id and d.user_id = auth.uid())
        )
    )
  );

drop policy if exists "call_recordings_participant_read" on storage.objects;
create policy "call_recordings_participant_read"
  on storage.objects for select
  using (
    bucket_id = 'call-recordings'
    and exists (
      select 1 from consultations c
      where c.id::text = (storage.foldername(name))[1]
        and (
          c.patient_id = auth.uid()
          or exists (select 1 from doctors d where d.id = c.doctor_id and d.user_id = auth.uid())
        )
    )
  );

-- Restrict prescribing per policy: private-practice doctors need an in-person
-- (or follow-up) consultation to prescribe; government/federal/state-affiliated
-- doctors are exempt from that requirement, but still need SOME real
-- consultation relationship with the patient. The live policy this replaces
-- ("doctor_insert_medications") only checked profiles.user_type = 'doctor',
-- with no relationship check at all -- any doctor could insert a medication
-- record for any patient. This closes both gaps at once.

drop policy if exists "doctor_insert_medications" on medications;

create policy "doctor_insert_medications"
  on medications for insert
  to authenticated
  with check (
    exists (
      select 1
      from consultations c
      join doctors d on d.id = c.doctor_id
      where d.user_id = auth.uid()
        and c.patient_id = medications.patient_id
        and (
          exists (
            select 1
            from hospital_staff hs
            join hospitals h on h.id = hs.hospital_id
            where hs.doctor_id = d.id
              and hs.status = 'active'
              and h.type in ('government', 'federal', 'state')
          )
          or c.consultation_type in ('in_person', 'follow_up')
        )
    )
  );

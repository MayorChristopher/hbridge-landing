-- messages_insert_gated (20260719000009) correctly gates real patient <-> doctor
-- consultation chat, but the new practitioner-to-practitioner "Message
-- Practitioner" feature (DoctorsListScreen/DoctorDetailScreen) reuses the same
-- conversations.patient_id slot to hold the *initiating doctor's own user id*.
-- Once the target doctor replied once, the "intake window" closed and the
-- initiating doctor got blocked from sending any further message unless a
-- (nonsensical, doctor-to-doctor) paid consultation existed -- peer networking
-- chat must never be gated this way. Add an explicit exemption: if the
-- conversation's patient_id itself belongs to a registered doctor, this is
-- peer messaging, not a clinical consultation.

drop policy if exists "messages_insert_gated" on messages;

create policy "messages_insert_gated"
  on messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from conversations c
      where c.id = messages.conversation_id
        and (
          c.patient_id = auth.uid()
          or exists (select 1 from doctors d where d.id = c.doctor_id and d.user_id = auth.uid())
        )
    )
    and (
      -- the doctor can always send
      exists (
        select 1 from conversations c
        join doctors d on d.id = c.doctor_id
        where c.id = messages.conversation_id and d.user_id = auth.uid()
      )
      -- practitioner-to-practitioner chat: the "patient_id" side is itself a
      -- registered doctor -- never gate peer networking messages
      or exists (
        select 1 from conversations c
        join doctors d4 on d4.user_id = c.patient_id
        where c.id = messages.conversation_id
      )
      -- intake window: no doctor message yet in this conversation
      or not exists (
        select 1 from messages m2
        join conversations c2 on c2.id = m2.conversation_id
        join doctors d2 on d2.id = c2.doctor_id
        where m2.conversation_id = messages.conversation_id and d2.user_id = m2.sender_id
      )
      -- unlocked: a real paid consultation exists between this patient and doctor
      or exists (
        select 1 from consultations co
        join conversations c3 on c3.id = messages.conversation_id
        join doctors d3 on d3.id = c3.doctor_id
        where co.patient_id = c3.patient_id
          and co.doctor_id = d3.id
          and co.payment_status = 'paid'
      )
    )
  );

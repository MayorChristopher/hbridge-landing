-- Structured intake + consultation-gated chat: a patient can freely message
-- a doctor until the doctor's first reply (the "intake" window covering the
-- initial reason-for-visit exchange). After that, the patient needs a real
-- paid consultation with that doctor to keep messaging. Doctors are never
-- gated. Replaces two live overlapping/duplicate INSERT policies on
-- "messages" with one clean rule.

drop policy if exists "Users can send messages" on messages;
drop policy if exists "Users can send messages in their conversations" on messages;

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

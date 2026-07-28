import { supabase } from '../lib/supabase';

/**
 * Books to date created the consultation/appointment but never touched
 * `conversations` — a patient's symptoms/reason typed at booking stayed
 * stuck on the consultation row, invisible from the chat the doctor
 * actually works from. This seeds the reason as the conversation's first
 * message (sender = patient, satisfying the gated-chat "first message is
 * free" RLS rule) so the doctor sees context the moment they open chat.
 * Skipped if the conversation already has messages, so it never overwrites
 * an ongoing thread on repeat bookings with the same doctor.
 */
export async function seedConsultationReasonMessage(patientId: string, doctorId: string, reason: string) {
  const text = reason.trim();
  if (!text) return;

  const { data: existing } = await supabase.from('conversations').select('id')
    .eq('patient_id', patientId).eq('doctor_id', doctorId).maybeSingle();

  let conversationId = existing?.id;
  if (!conversationId) {
    const { data: created } = await supabase.from('conversations')
      .insert({ patient_id: patientId, doctor_id: doctorId }).select('id').single();
    conversationId = created?.id;
  }
  if (!conversationId) return;

  const { count } = await supabase.from('messages')
    .select('id', { count: 'exact', head: true }).eq('conversation_id', conversationId);
  if (count && count > 0) return;

  await supabase.from('messages').insert({
    conversation_id: conversationId,
    sender_id: patientId,
    content: text,
  });
}

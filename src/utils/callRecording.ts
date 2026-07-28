// Consent + local recording capture for consultations — see the
// 20260721000001_consultation_recording.sql migration for why this is a
// per-participant local recording rather than one merged file (no media
// server behind our peer-to-peer WebRTC calls). Transcription is
// deliberately not wired up yet — this only captures and stores audio.
import { Audio } from 'expo-av';
import { supabase } from '../lib/supabase';

export type CallRole = 'doctor' | 'patient';

/** Whether the current user is the doctor or patient side of this consultation. */
export async function getMyCallRole(consultationId: string, userId: string): Promise<CallRole | null> {
  const { data: consult } = await supabase
    .from('consultations').select('patient_id, doctor_id').eq('id', consultationId).maybeSingle();
  if (!consult) return null;
  if (consult.patient_id === userId) return 'patient';
  const { data: doc } = await supabase.from('doctors').select('id').eq('user_id', userId).maybeSingle();
  if (doc && doc.id === consult.doctor_id) return 'doctor';
  return null;
}

export interface ConsentRow {
  doctor_consent: boolean;
  patient_consent: boolean;
}

export async function setMyRecordingConsent(consultationId: string, role: CallRole, consent: boolean): Promise<void> {
  const column = role === 'doctor' ? 'doctor_consent' : 'patient_consent';
  await supabase.from('consultation_recordings')
    .upsert({ consultation_id: consultationId, [column]: consent }, { onConflict: 'consultation_id' });
}

export async function getRecordingConsent(consultationId: string): Promise<ConsentRow | null> {
  const { data } = await supabase
    .from('consultation_recordings').select('doctor_consent, patient_consent')
    .eq('consultation_id', consultationId).maybeSingle();
  return data;
}

/** Subscribes to consent changes for this consultation; returns an unsubscribe function. */
export function subscribeToConsent(consultationId: string, onChange: (row: ConsentRow) => void) {
  const channel = supabase
    .channel(`recording-consent-${consultationId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'consultation_recordings', filter: `consultation_id=eq.${consultationId}` },
      (payload: any) => onChange(payload.new)
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}

let activeRecording: Audio.Recording | null = null;

export async function startLocalRecording(): Promise<void> {
  await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
  const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
  activeRecording = recording;
}

export async function stopAndUploadRecording(consultationId: string, role: CallRole): Promise<string | null> {
  if (!activeRecording) return null;
  try {
    await activeRecording.stopAndUnloadAsync();
    const uri = activeRecording.getURI();
    activeRecording = null;
    if (!uri) return null;

    const path = `${consultationId}/${role}-${Date.now()}.m4a`;
    const formData = new FormData();
    formData.append('file', { uri, name: path, type: 'audio/m4a' } as any);
    const { data: session } = await supabase.auth.getSession();
    const token = session?.session?.access_token;
    const supabaseUrl = (supabase as any).supabaseUrl as string;
    const res = await fetch(`${supabaseUrl}/storage/v1/object/call-recordings/${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (!res.ok) throw new Error(`Upload failed: ${await res.text()}`);

    const column = role === 'doctor' ? 'doctor_recording_url' : 'patient_recording_url';
    const atColumn = role === 'doctor' ? 'doctor_recorded_at' : 'patient_recorded_at';
    await supabase.from('consultation_recordings')
      .update({ [column]: path, [atColumn]: new Date().toISOString() })
      .eq('consultation_id', consultationId);

    return path;
  } catch (e) {
    activeRecording = null;
    throw e;
  }
}

export async function discardActiveRecording(): Promise<void> {
  if (!activeRecording) return;
  try { await activeRecording.stopAndUnloadAsync(); } catch {}
  activeRecording = null;
}

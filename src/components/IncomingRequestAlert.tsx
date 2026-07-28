// Full-screen, hard-to-miss alert for new incoming consultation requests —
// from the practitioner meeting: "a more robust notification system... with
// persistent notifications (vibrating, popping up) to attract the
// practitioner's attention." A quiet badge on a tab icon is easy to miss if
// a doctor is busy elsewhere in the app (or the app is backgrounded and they
// only glance at it later) — this interrupts with a continuous vibration
// pattern and a full-screen incoming-call-style overlay that stays until
// the doctor explicitly acts on it, mounted once at the app root so it
// fires regardless of which screen they're currently on.
import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Vibration, Image, ActivityIndicator } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useToast } from './ToastProvider';

const C = {
  ink: '#083236', teal: '#0B7E8A', gold: '#D4A843', red: '#EF4444',
  muted: 'rgba(255,255,255,0.7)',
};

const CONSULT_ICONS: Record<string, string> = {
  audio: 'call', video: 'videocam', in_person: 'walk', follow_up: 'refresh',
};

// Repeating vibration pattern: 600ms on, 400ms off, forever until cancelled.
const VIBRATE_PATTERN = [0, 600, 400];

interface IncomingRequest {
  id: string;
  consultation_type: string;
  symptoms: string | null;
  scheduled_at: string;
  patient: { full_name: string; profile_image: string | null } | null;
}

export default function IncomingRequestAlert() {
  const toast = useToast();
  const [request, setRequest] = useState<IncomingRequest | null>(null);
  const [acting, setActing] = useState(false);
  const doctorIdRef = useRef<string | null>(null);

  useEffect(() => {
    let channel: any;
    const setup = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: doc } = await supabase.from('doctors').select('id').eq('user_id', user.id).maybeSingle();
      if (!doc) return; // not a practitioner account — nothing to watch
      doctorIdRef.current = doc.id;

      channel = supabase
        .channel('incoming-consultation-requests')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'consultations', filter: `doctor_id=eq.${doc.id}` },
          async (payload: any) => {
            const row = payload.new;
            if (row.status !== 'pending') return;
            const { data: patient } = await supabase
              .from('profiles').select('full_name, profile_image').eq('id', row.patient_id).maybeSingle();
            setRequest({
              id: row.id,
              consultation_type: row.consultation_type,
              symptoms: row.symptoms,
              scheduled_at: row.scheduled_at,
              patient: patient || null,
            });
          }
        )
        .subscribe();
    };
    setup();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (request) Vibration.vibrate(VIBRATE_PATTERN, true);
    else Vibration.cancel();
    return () => Vibration.cancel();
  }, [request]);

  const respond = async (status: 'confirmed' | 'cancelled') => {
    if (!request) return;
    setActing(true);
    try {
      await supabase.from('consultations').update({ status }).eq('id', request.id);
      toast.showSuccess(
        status === 'confirmed' ? 'Accepted' : 'Declined',
        status === 'confirmed' ? 'Patient notified to proceed with payment.' : 'Request declined.'
      );
    } catch {
      toast.showError('Error', 'Could not update the request. Check Appointments to respond manually.');
    } finally {
      setActing(false);
      setRequest(null);
    }
  };

  if (!request) return null;

  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent>
      <View style={s.overlay}>
        <View style={s.card}>
          <View style={s.pulseRing}>
            <Ionicons name={(CONSULT_ICONS[request.consultation_type] || 'medical') as any} size={30} color="#fff" />
          </View>
          <Text style={s.label}>NEW CONSULTATION REQUEST</Text>

          <View style={s.patientRow}>
            {request.patient?.profile_image
              ? <Image source={{ uri: request.patient.profile_image }} style={s.avatar} />
              : <View style={[s.avatar, s.avatarFallback]}>
                  <Ionicons name="person" size={22} color="rgba(255,255,255,0.8)" />
                </View>}
            <View style={{ flex: 1 }}>
              <Text style={s.patientName}>{request.patient?.full_name || 'Patient'}</Text>
              <Text style={s.typeText}>{(request.consultation_type || 'consultation').replace('_', ' ')}</Text>
            </View>
          </View>

          {!!request.symptoms && (
            <Text style={s.symptoms} numberOfLines={3}>"{request.symptoms}"</Text>
          )}

          <View style={s.actions}>
            <TouchableOpacity style={s.declineBtn} onPress={() => respond('cancelled')} disabled={acting}>
              {acting ? <ActivityIndicator color={C.red} /> : <><Ionicons name="close" size={18} color={C.red} /><Text style={s.declineText}>Decline</Text></>}
            </TouchableOpacity>
            <TouchableOpacity style={s.acceptBtn} onPress={() => respond('confirmed')} disabled={acting}>
              {acting ? <ActivityIndicator color="#fff" /> : <><Ionicons name="checkmark" size={18} color="#fff" /><Text style={s.acceptText}>Accept</Text></>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(8,50,54,0.92)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', alignItems: 'center', gap: 14 },
  pulseRing: {
    width: 84, height: 84, borderRadius: 42, backgroundColor: 'rgba(212,168,67,0.25)',
    borderWidth: 2, borderColor: C.gold, alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  label: { fontSize: 12, fontFamily: 'Montserrat_700Bold', color: C.gold, letterSpacing: 1.4 },
  patientRow: { flexDirection: 'row', alignItems: 'center', gap: 12, width: '100%', paddingHorizontal: 12 },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  avatarFallback: { backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  patientName: { fontSize: 18, fontFamily: 'Montserrat_700Bold', color: '#fff' },
  typeText: { fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted, textTransform: 'capitalize', marginTop: 2 },
  symptoms: {
    fontSize: 13.5, fontFamily: 'SpaceGrotesk_400Regular', color: 'rgba(255,255,255,0.85)',
    textAlign: 'center', lineHeight: 20, fontStyle: 'italic', paddingHorizontal: 20,
  },
  actions: { flexDirection: 'row', gap: 12, width: '100%', marginTop: 10 },
  declineBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 54, borderRadius: 16, backgroundColor: 'rgba(239,68,68,0.12)', borderWidth: 1.5, borderColor: C.red,
  },
  declineText: { fontSize: 15, fontFamily: 'Montserrat_700Bold', color: C.red },
  acceptBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 54, borderRadius: 16, backgroundColor: C.teal,
  },
  acceptText: { fontSize: 15, fontFamily: 'Montserrat_700Bold', color: '#fff' },
});

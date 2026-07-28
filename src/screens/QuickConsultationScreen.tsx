import React, { useState } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ToastProvider';
import FadeScreen from '../components/FadeScreen';
import { borderRadius } from '../utils/design';
import { sendNotifications } from '../utils/notify';
import { findAvailableDoctor } from '../utils/autoAssignDoctor';
import { seedConsultationReasonMessage } from '../utils/seedConsultationMessage';

const C = {
  bg: '#F5F3EE', card: '#FFFFFF', border: '#EAE5DA',
  text: '#0C2E30', muted: '#6B7E7F', teal: '#0B7E8A',
  tealDark: '#083236', tealMid: '#0C6570', gold: '#D4A843',
};

const TYPES = [
  { key: 'audio', label: 'Audio Call', icon: 'call-outline' },
  { key: 'video', label: 'Video Call', icon: 'videocam-outline' },
] as const;

const SPECIALTIES = ['Any', 'General Practice', 'Cardiology', 'Pediatrics', 'Dermatology', 'Gynecology'];

export default function QuickConsultationScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [type, setType] = useState<'audio' | 'video'>('audio');
  const [specialty, setSpecialty] = useState('Any');
  const [symptoms, setSymptoms] = useState('');
  const [searching, setSearching] = useState(false);

  const handleRequest = async () => {
    if (!symptoms.trim()) {
      toast.showWarning('Required', 'Briefly describe your symptoms or reason for the consultation.');
      return;
    }
    setSearching(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.showError('Error', 'Please sign in first'); return; }

      const doctor = await findAvailableDoctor(specialty === 'Any' ? undefined : specialty, user.id);
      if (!doctor) {
        toast.showWarning(
          'No Doctors Available',
          'No one is available for an immediate consultation right now. Try again shortly, or book a scheduled appointment instead.'
        );
        return;
      }

      const { data: consultation, error } = await supabase.from('consultations').insert({
        patient_id: user.id,
        doctor_id: doctor.id,
        consultation_type: type,
        scheduled_at: new Date().toISOString(),
        symptoms: symptoms.trim(),
        status: 'pending',
        consultation_fee: doctor.consultation_fee ?? 0,
        payment_status: 'pending',
      }).select('id').single();
      if (error) throw error;

      try {
        await seedConsultationReasonMessage(user.id, doctor.id, symptoms);
      } catch (e) { console.warn('Seeding consultation reason message failed', e); }

      try {
        await sendNotifications([{
          userId: doctor.user_id,
          title: 'Quick Consultation Request',
          message: `A patient needs an immediate ${type} consultation: "${symptoms.trim().slice(0, 80)}"`,
          type: 'booking',
        }]);
      } catch (e) { console.warn('Notification failed', e); }

      toast.showSuccess('Request Sent', `Connecting you with ${doctor.title || 'Dr.'} ${doctor.full_name}. They've been notified.`);
      navigation.replace('Appointments');
    } catch (e: any) {
      toast.showError('Error', e.message || 'Something went wrong. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  return (
    <FadeScreen>
      <View style={{ flex: 1, backgroundColor: C.tealDark }}>
        <StatusBar barStyle="light-content" backgroundColor={C.tealDark} />
        <View style={{ height: insets.top, backgroundColor: C.tealDark }} />

        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Quick Consultation</Text>
            <Text style={s.headerSub}>We'll connect you with the next available doctor</Text>
          </View>
        </View>

        <View style={s.paperCard}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior="height">
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={[s.body, { paddingBottom: Math.max(insets.bottom + 24, 40) }]}
            >
              <View style={s.infoBanner}>
                <View style={s.infoBannerIcon}>
                  <Ionicons name="flash" size={16} color={C.teal} />
                </View>
                <Text style={s.infoBannerText}>
                  No need to pick a doctor — describe what's going on and we'll match you with whoever's available right now.
                </Text>
              </View>

              <Text style={s.sectionLabel}>HOW WOULD YOU LIKE TO CONNECT</Text>
              <View style={s.typeRow}>
                {TYPES.map(t => {
                  const active = type === t.key;
                  return (
                    <TouchableOpacity
                      key={t.key}
                      style={[s.typePill, active && s.typePillActive]}
                      onPress={() => setType(t.key)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name={t.icon as any} size={16} color={active ? C.teal : C.muted} />
                      <Text style={[s.typePillLabel, active && s.typePillLabelActive]}>{t.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={s.sectionLabel}>PREFERRED SPECIALTY (OPTIONAL)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.specRow}>
                {SPECIALTIES.map(sp => {
                  const active = specialty === sp;
                  return (
                    <TouchableOpacity
                      key={sp}
                      style={[s.specChip, active && s.specChipActive]}
                      onPress={() => setSpecialty(sp)}
                      activeOpacity={0.8}
                    >
                      <Text style={[s.specChipLabel, active && s.specChipLabelActive]}>{sp}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={s.sectionLabel}>REASON / SYMPTOMS *</Text>
              <TextInput
                style={s.symptomsInput}
                value={symptoms}
                onChangeText={setSymptoms}
                placeholder="Describe your symptoms, concerns, or reason for this consultation..."
                placeholderTextColor={C.muted}
                multiline
                textAlignVertical="top"
              />

              <TouchableOpacity style={s.submitBtnWrap} onPress={handleRequest} disabled={searching} activeOpacity={0.85}>
                <LinearGradient
                  colors={[C.tealMid, C.tealDark]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={[s.submitBtn, searching && { opacity: 0.7 }]}
                >
                  {searching
                    ? <ActivityIndicator color="#fff" />
                    : <>
                        <Ionicons name="flash" size={18} color="#fff" />
                        <Text style={s.submitBtnText}>Find Me a Doctor</Text>
                      </>}
                </LinearGradient>
              </TouchableOpacity>

              <Text style={s.footNote}>
                If no one's available right now, you can always book a scheduled appointment with a specific doctor instead.
              </Text>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </View>
    </FadeScreen>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20,
    backgroundColor: C.tealDark,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 20, fontFamily: 'Montserrat_700Bold', color: '#fff' },
  headerSub: { fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: 'rgba(255,255,255,0.7)', marginTop: 2 },

  paperCard: { flex: 1, backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
  body: { paddingHorizontal: 20, paddingTop: 20, gap: 14 },

  // Flat teal card, no border+shadow combo — matches the rest of the app's
  // informational rows instead of the old gold "boxed" style.
  infoBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(11,126,138,0.07)', borderWidth: 1, borderColor: 'rgba(11,126,138,0.22)',
    borderRadius: borderRadius.xl, padding: 13,
  },
  infoBannerIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(11,126,138,0.14)', alignItems: 'center', justifyContent: 'center' },
  infoBannerText: { flex: 1, fontSize: 12.5, fontFamily: 'SpaceGrotesk_400Regular', color: C.text, lineHeight: 18 },

  sectionLabel: { fontSize: 10.5, fontFamily: 'Montserrat_700Bold', color: '#6B7E7F', letterSpacing: 1.2, marginBottom: 2 },

  typeRow: { flexDirection: 'row', gap: 10 },
  typePill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: borderRadius.xl,
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: C.border,
  },
  typePillActive: { backgroundColor: 'rgba(11,126,138,0.09)', borderColor: C.teal },
  typePillLabel: { fontSize: 14, fontFamily: 'Montserrat_600SemiBold', color: C.muted },
  typePillLabelActive: { color: C.teal },

  specRow: { gap: 8, paddingBottom: 2 },
  specChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: '#fff', borderWidth: 1.5, borderColor: C.border },
  specChipActive: { backgroundColor: 'rgba(11,126,138,0.09)', borderColor: C.teal },
  specChipLabel: { fontSize: 12.5, fontFamily: 'SpaceGrotesk_400Regular', color: C.text },
  specChipLabelActive: { fontFamily: 'SpaceGrotesk_500Medium', color: C.teal },

  symptomsInput: {
    backgroundColor: '#fff', borderRadius: borderRadius.xl,
    borderWidth: 1, borderColor: C.border,
    padding: 14, fontSize: 14, fontFamily: 'SpaceGrotesk_400Regular', color: C.text,
    minHeight: 110,
  },

  submitBtnWrap: {
    borderRadius: 16, overflow: 'hidden', marginTop: 4,
    shadowColor: '#083236', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.22, shadowRadius: 18, elevation: 7,
  },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 56 },
  submitBtnText: { fontSize: 16, fontFamily: 'Montserrat_700Bold', color: '#fff' },

  footNote: { fontSize: 11.5, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted, textAlign: 'center', lineHeight: 17, marginTop: 2 },
});

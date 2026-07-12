import React, { useState } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, Image, ActivityIndicator, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import { usePaystack } from 'react-native-paystack-webview';
import { supabase } from '../lib/supabase';
import { useNotificationBadge } from '../context/NotificationBadgeContext';
import { useToast } from '../components/ToastProvider';

const C = {
  paper: '#F5F3EE', card: '#FFFFFF', cardBorder: '#EAE5DA',
  ink: '#0C2E30', teal: '#0B7E8A', tealHero1: '#0C6570', tealHero2: '#083236',
  gold: '#D4A843',
  muted: '#7A8785', muted2: '#97A2A0', textPrimary: '#16211F', textBody: '#5C6B69',
};

const drName = (doctor: any) => {
  if (!doctor?.full_name) return 'Doctor';
  if (/^dr\.?\s/i.test(doctor.full_name.trim())) return doctor.full_name.trim();
  const t = (doctor.title || 'Dr.').trim();
  return `${t.endsWith('.') ? t : t + '.'} ${doctor.full_name.trim()}`;
};

const TYPES = [
  { key: 'audio',     label: 'Audio Call',  icon: 'call-outline'     },
  { key: 'video',     label: 'Video Call',  icon: 'videocam-outline' },
  { key: 'in_person', label: 'In-Person',   icon: 'person-outline'   },
  { key: 'follow_up', label: 'Follow-Up',   icon: 'refresh-outline'  },
] as const;

export default function BookConsultationScreen({ route, navigation }: any) {
  const toast = useToast();
  const { doctor, reschedule = false, consultationId, existingData } = route.params ?? {};
  const { refreshUnreadCount } = useNotificationBadge();
  const { popup } = usePaystack();

  const [type, setType]         = useState<string>(existingData?.type || 'audio');
  const [symptoms, setSymptoms] = useState(existingData?.symptoms || '');
  const [date, setDate]         = useState(() => { const d = new Date(); d.setDate(d.getDate() + 1); return d; });
  const [time, setTime]         = useState(() => { const t = new Date(); t.setHours(9, 0, 0, 0); return t; });
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const [loading, setLoading]   = useState(false);

  const selectedType = TYPES.find(t => t.key === type) ?? TYPES[0];
  const totalFee = doctor?.consultation_fee ?? 0;

  const scheduledAt = new Date(
    date.getFullYear(), date.getMonth(), date.getDate(),
    time.getHours(), time.getMinutes()
  );

  const createConsultation = async (userId: string, paymentStatus: string, paymentRef?: string) => {
    if (reschedule && consultationId) {
      const { error } = await supabase.from('consultations').update({
        consultation_type: type,
        scheduled_at: scheduledAt.toISOString(),
        symptoms: symptoms.trim(),
        updated_at: new Date().toISOString(),
      }).eq('id', consultationId);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('consultations').insert({
        patient_id: userId,
        doctor_id: doctor.id,
        consultation_type: type,
        scheduled_at: scheduledAt.toISOString(),
        symptoms: symptoms.trim(),
        status: 'scheduled',
        consultation_fee: totalFee,
        payment_status: paymentStatus,
      });
      if (error) throw error;
    }

    await supabase.from('notifications').insert({
      user_id: userId,
      title: reschedule ? 'Consultation Rescheduled' : 'Consultation Booked!',
      message: `${selectedType.label} with ${drName(doctor)} on ${scheduledAt.toLocaleDateString()} at ${scheduledAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
      type: 'booking',
    });

    refreshUnreadCount();
    toast.showSuccess(
      reschedule ? 'Rescheduled!' : 'Booked!',
      reschedule
        ? 'Your consultation has been updated.'
        : `Your ${selectedType.label} with ${drName(doctor)} is confirmed.`
    );
    navigation.navigate('Appointments');
  };

  const handleBook = async () => {
    if (!symptoms.trim()) {
      toast.showWarning('Required', 'Please describe your symptoms or reason for the consultation.');
      return;
    }
    if (scheduledAt <= new Date()) {
      toast.showWarning('Invalid Date', 'Please choose a future date and time.');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.showError('Error', 'Please sign in first'); return; }

      if (totalFee > 0 && !reschedule) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('email, full_name')
          .eq('id', user.id)
          .single();

        const email = profile?.email || user.email || '';
        const name  = profile?.full_name || '';
        setLoading(false);

        popup.checkout({
          email,
          amount: totalFee * 100,
          reference: `hb_${Date.now()}`,
          onSuccess: async (response: any) => {
            const ref = response?.reference || response?.data?.reference || `paid_${Date.now()}`;
            try {
              await createConsultation(user.id, 'paid', ref);
            } catch (e: any) {
              toast.showError('Booking Error', 'Payment received but booking failed. Contact support with ref: ' + ref);
            }
          },
          onCancel: () => {
            toast.showInfo('Payment Cancelled', 'No charge was made.');
          },
        });
        return;
      } else {
        await createConsultation(user.id, 'free');
      }
    } catch (e: any) {
      toast.showError('Booking Failed', e.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#083236" />

      {/* Header */}
      <View style={s.hdrRow}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={s.hdrTitle}>{reschedule ? 'Reschedule' : 'Book Consultation'}</Text>
      </View>

      <View style={s.paperCard}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.body}>

          {/* Doctor card */}
          <View style={s.doctorCard}>
            <View style={s.doctorAvatar}>
              {doctor.profile_image
                ? <Image source={{ uri: doctor.profile_image }} style={s.doctorAvatarImg} />
                : <MaterialCommunityIcons name="stethoscope" size={26} color={C.teal} />}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.doctorName} numberOfLines={1}>{drName(doctor)}</Text>
              <Text style={s.doctorSpec}>{doctor.specialization}</Text>
              <View style={s.doctorMeta}>
                <Ionicons name="star" size={12} color={C.gold} />
                <Text style={s.metaText}>{(doctor.average_rating ?? doctor.rating ?? 0).toFixed(1)}</Text>
                <Text style={s.metaDot}>·</Text>
                <Text style={s.metaText}>{doctor.years_experience ?? 0} yrs exp</Text>
              </View>
            </View>
            <View style={s.feeBox}>
              <Text style={s.feeLabel}>Doctor's fee</Text>
              <Text style={s.feeValue}>₦{baseFee.toLocaleString()}</Text>
            </View>
          </View>

          {/* Consultation type */}
          <Text style={s.sectionLabel}>CONSULTATION TYPE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.typeRow}>
            {TYPES.map(t => {
              const active = type === t.key;
              return (
                <TouchableOpacity
                  key={t.key}
                  style={[s.typePill, active && s.typePillActive]}
                  onPress={() => setType(t.key)}
                  activeOpacity={0.8}
                >
                  <Ionicons name={t.icon as any} size={16} color={active ? C.teal : C.muted2} />
                  <Text style={[s.typePillLabel, active && s.typePillLabelActive]}>{t.label}</Text>
                  {t.fee > 0 && <View style={s.typeFeeTag}><Text style={s.typeFeeText}>+₦{t.fee}</Text></View>}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Date & Time */}
          <Text style={s.sectionLabel}>DATE & TIME</Text>
          <View style={s.dateRow}>
            <TouchableOpacity style={s.datePicker} onPress={() => setShowDate(true)}>
              <Ionicons name="calendar-outline" size={18} color={C.teal} />
              <View>
                <Text style={s.datePickerLabel}>Date</Text>
                <Text style={s.datePickerValue}>
                  {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={s.datePicker} onPress={() => setShowTime(true)}>
              <Ionicons name="time-outline" size={18} color={C.teal} />
              <View>
                <Text style={s.datePickerLabel}>Time</Text>
                <Text style={s.datePickerValue}>
                  {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {showDate && (
            <DateTimePicker value={date} mode="date" minimumDate={new Date()}
              onChange={(_, d) => { setShowDate(false); if (d) setDate(d); }} />
          )}
          {showTime && (
            <DateTimePicker value={time} mode="time"
              onChange={(_, t) => { setShowTime(false); if (t) setTime(t); }} />
          )}

          {/* Symptoms */}
          <Text style={s.sectionLabel}>REASON / SYMPTOMS *</Text>
          <TextInput
            style={s.symptomsInput}
            value={symptoms}
            onChangeText={setSymptoms}
            placeholder="Describe your symptoms, concerns, or reason for this consultation..."
            placeholderTextColor={C.muted2}
            multiline
            textAlignVertical="top"
          />

          {/* Summary card */}
          <View style={s.summaryCard}>
            <View style={s.summaryHeader}>
              <Ionicons name="receipt-outline" size={16} color="rgba(255,255,255,0.8)" />
              <Text style={s.summaryHeaderText}>Booking Summary</Text>
            </View>
            <View style={s.summaryBody}>
              {[
                { label: 'Type', value: selectedType.label },
                { label: 'Scheduled', value: `${scheduledAt.toLocaleDateString()} · ${scheduledAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` },
                { label: "Doctor's fee", value: `₦${baseFee.toLocaleString()}` },
                ...(selectedType.fee > 0 ? [{ label: 'Platform fee', value: `₦${selectedType.fee.toLocaleString()}` }] : []),
              ].map((row, i) => (
                <View key={i} style={s.summaryRow}>
                  <Text style={s.summaryKey}>{row.label}</Text>
                  <Text style={s.summaryVal}>{row.value}</Text>
                </View>
              ))}
              <View style={s.summaryDivider} />
              <View style={s.summaryTotalRow}>
                <Text style={s.totalLabel}>Total</Text>
                <Text style={s.totalValue}>₦{totalFee.toLocaleString()}</Text>
              </View>
            </View>
          </View>

          {/* Payment notice */}
          {totalFee > 0 && !reschedule && (
            <View style={s.payNotice}>
              <Ionicons name="lock-closed" size={13} color={C.teal} />
              <Text style={s.payNoticeText}>Secured by Paystack · Card, Bank Transfer & USSD accepted</Text>
            </View>
          )}

          {/* Book / Pay button */}
          <TouchableOpacity
            style={s.bookBtnWrap}
            onPress={handleBook}
            disabled={loading}
            activeOpacity={0.85}
          >
            <LinearGradient colors={[C.tealHero1, C.tealHero2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.bookBtn, loading && { opacity: 0.7 }]}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <>
                    <Ionicons name={totalFee > 0 && !reschedule ? 'card-outline' : 'calendar-outline'} size={18} color="#fff" />
                    <Text style={s.bookBtnText}>
                      {reschedule
                        ? 'Update Consultation'
                        : totalFee > 0
                          ? `Pay ₦${totalFee.toLocaleString()} & Book`
                          : 'Confirm Booking'}
                    </Text>
                  </>}
            </LinearGradient>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#083236' },

  hdrRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 20, backgroundColor: '#083236' },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  hdrTitle: { flex: 1, fontSize: 21, fontFamily: 'Montserrat_700Bold', color: '#fff' },

  paperCard: { flex: 1, backgroundColor: C.paper, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },

  body: { paddingHorizontal: 20, paddingTop: 14, gap: 16, paddingBottom: 20 },

  sectionLabel: { fontSize: 10.5, fontFamily: 'Montserrat_700Bold', color: C.muted, letterSpacing: 1.2 },

  doctorCard: {
    flexDirection: 'row', alignItems: 'center', gap: 13,
    backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.cardBorder,
    padding: 14,
    shadowColor: C.ink, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 3,
  },
  doctorAvatar: { width: 56, height: 56, borderRadius: 16, backgroundColor: 'rgba(11,126,138,0.09)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 },
  doctorAvatarImg: { width: 56, height: 56 },
  doctorName: { fontSize: 14.5, fontFamily: 'Montserrat_700Bold', color: C.textPrimary },
  doctorSpec: { fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted, marginTop: 2 },
  doctorMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  metaText: { fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted },
  metaDot: { fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted2 },
  feeBox: { alignItems: 'flex-end', flexShrink: 0 },
  feeLabel: { fontSize: 10.5, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted2 },
  feeValue: { fontSize: 16, fontFamily: 'Montserrat_700Bold', color: C.teal },

  typeRow: { flexDirection: 'row', gap: 8, paddingBottom: 4 },
  typePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999,
    backgroundColor: C.card, borderWidth: 1.5, borderColor: C.cardBorder,
  },
  typePillActive: { backgroundColor: 'rgba(11,126,138,0.09)', borderColor: C.teal },
  typePillLabel: { fontSize: 13, fontFamily: 'Montserrat_600SemiBold', color: C.muted2 },
  typePillLabelActive: { color: C.teal },
  typeFeeTag: { backgroundColor: 'rgba(11,126,138,0.10)', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  typeFeeText: { fontSize: 10, fontFamily: 'Montserrat_700Bold', color: C.teal },

  dateRow: { flexDirection: 'row', gap: 10 },
  datePicker: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.cardBorder,
    padding: 14,
  },
  datePickerLabel: { fontSize: 10.5, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted2 },
  datePickerValue: { fontSize: 13, fontFamily: 'Montserrat_600SemiBold', color: C.textPrimary, marginTop: 1 },

  symptomsInput: {
    backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.cardBorder,
    padding: 14, fontSize: 14, fontFamily: 'SpaceGrotesk_400Regular', color: C.textPrimary, minHeight: 100,
  },

  summaryCard: {
    borderRadius: 18, overflow: 'hidden',
    shadowColor: C.ink, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.14, shadowRadius: 20, elevation: 8,
  },
  summaryHeader: {
    backgroundColor: C.ink,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  summaryHeaderText: { fontSize: 12, fontFamily: 'Montserrat_700Bold', color: 'rgba(255,255,255,0.85)', letterSpacing: 0.6 },
  summaryBody: { backgroundColor: C.card, borderWidth: 1, borderTopWidth: 0, borderColor: C.cardBorder, borderBottomLeftRadius: 18, borderBottomRightRadius: 18, paddingVertical: 4 },
  summaryRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 11,
  },
  summaryKey: { fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted },
  summaryVal: { fontSize: 13, fontFamily: 'Montserrat_600SemiBold', color: C.textPrimary },
  summaryDivider: { height: 1, backgroundColor: C.cardBorder, marginHorizontal: 16 },
  summaryTotalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  totalLabel: { fontSize: 14, fontFamily: 'Montserrat_700Bold', color: C.textPrimary },
  totalValue: { fontSize: 20, fontFamily: 'Montserrat_800ExtraBold', color: C.teal },

  payNotice: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: 'rgba(11,126,138,0.07)', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 9,
  },
  payNoticeText: { fontSize: 11.5, fontFamily: 'SpaceGrotesk_400Regular', color: C.teal, flex: 1 },

  bookBtnWrap: {
    borderRadius: 16, overflow: 'hidden',
    shadowColor: C.tealHero2, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.26, shadowRadius: 22, elevation: 8,
  },
  bookBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 56 },
  bookBtnText: { fontSize: 16, fontFamily: 'Montserrat_700Bold', color: '#fff' },
});

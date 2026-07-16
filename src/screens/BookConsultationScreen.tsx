import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, Image,
  ActivityIndicator, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { usePaystack } from 'react-native-paystack-webview';
import { supabase } from '../lib/supabase';
import { useNotificationBadge } from '../context/NotificationBadgeContext';
import { useToast } from '../components/ToastProvider';
import FadeScreen from '../components/FadeScreen';

const C = {
  bg: '#F5F3EE', card: '#FFFFFF', border: '#EAE5DA',
  text: '#0C2E30', muted: '#6B7E7F', teal: '#0B7E8A',
  tealDark: '#083236', tealMid: '#0C6570',
  greenLight: 'rgba(11,126,138,0.09)',
  gold: '#D4A843', red: '#EF4444',
};

const TYPES = [
  { key: 'audio',     label: 'Audio Call',  icon: 'call-outline'     },
  { key: 'video',     label: 'Video Call',  icon: 'videocam-outline' },
  { key: 'in_person', label: 'In-Person',   icon: 'person-outline'   },
  { key: 'follow_up', label: 'Follow-Up',   icon: 'refresh-outline'  },
] as const;

// Normalize old-format consultation_types saved before keys were standardised
const CONSULT_KEY_MAP: Record<string, string> = {
  'In-Person': 'in_person', 'in-person': 'in_person',
  'Video Call': 'video',    'Video': 'video',
  'Audio Call': 'audio',    'Audio': 'audio',   'Phone Call': 'audio',
  'Follow-Up': 'follow_up', 'follow-up': 'follow_up',
  'Home Visit': 'in_person', 'Emergency': 'in_person',
};
const normalizeConsultTypes = (types: string[] | null): string[] =>
  (types || []).map(t => CONSULT_KEY_MAP[t] ?? t);

// Sun=0 … Sat=6 → matches JS Date.getDay()
const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_FULL = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

type Slot = { h: number; m: number; label: string; booked: boolean };

const fmtSlot = (h: number, m: number) => {
  const period = h >= 12 ? 'pm' : 'am';
  const hh = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${hh}:${m === 0 ? '00' : m}${period}`;
};

const fmtDate = (d: Date) =>
  d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

const drName = (doctor: any) => {
  if (!doctor?.full_name) return 'Doctor';
  if (/^dr\.?\s/i.test(doctor.full_name.trim())) return doctor.full_name.trim();
  const t = (doctor.title || 'Dr.').trim();
  return `${t.endsWith('.') ? t : t + '.'} ${doctor.full_name.trim()}`;
};

export default function BookConsultationScreen({ route, navigation }: any) {
  const insets = useSafeAreaInsets();
  const toast  = useToast();
  const { doctor: navDoctor, reschedule = false, consultationId, existingData } = route.params ?? {};
  const { refreshUnreadCount } = useNotificationBadge();
  const { popup } = usePaystack();

  // ── Doctor data (loaded fresh from DB) ───────────────────────────────────
  const [doctor, setDoctor]           = useState<any>(navDoctor);
  const [loadingDoctor, setLoadingDoctor] = useState(true);

  // ── Form state ────────────────────────────────────────────────────────────
  const [type, setType]         = useState<string>(existingData?.type || 'audio');
  const [symptoms, setSymptoms] = useState(existingData?.symptoms || '');
  const [date, setDate]         = useState<Date>(() => {
    const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(0,0,0,0); return d;
  });
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [timeSlots, setTimeSlots]       = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [booking, setBooking]           = useState(false);

  // ── Load full doctor profile ──────────────────────────────────────────────
  useEffect(() => {
    if (!navDoctor?.id) { setLoadingDoctor(false); return; }
    supabase
      .from('doctors')
      .select('*')
      .eq('id', navDoctor.id)
      .single()
      .then(({ data }) => {
        if (data) setDoctor(data);
        setLoadingDoctor(false);
      });
  }, [navDoctor?.id]);

  // ── Available consultation types (from doctor's profile) ──────────────────
  const availableTypes = useMemo(() => {
    const raw: string[] | null = doctor?.consultation_types;
    if (!raw || raw.length === 0) return [...TYPES];
    const normalized = normalizeConsultTypes(raw);
    const filtered = TYPES.filter(t => normalized.includes(t.key));
    return filtered.length > 0 ? filtered : [...TYPES];
  }, [doctor]);

  // Ensure selected type is always valid
  useEffect(() => {
    if (availableTypes.length > 0 && !availableTypes.find(t => t.key === type)) {
      setType(availableTypes[0].key);
    }
  }, [availableTypes]);

  // ── Available dates (next 14 days filtered by doctor's working days) ──────
  const availableDates = useMemo(() => {
    const doctorDays: string[] | null = doctor?.availability_days;
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + 1 + i);
      d.setHours(0, 0, 0, 0);
      return d;
    }).filter(d => {
      if (!doctorDays || doctorDays.length === 0) return true;
      return doctorDays.includes(DAY_ABBR[d.getDay()]);
    });
  }, [doctor]);

  // Ensure selected date is in available dates
  useEffect(() => {
    if (availableDates.length > 0) {
      const valid = availableDates.find(d => d.toDateString() === date.toDateString());
      if (!valid) { setDate(availableDates[0]); setSelectedSlot(null); }
    }
  }, [availableDates]);

  // ── Load time slots when date or doctor changes ────────────────────────────
  useEffect(() => {
    if (!doctor?.id || loadingDoctor) return;
    loadTimeSlots(date);
  }, [date, doctor?.id, loadingDoctor]);

  const loadTimeSlots = async (d: Date) => {
    setLoadingSlots(true);
    setSelectedSlot(null);
    try {
      const dateStr  = d.toISOString().split('T')[0];
      const dayName  = DAY_FULL[d.getDay()];

      // Doctor's working hours for this weekday
      const { data: avail } = await supabase
        .from('doctor_availability')
        .select('start_time, end_time')
        .eq('doctor_id', doctor.id)
        .eq('day_of_week', dayName)
        .eq('is_available', true)
        .maybeSingle();

      // Existing bookings for this date (exclude cancelled/completed)
      const { data: bookings } = await supabase
        .from('consultations')
        .select('scheduled_at')
        .eq('doctor_id', doctor.id)
        .gte('scheduled_at', `${dateStr}T00:00:00Z`)
        .lt('scheduled_at',  `${dateStr}T23:59:59Z`)
        .in('status', ['pending', 'confirmed', 'scheduled', 'in_progress']);

      const bookedSet = new Set(
        (bookings || []).map(b => {
          const dt = new Date(b.scheduled_at);
          return `${dt.getHours()}:${dt.getMinutes()}`;
        })
      );

      // Determine working window
      let startH = 9, startM = 0, endH = 17, endM = 0;
      if (avail?.start_time && avail?.end_time) {
        [startH, startM] = avail.start_time.split(':').map(Number);
        [endH, endM]     = avail.end_time.split(':').map(Number);
      }

      // Generate 30-min slots
      const slots: Slot[] = [];
      let h = startH, m = startM;
      while (h < endH || (h === endH && m < endM)) {
        slots.push({
          h, m,
          label: fmtSlot(h, m),
          booked: bookedSet.has(`${h}:${m}`),
        });
        m += 30;
        if (m >= 60) { h += 1; m -= 60; }
      }
      setTimeSlots(slots);
    } catch {
      setTimeSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const totalFee = (() => {
    const perType = doctor?.consultation_fees?.[type];
    if (perType != null && perType > 0) return perType;
    return doctor?.consultation_fee ?? 0;
  })();
  const avatarUrl    = doctor?.avatar_url || doctor?.profile_image || null;
  const selectedType = availableTypes.find(t => t.key === type) ?? availableTypes[0];

  const scheduledAt = useMemo(() => {
    if (!selectedSlot) return null;
    return new Date(
      date.getFullYear(), date.getMonth(), date.getDate(),
      selectedSlot.h, selectedSlot.m
    );
  }, [date, selectedSlot]);

  // ── Booking logic ─────────────────────────────────────────────────────────
  const createConsultation = async (userId: string) => {
    if (reschedule && consultationId) {
      const { error } = await supabase.from('consultations').update({
        consultation_type: type,
        scheduled_at: scheduledAt!.toISOString(),
        symptoms: symptoms.trim(),
        status: 'pending',
        updated_at: new Date().toISOString(),
      }).eq('id', consultationId);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('consultations').insert({
        patient_id: userId,
        doctor_id: doctor.id,
        consultation_type: type,
        scheduled_at: scheduledAt!.toISOString(),
        symptoms: symptoms.trim(),
        status: 'pending',
        consultation_fee: totalFee,
        payment_status: 'pending',
      });
      if (error) throw error;
    }

    // Notify the practitioner of the new request
    const { data: docProfile } = await supabase
      .from('profiles').select('id').eq('id', doctor.user_id || doctor.id).maybeSingle();
    if (docProfile?.id) {
      await supabase.from('notifications').insert({
        user_id: docProfile.id,
        title: 'New Consultation Request',
        message: `A patient has requested a ${selectedType?.label} on ${fmtDate(date)} at ${selectedSlot!.label}. Review and approve or reschedule.`,
        type: 'booking',
      });
    }

    // Notify the patient
    await supabase.from('notifications').insert({
      user_id: userId,
      title: reschedule ? 'Reschedule Requested' : 'Request Sent!',
      message: reschedule
        ? `Your reschedule request for ${fmtDate(date)} at ${selectedSlot!.label} is awaiting approval.`
        : `Your ${selectedType?.label} request with ${drName(doctor)} on ${fmtDate(date)} at ${selectedSlot!.label} is awaiting approval.`,
      type: 'booking',
    });

    refreshUnreadCount();
    toast.showSuccess(
      reschedule ? 'Reschedule Requested' : 'Request Sent!',
      'Awaiting practitioner approval. You\'ll be notified once approved.'
    );
    navigation.navigate('Appointments');
  };

  const handleBook = async () => {
    if (!symptoms.trim()) {
      toast.showWarning('Required', 'Please describe your symptoms or reason for the consultation.');
      return;
    }
    if (!selectedSlot) {
      toast.showWarning('Select a time', 'Please choose an available time slot.');
      return;
    }
    setBooking(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.showError('Error', 'Please sign in first'); return; }
      await createConsultation(user.id);
    } catch (e: any) {
      toast.showError('Booking Failed', e.message || 'Something went wrong');
    } finally {
      setBooking(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <FadeScreen>
      <View style={{ flex: 1, backgroundColor: C.tealDark }}>
        <StatusBar barStyle="light-content" backgroundColor={C.tealDark} />
        <View style={{ height: insets.top, backgroundColor: C.tealDark }} />

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>{reschedule ? 'Reschedule' : 'Book Consultation'}</Text>
        </View>

        {/* Cream card */}
        <View style={s.paperCard}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior="height">
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={[s.body, { paddingBottom: Math.max(insets.bottom + 24, 40) }]}
            >
              {/* ── Doctor card ─────────────────────────────────────────── */}
              <View style={s.doctorCard}>
                {loadingDoctor ? (
                  <ActivityIndicator color={C.teal} style={{ flex: 1, paddingVertical: 14 }} />
                ) : (
                  <>
                    <View style={s.doctorAvatar}>
                      {avatarUrl
                        ? <Image source={{ uri: avatarUrl }} style={s.doctorAvatarImg} />
                        : <MaterialCommunityIcons name="stethoscope" size={26} color={C.teal} />}
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.doctorName} numberOfLines={1}>{drName(doctor)}</Text>
                      <Text style={s.doctorSpec} numberOfLines={1}>{doctor?.specialization || 'General Practice'}</Text>
                      <View style={s.doctorMeta}>
                        <Ionicons name="star" size={12} color={C.gold} />
                        <Text style={s.metaText}>{(doctor?.average_rating ?? 0).toFixed(1)}</Text>
                        <Text style={s.metaDot}>·</Text>
                        <Text style={s.metaText}>{doctor?.years_experience ?? 0} yrs exp</Text>
                      </View>
                    </View>
                    <View style={s.feeBox}>
                      <Text style={s.feeLabel}>Fee</Text>
                      <Text style={s.feeValue}>{totalFee > 0 ? `₦${totalFee.toLocaleString()}` : 'Free'}</Text>
                    </View>
                  </>
                )}
              </View>

              {/* ── Consultation type ────────────────────────────────────── */}
              <Text style={s.sectionLabel}>CONSULTATION TYPE</Text>
              {availableTypes.length === 0 ? (
                <Text style={s.emptyNote}>No consultation types configured by this practitioner.</Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.typeRow}>
                  {availableTypes.map(t => {
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
                </ScrollView>
              )}

              {/* ── Date selection ───────────────────────────────────────── */}
              <Text style={s.sectionLabel}>SELECT DATE</Text>
              {availableDates.length === 0 ? (
                <View style={s.emptyState}>
                  <Ionicons name="calendar-outline" size={32} color={C.muted} />
                  <Text style={s.emptyTitle}>No availability set</Text>
                  <Text style={s.emptyBody}>This practitioner hasn't configured their available days yet.</Text>
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.dateRow}>
                  {availableDates.map((d, i) => {
                    const isSelected = d.toDateString() === date.toDateString();
                    return (
                      <TouchableOpacity
                        key={i}
                        style={[s.dateChip, isSelected && s.dateChipActive]}
                        onPress={() => { setDate(d); setSelectedSlot(null); }}
                        activeOpacity={0.8}
                      >
                        <Text style={[s.dateChipDay, isSelected && s.dateChipTxtActive]}>
                          {d.toLocaleDateString('en-US', { weekday: 'short' })}
                        </Text>
                        <Text style={[s.dateChipNum, isSelected && s.dateChipTxtActive]}>{d.getDate()}</Text>
                        <Text style={[s.dateChipMon, isSelected && s.dateChipTxtActive]}>
                          {d.toLocaleDateString('en-US', { month: 'short' })}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}

              {/* ── Time slots ───────────────────────────────────────────── */}
              <Text style={s.sectionLabel}>SELECT TIME</Text>
              {loadingSlots ? (
                <ActivityIndicator color={C.teal} style={{ paddingVertical: 20 }} />
              ) : timeSlots.length === 0 ? (
                <View style={s.emptyState}>
                  <Ionicons name="time-outline" size={32} color={C.muted} />
                  <Text style={s.emptyTitle}>No slots available</Text>
                  <Text style={s.emptyBody}>Try selecting a different date.</Text>
                </View>
              ) : (
                <View style={s.slotGrid}>
                  {timeSlots.map((slot, i) => {
                    const active = selectedSlot?.label === slot.label;
                    return (
                      <TouchableOpacity
                        key={i}
                        style={[s.slot, active && s.slotActive, slot.booked && s.slotBooked]}
                        onPress={() => !slot.booked && setSelectedSlot(slot)}
                        activeOpacity={slot.booked ? 1 : 0.8}
                        disabled={slot.booked}
                      >
                        <Text style={[s.slotText, active && s.slotTextActive, slot.booked && s.slotTextBooked]}>
                          {slot.label}
                        </Text>
                        {slot.booked && <Text style={s.bookedTag}>Taken</Text>}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* ── Symptoms ─────────────────────────────────────────────── */}
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

              {/* ── Summary ──────────────────────────────────────────────── */}
              <View style={s.summaryCard}>
                <View style={s.summaryHeader}>
                  <Ionicons name="receipt-outline" size={15} color="rgba(255,255,255,0.8)" />
                  <Text style={s.summaryHeaderText}>Booking Summary</Text>
                </View>
                <View style={s.summaryBody}>
                  {[
                    { label: 'Doctor',    value: drName(doctor) },
                    { label: 'Type',      value: selectedType?.label ?? '—' },
                    { label: 'Date',      value: fmtDate(date) },
                    { label: 'Time',      value: selectedSlot?.label ?? 'Not selected', dim: !selectedSlot },
                    { label: 'Fee',       value: totalFee > 0 ? `₦${totalFee.toLocaleString()}` : 'Free' },
                  ].map((row, i) => (
                    <View key={i} style={s.summaryRow}>
                      <Text style={s.summaryKey}>{row.label}</Text>
                      <Text style={[s.summaryVal, row.dim && { color: C.muted }]}>{row.value}</Text>
                    </View>
                  ))}
                  <View style={s.summaryDivider} />
                  <View style={s.summaryTotalRow}>
                    <Text style={s.totalLabel}>Total</Text>
                    <Text style={s.totalValue}>{totalFee > 0 ? `₦${totalFee.toLocaleString()}` : 'Free'}</Text>
                  </View>
                </View>
              </View>

              {/* ── Payment notice ───────────────────────────────────────── */}
              {totalFee > 0 && !reschedule && (
                <View style={s.payNotice}>
                  <Ionicons name="lock-closed" size={13} color={C.teal} />
                  <Text style={s.payNoticeText}>Secured by Paystack · Card, Bank Transfer & USSD accepted</Text>
                </View>
              )}

              {/* ── Book button ──────────────────────────────────────────── */}
              <TouchableOpacity style={s.bookBtnWrap} onPress={handleBook} disabled={booking} activeOpacity={0.85}>
                <LinearGradient
                  colors={[C.tealMid, C.tealDark]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={[s.bookBtn, booking && { opacity: 0.7 }]}
                >
                  {booking
                    ? <ActivityIndicator color="#fff" />
                    : <>
                        <Ionicons
                          name={totalFee > 0 && !reschedule ? 'card-outline' : 'calendar-outline'}
                          size={18} color="#fff"
                        />
                        <Text style={s.bookBtnText}>
                          {reschedule ? 'Request Reschedule' : 'Request Consultation'}
                        </Text>
                      </>}
                </LinearGradient>
              </TouchableOpacity>
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
    backgroundColor: '#083236',
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { flex: 1, fontSize: 20, fontFamily: 'Montserrat_700Bold', color: '#fff' },

  paperCard: {
    flex: 1, backgroundColor: '#F5F3EE',
    borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden',
  },
  body: { paddingHorizontal: 20, paddingTop: 20, gap: 14 },

  sectionLabel: {
    fontSize: 10.5, fontFamily: 'Montserrat_700Bold',
    color: '#6B7E7F', letterSpacing: 1.2, marginBottom: 2,
  },

  // Doctor card
  doctorCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 18,
    borderWidth: 1, borderColor: '#EAE5DA', padding: 14,
    shadowColor: '#0C2E30', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
    minHeight: 80,
  },
  doctorAvatar: {
    width: 54, height: 54, borderRadius: 16,
    backgroundColor: 'rgba(11,126,138,0.09)',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', flexShrink: 0,
  },
  doctorAvatarImg: { width: 54, height: 54 },
  doctorName: { fontSize: 14.5, fontFamily: 'Montserrat_700Bold', color: '#0C2E30' },
  doctorSpec: { fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: '#6B7E7F', marginTop: 2 },
  doctorMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  metaText: { fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: '#6B7E7F' },
  metaDot: { fontSize: 12, color: '#97A2A0' },
  feeBox: { alignItems: 'flex-end', flexShrink: 0 },
  feeLabel: { fontSize: 10, fontFamily: 'SpaceGrotesk_400Regular', color: '#97A2A0' },
  feeValue: { fontSize: 16, fontFamily: 'Montserrat_700Bold', color: '#0B7E8A' },

  // Consultation type
  typeRow: { flexDirection: 'row', gap: 8, paddingBottom: 2 },
  typePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999,
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#EAE5DA',
  },
  typePillActive: { backgroundColor: 'rgba(11,126,138,0.09)', borderColor: '#0B7E8A' },
  typePillLabel: { fontSize: 13, fontFamily: 'Montserrat_600SemiBold', color: '#6B7E7F' },
  typePillLabelActive: { color: '#0B7E8A' },

  // Date chips
  dateRow: { flexDirection: 'row', gap: 8, paddingBottom: 2 },
  dateChip: {
    alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 14, backgroundColor: '#fff',
    borderWidth: 1.5, borderColor: '#EAE5DA', minWidth: 58,
  },
  dateChipActive: { backgroundColor: '#0B7E8A', borderColor: '#0B7E8A' },
  dateChipDay: { fontSize: 10, fontFamily: 'SpaceGrotesk_400Regular', color: '#6B7E7F' },
  dateChipNum: { fontSize: 18, fontFamily: 'Montserrat_700Bold', color: '#0C2E30', marginVertical: 2 },
  dateChipMon: { fontSize: 10, fontFamily: 'SpaceGrotesk_400Regular', color: '#6B7E7F' },
  dateChipTxtActive: { color: '#fff' },

  // Time slots
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slot: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10,
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#EAE5DA',
    alignItems: 'center',
  },
  slotActive:  { backgroundColor: '#0B7E8A', borderColor: '#0B7E8A' },
  slotBooked:  { backgroundColor: '#F5F3EE', borderColor: '#EAE5DA', opacity: 0.55 },
  slotText:    { fontSize: 13, fontFamily: 'Montserrat_600SemiBold', color: '#0C2E30' },
  slotTextActive: { color: '#fff' },
  slotTextBooked: { color: '#6B7E7F' },
  bookedTag: { fontSize: 9, fontFamily: 'SpaceGrotesk_400Regular', color: '#6B7E7F', marginTop: 1 },

  // Empty states
  emptyState: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyTitle: { fontSize: 14, fontFamily: 'Montserrat_700Bold', color: '#0C2E30' },
  emptyBody:  { fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: '#6B7E7F', textAlign: 'center' },
  emptyNote:  { fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: '#6B7E7F', paddingVertical: 8 },

  // Symptoms
  symptomsInput: {
    backgroundColor: '#fff', borderRadius: 14,
    borderWidth: 1, borderColor: '#EAE5DA',
    padding: 14, fontSize: 14,
    fontFamily: 'SpaceGrotesk_400Regular', color: '#0C2E30',
    minHeight: 100,
  },

  // Summary
  summaryCard: {
    borderRadius: 18, overflow: 'hidden',
    shadowColor: '#0C2E30', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.10, shadowRadius: 16, elevation: 6,
  },
  summaryHeader: {
    backgroundColor: '#0C2E30',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  summaryHeaderText: {
    fontSize: 12, fontFamily: 'Montserrat_700Bold',
    color: 'rgba(255,255,255,0.85)', letterSpacing: 0.6,
  },
  summaryBody: {
    backgroundColor: '#fff', borderWidth: 1, borderTopWidth: 0,
    borderColor: '#EAE5DA', borderBottomLeftRadius: 18, borderBottomRightRadius: 18,
  },
  summaryRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
  },
  summaryKey: { fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: '#6B7E7F' },
  summaryVal: { fontSize: 13, fontFamily: 'Montserrat_600SemiBold', color: '#0C2E30', maxWidth: '55%', textAlign: 'right' },
  summaryDivider: { height: 1, backgroundColor: '#EAE5DA', marginHorizontal: 16 },
  summaryTotalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  totalLabel: { fontSize: 14, fontFamily: 'Montserrat_700Bold', color: '#0C2E30' },
  totalValue: { fontSize: 20, fontFamily: 'Montserrat_800ExtraBold', color: '#0B7E8A' },

  // Payment notice
  payNotice: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: 'rgba(11,126,138,0.07)', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 9,
  },
  payNoticeText: { fontSize: 11.5, fontFamily: 'SpaceGrotesk_400Regular', color: '#0B7E8A', flex: 1 },

  // Book button
  bookBtnWrap: {
    borderRadius: 16, overflow: 'hidden',
    shadowColor: '#083236', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22, shadowRadius: 18, elevation: 7,
  },
  bookBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 56 },
  bookBtnText: { fontSize: 16, fontFamily: 'Montserrat_700Bold', color: '#fff' },
});

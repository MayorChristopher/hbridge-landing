import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity, Image,
  ActivityIndicator, Modal, Pressable, TextInput, StatusBar, Dimensions,
} from 'react-native';

const { height: SH } = Dimensions.get('window');
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ToastProvider';
import { shareDoctor } from '../utils/share';

const C = {
  paper: '#F5F3EE', card: '#FFFFFF', cardBorder: '#EAE5DA',
  ink: '#0C2E30', teal: '#0B7E8A', tealHero1: '#0C6570', tealHero2: '#083236',
  gold: '#D4A843', goldBg: 'rgba(212,168,67,0.12)', goldBorder: 'rgba(212,168,67,0.3)',
  muted: '#7A8785', muted2: '#97A2A0', textPrimary: '#16211F', textBody: '#5C6B69',
  green: '#1E9E5A',
};

const drName = (title: string | null, name: string) => {
  if (!name) return 'Medical Practitioner';
  const n = name.trim();
  if (/^(dr\.?|prof\.?|nurse\.?|pharm\.?|physio\.?|rad\.?)\s/i.test(n)) return n;
  const t = (title || 'Dr.').trim();
  return `${t.endsWith('.') ? t : t + '.'} ${n}`;
};

export default function DoctorDetailScreen({ route, navigation }: any) {
  const toast = useToast();
  const { doctor } = route.params;
  const [messaging, setMessaging] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserType, setCurrentUserType] = useState<string | null>(null);
  const [ratingModal, setRatingModal] = useState(false);
  const [myRating, setMyRating] = useState(0);
  const [myReview, setMyReview] = useState('');
  const [existingRating, setExistingRating] = useState<any>(null);
  const [submittingRating, setSubmittingRating] = useState(false);
  const [liveDoctor, setLiveDoctor] = useState(doctor);
  const [hasCompletedConsult, setHasCompletedConsult] = useState(false);

  useEffect(() => { loadUser(); }, []);

  const loadUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setCurrentUserId(user.id);
    const [{ data: prof }, { data: existing }, { data: doc }, { data: consult }] = await Promise.all([
      supabase.from('profiles').select('user_type').eq('id', user.id).single(),
      supabase.from('ratings').select('*').eq('patient_id', user.id).eq('doctor_id', doctor.id).maybeSingle(),
      supabase.from('doctors').select('average_rating,total_reviews,consultation_fee,years_experience,medical_license,title,consultation_types,availability_days').eq('id', doctor.id).single(),
      supabase.from('consultations').select('id').eq('patient_id', user.id).eq('doctor_id', doctor.id).eq('status', 'completed').limit(1),
    ]);
    setCurrentUserType(prof?.user_type || 'patient');
    if (existing) { setExistingRating(existing); setMyRating(existing.rating); setMyReview(existing.review || ''); }
    if (doc) setLiveDoctor((d: any) => ({ ...d, ...doc }));
    setHasCompletedConsult(!!(consult && consult.length > 0));
  };

  const submitRating = async () => {
    if (!currentUserId || myRating === 0) return;
    setSubmittingRating(true);
    try {
      const { error } = await supabase.from('ratings').upsert({
        patient_id: currentUserId, doctor_id: doctor.id,
        rating: myRating, review: myReview.trim() || null,
      }, { onConflict: 'patient_id,doctor_id' });
      if (error) throw error;
      // Trigger has already recalculated average_rating — just re-fetch
      const { data: doc } = await supabase.from('doctors')
        .select('average_rating,total_reviews').eq('id', doctor.id).single();
      if (doc) setLiveDoctor((d: any) => ({ ...d, ...doc }));
      setExistingRating({ rating: myRating, review: myReview });
      setRatingModal(false);
    } catch (e: any) { toast.showError('Error', e.message); }
    finally { setSubmittingRating(false); }
  };

  const openChat = async () => {
    setMessaging(true);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) { toast.showError('Sign in required', authError?.message); return; }
      const { data: existing } = await supabase.from('conversations').select('id').eq('patient_id', user.id).eq('doctor_id', doctor.id).maybeSingle();
      let conversationId = existing?.id;
      if (!conversationId) {
        const { data: created, error: createError } = await supabase.from('conversations').insert({ patient_id: user.id, doctor_id: doctor.id }).select('id').single();
        if (createError) { toast.showError('Error', createError.message); return; }
        conversationId = created?.id;
      }
      navigation.navigate('Conversation', {
        conversationId,
        other: { id: doctor.id, full_name: doctor.full_name, avatar_url: doctor.profile_image, isDoctor: true, title: doctor.title || 'Dr.' },
        currentUserId: user.id,
      });
    } catch (e: any) {
      toast.showError('Error', e?.message || 'Please try again');
    } finally {
      setMessaging(false);
    }
  };

  const feeStr = liveDoctor.consultation_fee
    ? `₦${Number(liveDoctor.consultation_fee).toLocaleString()}`
    : null;

  // Derive regulatory body label from title stored in doctors table
  const TITLE_TO_BODY: Record<string, string> = {
    'Nurse': 'NMCN', 'Pharm.': 'PCN', 'Physio.': 'MRTB', 'Rad.': 'RRBN',
  };
  const licenseBody = liveDoctor.medical_license?.toUpperCase().startsWith('MDCN')
    ? 'MDCN'
    : TITLE_TO_BODY[liveDoctor.title || ''] || 'NMA';
  const licenseLabel = `${licenseBody} Licence`;

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#083236" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>

        {/* ── Hero ── */}
        <View style={s.hero}>
          {/* Background photo or teal */}
          {doctor.profile_image
            ? <Image source={{ uri: doctor.profile_image }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
            : <View style={[StyleSheet.absoluteFillObject, { backgroundColor: C.tealHero2 }]} />}
          <LinearGradient
            colors={['rgba(8,50,54,0.08)', 'rgba(8,50,54,0.55)', 'rgba(8,50,54,0.96)']}
            locations={[0, 0.5, 1]}
            style={StyleSheet.absoluteFillObject}
          />
          {!doctor.profile_image && <View style={s.heroOrb} />}

          {/* Back button — absolute top-left */}
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>

          {/* Bottom row: info left, message right */}
          <View style={s.heroBottom}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={s.heroBadge}>
                <MaterialCommunityIcons name="stethoscope" size={11} color="#fff" />
                <Text style={s.heroBadgeText}>Doctor</Text>
                {(liveDoctor.medical_license || doctor.medical_license) && (
                  <Ionicons name="checkmark-circle" size={13} color={C.gold} style={{ marginLeft: 2 }} />
                )}
              </View>
              <Text style={s.heroName} numberOfLines={1}>
                {drName(liveDoctor.title || doctor.title, doctor.full_name)}
              </Text>
              <Text style={s.heroSpec} numberOfLines={1}>
                {liveDoctor.specialization || doctor.specialization}
              </Text>
              {/* Rating inline */}
              <TouchableOpacity
                style={s.ratingRow}
                onPress={() => {
                  if (currentUserType !== 'patient') return;
                  if (!hasCompletedConsult) { toast.showWarning('Consultation Required', 'You can only rate a doctor after a completed consultation.'); return; }
                  setRatingModal(true);
                }}
                activeOpacity={currentUserType === 'patient' && hasCompletedConsult ? 0.7 : 1}
              >
                <Ionicons name="star" size={13} color={C.gold} />
                <Text style={s.ratingText}>{(liveDoctor.average_rating || 0).toFixed(1)}</Text>
                {liveDoctor.total_reviews > 0 && <Text style={s.ratingCount}>· {liveDoctor.total_reviews} reviews</Text>}
                {currentUserType === 'patient' && hasCompletedConsult && (
                  <Text style={s.tapToRate}>{existingRating ? '· edit' : '· tap to rate'}</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={s.heroActionBtn} onPress={() => shareDoctor(doctor)}>
                <Ionicons name="share-social-outline" size={18} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={s.heroActionBtn} onPress={openChat} disabled={messaging}>
                {messaging
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons name="chatbubble-outline" size={18} color="#fff" />}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── Floating stat rail ── */}
        <View style={s.statRail}>
          <View style={s.statItem}>
            <Text style={s.statVal}>{liveDoctor.years_experience ?? '—'}</Text>
            <Text style={s.statLabel}>Years Exp.</Text>
          </View>
          <View style={s.statDiv} />
          <View style={s.statItem}>
            <Text style={s.statVal}>{(liveDoctor.average_rating || 0).toFixed(1)}</Text>
            <Text style={s.statLabel}>Rating</Text>
          </View>
          <View style={s.statDiv} />
          <View style={s.statItem}>
            <Text style={s.statVal}>{liveDoctor.total_reviews ?? 0}</Text>
            <Text style={s.statLabel}>Reviews</Text>
          </View>
        </View>

        {/* ── Body content ── */}
        <View style={s.body}>

          {/* Availability pill */}
          <View style={[s.availPill, { backgroundColor: liveDoctor.is_available ? 'rgba(30,158,90,0.1)' : 'rgba(150,150,150,0.1)' }]}>
            <View style={[s.availDot, { backgroundColor: liveDoctor.is_available ? C.green : C.muted2 }]} />
            <Text style={[s.availText, { color: liveDoctor.is_available ? C.green : C.muted2 }]}>
              {liveDoctor.is_available ? 'Open for consultations' : 'Not accepting consultations'}
            </Text>
          </View>

          {/* Professional info rows */}
          <Text style={s.sectionLabel}>PROFESSIONAL INFO</Text>
          <View style={s.infoCard}>
            {[
              { icon: 'document-text-outline' as const, label: licenseLabel, value: liveDoctor.medical_license || '—', ion: true },
              { icon: 'stethoscope' as const, label: 'Specialization', value: liveDoctor.specialization || doctor.specialization || '—', ion: false },
              { icon: 'time-outline' as const, label: 'Experience', value: liveDoctor.years_experience ? `${liveDoctor.years_experience} years` : '—', ion: true },
              { icon: 'cash-outline' as const, label: 'Consultation Fee', value: feeStr || 'Fee on request', ion: true },
            ].map((item, i, arr) => (
              <View key={i}>
                <View style={s.infoRow}>
                  <View style={s.infoIconBox}>
                    {item.ion
                      ? <Ionicons name={item.icon as any} size={16} color={C.teal} />
                      : <MaterialCommunityIcons name={item.icon as any} size={16} color={C.teal} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.infoLabel}>{item.label}</Text>
                    <Text style={s.infoValue}>{item.value}</Text>
                  </View>
                </View>
                {i < arr.length - 1 && <View style={s.rowDiv} />}
              </View>
            ))}
          </View>

          {/* Bio */}
          {doctor.bio && (
            <>
              <Text style={[s.sectionLabel, { marginTop: 20 }]}>ABOUT</Text>
              <View style={s.bioCard}>
                <Text style={s.bioText}>{doctor.bio}</Text>
              </View>
            </>
          )}

          {/* CTA — Book only (Message moved to hero) */}
          <TouchableOpacity
            style={s.bookBtnWrap}
            onPress={() => navigation.navigate('BookConsultation', { doctor })}
            activeOpacity={0.85}
          >
            <LinearGradient colors={[C.tealHero1, C.tealHero2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.bookBtn}>
              <Text style={s.bookBtnText}>Book{feeStr ? ` · ${feeStr}` : ' Consultation'}</Text>
              <Ionicons name="arrow-forward" size={15} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>

        </View>
      </ScrollView>

      {/* Rating Modal */}
      <Modal visible={ratingModal} transparent animationType="fade">
        <Pressable style={s.ratingOverlay} onPress={() => setRatingModal(false)}>
          <Pressable style={s.ratingSheet}>
            <Text style={s.ratingTitle}>{existingRating ? 'Update Your Rating' : 'Rate this Doctor'}</Text>
            <Text style={s.ratingSubtitle}>{drName(doctor.title, doctor.full_name)}</Text>
            <View style={s.starRow}>
              {[1, 2, 3, 4, 5].map(star => (
                <TouchableOpacity key={star} onPress={() => setMyRating(star)} activeOpacity={0.75}>
                  <Ionicons name={star <= myRating ? 'star' : 'star-outline'} size={40} color={C.gold} />
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.starLabel}>{['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][myRating]}</Text>
            <TextInput
              style={s.reviewInput}
              value={myReview}
              onChangeText={setMyReview}
              placeholder="Share your experience (optional)..."
              placeholderTextColor={C.muted2}
              multiline
              numberOfLines={3}
              maxLength={500}
            />
            <TouchableOpacity
              style={[s.submitBtn, myRating === 0 && { opacity: 0.45 }]}
              onPress={submitRating}
              disabled={myRating === 0 || submittingRating}
            >
              {submittingRating
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={s.submitBtnText}>{existingRating ? 'Update Rating' : 'Submit Rating'}</Text>}
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },

  // Hero
  hero: {
    minHeight: SH * 0.38,
    overflow: 'hidden',
    backgroundColor: C.tealHero2,
    justifyContent: 'flex-end',
  },
  heroOrb: {
    position: 'absolute',
    width: 220, height: 220, borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.06)',
    top: -60, right: -50,
  },
  backBtn: {
    position: 'absolute', top: 14, left: 20,
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.28)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroBottom: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 20, paddingBottom: 28, gap: 12,
  },
  heroBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(212,168,67,0.22)',
    borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(212,168,67,0.5)',
    marginBottom: 6,
  },
  heroBadgeText: { fontSize: 11, fontFamily: 'Montserrat_700Bold', color: '#fff' },
  heroActionBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, marginBottom: 4,
  },
  heroName: { fontSize: 21, fontFamily: 'Montserrat_700Bold', color: '#fff', letterSpacing: -0.3 },
  heroSpec: { fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: 'rgba(255,255,255,0.75)', marginTop: 3 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  ratingText: { fontSize: 13, fontFamily: 'Montserrat_700Bold', color: '#fff' },
  ratingCount: { fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: 'rgba(255,255,255,0.65)' },
  tapToRate: { fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: C.gold },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  ratingPillText: { fontSize: 13, fontFamily: 'Montserrat_700Bold', color: '#fff' },
  ratingPillCount: { fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: 'rgba(255,255,255,0.7)' },
  tapToRate: { fontSize: 12, fontFamily: 'Montserrat_600SemiBold', color: C.gold },

  // Stat rail
  statRail: {
    flexDirection: 'row',
    backgroundColor: C.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.cardBorder,
    marginHorizontal: 20,
    marginTop: -28,
    paddingVertical: 16,
    shadowColor: C.ink,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 6,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 3 },
  statVal: { fontSize: 19, fontFamily: 'Montserrat_800ExtraBold', color: C.teal },
  statLabel: { fontSize: 10.5, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted2 },
  statDiv: { width: 1, height: 36, backgroundColor: C.cardBorder },

  // Body
  body: { paddingHorizontal: 20, paddingTop: 18 },

  availPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginBottom: 18,
  },
  availDot: { width: 7, height: 7, borderRadius: 4 },
  availText: { fontSize: 12, fontFamily: 'Montserrat_600SemiBold' },

  sectionLabel: {
    fontSize: 10.5,
    fontFamily: 'Montserrat_700Bold',
    color: C.muted,
    letterSpacing: 1.2,
    marginBottom: 10,
  },

  infoCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.cardBorder,
    paddingVertical: 4,
    shadowColor: C.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
  infoIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(11,126,138,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  infoLabel: { fontSize: 10.5, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted2, marginBottom: 2 },
  infoValue: { fontSize: 13.5, fontFamily: 'Montserrat_600SemiBold', color: C.textPrimary },
  rowDiv: { height: 1, backgroundColor: C.cardBorder, marginHorizontal: 14 },

  bioCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.cardBorder,
    padding: 16,
  },
  bioText: { fontSize: 13.5, fontFamily: 'SpaceGrotesk_400Regular', color: C.textBody, lineHeight: 21 },

  // CTA row
  ctaRow: { flexDirection: 'row', gap: 10, marginTop: 24 },
  msgBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderWidth: 1.5,
    borderColor: C.teal,
    borderRadius: 14,
    height: 52,
    backgroundColor: C.card,
  },
  msgBtnText: { fontSize: 14, fontFamily: 'Montserrat_600SemiBold', color: C.teal },
  bookBtnWrap: { flex: 1.5, borderRadius: 14, overflow: 'hidden', shadowColor: C.tealHero2, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.28, shadowRadius: 18, elevation: 8 },
  bookBtn: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  bookBtnText: { fontSize: 14, fontFamily: 'Montserrat_700Bold', color: '#fff' },

  // Rating modal
  ratingOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', paddingHorizontal: 24 },
  ratingSheet: {
    backgroundColor: C.card,
    borderRadius: 24,
    paddingBottom: 32,
    paddingTop: 24,
    paddingHorizontal: 24,
  },
  ratingTitle: { fontSize: 19, fontFamily: 'Montserrat_700Bold', color: C.textPrimary, textAlign: 'center' },
  ratingSubtitle: { fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted, textAlign: 'center', marginTop: 4, marginBottom: 24 },
  starRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 8 },
  starLabel: { fontSize: 14, fontFamily: 'Montserrat_600SemiBold', color: C.gold, textAlign: 'center', height: 20, marginBottom: 20 },
  reviewInput: {
    backgroundColor: C.paper,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: C.cardBorder,
    padding: 14,
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: C.textPrimary,
    minHeight: 88,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  submitBtn: {
    borderRadius: 14,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.teal,
  },
  submitBtnText: { fontSize: 15, fontFamily: 'Montserrat_700Bold', color: '#fff' },
});

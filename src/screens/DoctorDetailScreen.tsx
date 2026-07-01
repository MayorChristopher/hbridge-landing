import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Image, Alert, ActivityIndicator, Modal, Pressable, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

const TEAL = '#0B7E8A';
const GOLD  = '#D4A843';

const drName = (title: string | null, name: string) => {
  if (!name) return 'Doctor';
  if (/^dr\.?\s/i.test(name.trim())) return name.trim();
  const t = (title || 'Dr.').trim();
  return `${t.endsWith('.') ? t : t + '.'} ${name.trim()}`;
};

export default function DoctorDetailScreen({ route, navigation }: any) {
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

  useEffect(() => { loadUser(); }, []);

  const loadUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setCurrentUserId(user.id);
    const { data: prof } = await supabase.from('profiles').select('user_type').eq('id', user.id).single();
    setCurrentUserType(prof?.user_type || 'patient');
    const { data: existing } = await supabase.from('ratings')
      .select('*').eq('patient_id', user.id).eq('doctor_id', doctor.id).maybeSingle();
    if (existing) { setExistingRating(existing); setMyRating(existing.rating); setMyReview(existing.review || ''); }
    const { data: doc } = await supabase.from('doctors').select('average_rating,total_reviews').eq('id', doctor.id).single();
    if (doc) setLiveDoctor((d: any) => ({ ...d, ...doc }));
  };

  const submitRating = async () => {
    if (!currentUserId || myRating === 0) return;
    setSubmittingRating(true);
    try {
      await supabase.from('ratings').upsert({
        patient_id: currentUserId, doctor_id: doctor.id,
        rating: myRating, review: myReview.trim() || null,
      }, { onConflict: 'patient_id,doctor_id' });
      const { data: allR } = await supabase.from('ratings').select('rating').eq('doctor_id', doctor.id);
      if (allR && allR.length > 0) {
        const avg = parseFloat((allR.reduce((s: number, r: any) => s + r.rating, 0) / allR.length).toFixed(1));
        await supabase.from('doctors').update({ average_rating: avg, total_reviews: allR.length }).eq('id', doctor.id);
        setLiveDoctor((d: any) => ({ ...d, average_rating: avg, total_reviews: allR.length }));
      }
      setExistingRating({ rating: myRating, review: myReview });
      setRatingModal(false);
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setSubmittingRating(false); }
  };

  const openChat = async () => {
    setMessaging(true);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) { Alert.alert('Sign in required', authError?.message); return; }

      const { data: existing } = await supabase.from('conversations').select('id').eq('patient_id', user.id).eq('doctor_id', doctor.id).maybeSingle();
      let conversationId = existing?.id;

      if (!conversationId) {
        const { data: created, error: createError } = await supabase.from('conversations').insert({ patient_id: user.id, doctor_id: doctor.id }).select('id').single();
        if (createError) { Alert.alert('Error', createError.message); return; }
        conversationId = created?.id;
      }

      navigation.navigate('Conversation', {
        conversationId,
        other: { id: doctor.id, full_name: doctor.full_name, avatar_url: doctor.profile_image, isDoctor: true, title: doctor.title || 'Dr.' },
        currentUserId: user.id,
      });
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Please try again');
    } finally {
      setMessaging(false);
    }
  };

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      {/* Teal Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>{drName(doctor.title, doctor.full_name)}</Text>
          <Text style={s.headerSub}>{doctor.specialization}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={s.card}>

          {/* Avatar + Info */}
          <View style={s.heroSection}>
            <View style={s.avatarBox}>
              {doctor.profile_image
                ? <Image source={{ uri: doctor.profile_image }} style={s.avatarImg} />
                : <MaterialCommunityIcons name="stethoscope" size={36} color={TEAL} />}
            </View>
            <Text style={s.heroName}>{drName(doctor.title, doctor.full_name)}</Text>
            <Text style={s.heroSpec}>{doctor.specialization}</Text>

            {/* Rating */}
            <TouchableOpacity
              style={s.ratingRow}
              onPress={() => currentUserType === 'patient' && setRatingModal(true)}
              activeOpacity={currentUserType === 'patient' ? 0.7 : 1}
            >
              {[1,2,3,4,5].map(i => (
                <Ionicons key={i} name={i <= Math.round(liveDoctor.average_rating || 0) ? 'star' : 'star-outline'} size={16} color={GOLD} />
              ))}
              <Text style={s.ratingText}>{(liveDoctor.average_rating || 0).toFixed(1)}</Text>
              {liveDoctor.total_reviews > 0 && <Text style={s.ratingCount}>({liveDoctor.total_reviews} reviews)</Text>}
              {currentUserType === 'patient' && (
                <Text style={s.tapToRate}>{existingRating ? '· update rating' : '· tap to rate'}</Text>
              )}
            </TouchableOpacity>

            {/* Available badge */}
            <View style={[s.availBadge, { backgroundColor: doctor.is_available ? '#E6F5F5' : '#f5f5f5' }]}>
              <View style={[s.availDot, { backgroundColor: doctor.is_available ? TEAL : '#737373' }]} />
              <Text style={[s.availText, { color: doctor.is_available ? TEAL : '#737373' }]}>
                {doctor.is_available ? 'Available Now' : 'Unavailable'}
              </Text>
            </View>
          </View>

          {/* Stats */}
          <View style={s.statsRow}>
            <View style={s.statItem}>
              <Text style={s.statVal}>{doctor.years_experience ?? '—'}</Text>
              <Text style={s.statLabel}>Years Exp.</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statItem}>
              <Text style={s.statVal}>{(liveDoctor.average_rating || 0).toFixed(1)}</Text>
              <Text style={s.statLabel}>Rating</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statItem}>
              <Text style={s.statVal}>{liveDoctor.total_reviews ?? 0}</Text>
              <Text style={s.statLabel}>Reviews</Text>
            </View>
          </View>

          <View style={s.divider} />

          {/* Professional Info */}
          <Text style={s.sectionTitle}>Professional Information</Text>
          <View style={s.infoCard}>
            {[
              { icon: 'document-text-outline', label: 'Medical License', value: doctor.medical_license || '—', useIon: true },
              { icon: 'stethoscope', label: 'Specialization', value: doctor.specialization || '—', useIon: false },
              { icon: 'cash-outline', label: 'Consultation Fee', value: doctor.consultation_fee ? `₦${Number(doctor.consultation_fee).toLocaleString()}` : 'Fee on request', useIon: true },
            ].map((item, i, arr) => (
              <View key={i}>
                <View style={s.infoRow}>
                  <View style={s.infoIconBox}>
                    {item.useIon
                      ? <Ionicons name={item.icon as any} size={16} color={TEAL} />
                      : <MaterialCommunityIcons name={item.icon as any} size={16} color={TEAL} />}
                  </View>
                  <View style={s.infoContent}>
                    <Text style={s.infoLabel}>{item.label}</Text>
                    <Text style={s.infoValue}>{item.value}</Text>
                  </View>
                </View>
                {i < arr.length - 1 && <View style={s.rowDivider} />}
              </View>
            ))}
          </View>

          {/* Bio */}
          {doctor.bio && (
            <>
              <Text style={[s.sectionTitle, { marginTop: 20 }]}>About</Text>
              <View style={s.bioCard}>
                <Text style={s.bioText}>{doctor.bio}</Text>
              </View>
            </>
          )}

          {/* Action Buttons */}
          <View style={s.actionRow}>
            <TouchableOpacity style={s.msgBtn} onPress={openChat} disabled={messaging}>
              {messaging
                ? <ActivityIndicator size="small" color={TEAL} />
                : <><Ionicons name="chatbubble-outline" size={16} color={TEAL} /><Text style={s.msgBtnText}>Message</Text></>}
            </TouchableOpacity>
            <TouchableOpacity style={s.bookBtn} onPress={() => navigation.navigate('BookConsultation', { doctor })}>
              <Text style={s.bookBtnText}>Book Consultation</Text>
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </TouchableOpacity>
          </View>

        </View>
      </ScrollView>

      {/* Rating Modal */}
      <Modal visible={ratingModal} transparent animationType="slide">
        <Pressable style={s.ratingOverlay} onPress={() => setRatingModal(false)}>
          <Pressable style={s.ratingSheet}>
            <View style={s.sheetHandle} />
            <Text style={s.ratingTitle}>{existingRating ? 'Update Your Rating' : 'Rate this Doctor'}</Text>
            <Text style={s.ratingSubtitle}>{drName(doctor.title, doctor.full_name)}</Text>
            <View style={s.starRow}>
              {[1,2,3,4,5].map(star => (
                <TouchableOpacity key={star} onPress={() => setMyRating(star)} activeOpacity={0.75}>
                  <Ionicons name={star <= myRating ? 'star' : 'star-outline'} size={40} color={GOLD} />
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.starLabel}>{['','Poor','Fair','Good','Very Good','Excellent'][myRating]}</Text>
            <TextInput
              style={s.reviewInput}
              value={myReview}
              onChangeText={setMyReview}
              placeholder="Share your experience (optional)..."
              placeholderTextColor="#9CA3AF"
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
  container: { flex: 1, backgroundColor: TEAL },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24, gap: 14 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff', letterSpacing: -0.3 },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  card: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, padding: 24, minHeight: '100%' },
  heroSection: { alignItems: 'center', marginBottom: 24, gap: 8 },
  avatarBox: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#E6F5F5', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: TEAL, overflow: 'hidden', marginBottom: 4 },
  avatarImg: { width: 96, height: 96, borderRadius: 48 },
  heroName: { fontSize: 20, fontWeight: '700', color: '#171717' },
  heroSpec: { fontSize: 13, color: '#737373' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontSize: 13, fontWeight: '700', color: '#404040', marginLeft: 4 },
  ratingCount: { fontSize: 12, color: '#737373' },
  availBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 },
  availDot: { width: 7, height: 7, borderRadius: 4 },
  availText: { fontSize: 12, fontWeight: '600' },
  statsRow: { flexDirection: 'row', backgroundColor: '#f9f9f9', borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#f0f0f0' },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statVal: { fontSize: 18, fontWeight: '800', color: TEAL },
  statLabel: { fontSize: 11, color: '#737373' },
  statDivider: { width: 1, height: 32, backgroundColor: '#e5e5e5' },
  divider: { height: 1, backgroundColor: '#f0f0f0', marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#171717', marginBottom: 10 },
  infoCard: { backgroundColor: '#f9f9f9', borderRadius: 12, borderWidth: 1, borderColor: '#f0f0f0', paddingVertical: 4 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  infoIconBox: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#E6F5F5', alignItems: 'center', justifyContent: 'center' },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 11, color: '#737373', marginBottom: 2 },
  infoValue: { fontSize: 14, fontWeight: '600', color: '#171717' },
  rowDivider: { height: 1, backgroundColor: '#f0f0f0', marginHorizontal: 14 },
  bioCard: { backgroundColor: '#f9f9f9', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#f0f0f0' },
  bioText: { fontSize: 14, color: '#525252', lineHeight: 22 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 24 },
  msgBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderColor: TEAL, borderRadius: 14, height: 52 },
  msgBtnText: { fontSize: 14, fontWeight: '600', color: TEAL },
  bookBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: TEAL, borderRadius: 14, height: 52 },
  bookBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  tapToRate: { fontSize: 12, color: GOLD, fontWeight: '500', marginLeft: 4 },

  // Rating modal
  ratingOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  ratingSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 40, paddingTop: 12, paddingHorizontal: 24 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', alignSelf: 'center', marginBottom: 20 },
  ratingTitle: { fontSize: 18, fontWeight: '700', color: '#171717', textAlign: 'center' },
  ratingSubtitle: { fontSize: 13, color: '#737373', textAlign: 'center', marginTop: 4, marginBottom: 24 },
  starRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 8 },
  starLabel: { fontSize: 14, fontWeight: '600', color: GOLD, textAlign: 'center', height: 20, marginBottom: 20 },
  reviewInput: { backgroundColor: '#F9FAFB', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', padding: 14, fontSize: 14, color: '#171717', minHeight: 88, textAlignVertical: 'top', marginBottom: 16 },
  submitBtn: { backgroundColor: TEAL, borderRadius: 14, height: 52, alignItems: 'center', justifyContent: 'center' },
  submitBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});

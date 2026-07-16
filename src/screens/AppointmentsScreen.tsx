import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  ActivityIndicator, Image, Modal, RefreshControl, TextInput, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../lib/supabase';
import RatingModal from '../components/RatingModal';
import { useToast } from '../components/ToastProvider';
import { drName } from '../utils/formatters';
import { usePaystack } from 'react-native-paystack-webview';

const C = {
  paper: '#F5F3EE', card: '#FFFFFF', cardBorder: '#EAE5DA',
  ink: '#0C2E30', teal: '#0B7E8A', gold: '#D4A843',
  muted: '#7A8785', muted2: '#97A2A0', textPrimary: '#16211F', textBody: '#5C6B69',
  green: '#1E9E5A', red: '#EF4444', redBg: '#FEE2E2',
};

interface Consultation {
  id: string; scheduled_at: string;
  status: 'pending' | 'confirmed' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  payment_status: string; consultation_type: string; consultation_fee: number;
  symptoms?: string; diagnosis?: string;
  doctor: { id: string; user_id?: string; full_name: string; specialization: string; profile_image?: string; paystack_subaccount?: string; };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    pending:     { bg: 'rgba(212,168,67,0.12)',  color: C.gold,  label: 'Awaiting Approval' },
    confirmed:   { bg: 'rgba(11,126,138,0.12)',  color: C.teal,  label: 'Approved — Pay Now' },
    scheduled:   { bg: 'rgba(11,126,138,0.08)',  color: C.teal,  label: 'Confirmed' },
    in_progress: { bg: 'rgba(30,158,90,0.1)',    color: C.green, label: 'In Progress' },
    completed:   { bg: 'rgba(11,126,138,0.1)',   color: C.teal,  label: 'Completed' },
    cancelled:   { bg: '#FEE2E2',                color: C.red,   label: 'Cancelled' },
  };
  const { bg, color, label } = map[status] || { bg: 'rgba(212,168,67,0.12)', color: C.gold, label: status };
  return (
    <View style={[s.badge, { backgroundColor: bg }]}>
      <Text style={[s.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

function SpecIcon({ spec }: { spec: string }) {
  const sl = spec?.toLowerCase() || '';
  let icon: any = 'medical-outline';
  if (sl.includes('cardio') || sl.includes('heart')) icon = 'heart-outline';
  else if (sl.includes('neuro')) icon = 'pulse-outline';
  else if (sl.includes('ortho')) icon = 'body-outline';
  return <Ionicons name={icon} size={20} color={C.teal} />;
}

function SheetRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted }}>{label}</Text>
      <Text style={{ fontSize: 12, fontFamily: 'Montserrat_600SemiBold', color: C.textPrimary }}>{value}</Text>
    </View>
  );
}

export default function AppointmentsScreen({ navigation }: any) {
  const toast = useToast();
  const { popup } = usePaystack();
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [activeFilter, setActiveFilter]   = useState<'All' | 'In-Person' | 'Video Call'>('All');
  const [search, setSearch]               = useState('');
  const [ratingModal, setRatingModal]     = useState<{ visible: boolean; doctorId: string; doctorName: string; consultationId: string } | null>(null);
  const [reportSheet, setReportSheet]     = useState<Consultation | null>(null);
  const [ratedDoctorIds, setRatedDoctorIds] = useState<Set<string>>(new Set());
  const [payingId, setPayingId]           = useState<string | null>(null);

  useEffect(() => { loadConsultations(); }, []);

  const loadConsultations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [{ data, error }, { data: myRatings }] = await Promise.all([
        supabase.from('consultations')
          .select('id,scheduled_at,status,payment_status,consultation_type,consultation_fee,symptoms,diagnosis,doctors(id,user_id,full_name,specialization,profile_image,paystack_subaccount)')
          .eq('patient_id', user.id).order('scheduled_at', { ascending: false }),
        supabase.from('ratings').select('doctor_id').eq('patient_id', user.id),
      ]);
      if (error) throw error;
      setRatedDoctorIds(new Set((myRatings || []).map((r: any) => r.doctor_id)));
      setConsultations((data || []).map((c: any) => ({
        id: c.id, scheduled_at: c.scheduled_at, status: c.status,
        payment_status: c.payment_status || 'pending',
        consultation_type: c.consultation_type, consultation_fee: c.consultation_fee || 0,
        symptoms: c.symptoms, diagnosis: c.diagnosis,
        doctor: { id: c.doctors?.id, user_id: c.doctors?.user_id, full_name: c.doctors?.full_name || 'Unknown Doctor', specialization: c.doctors?.specialization || 'General', profile_image: c.doctors?.profile_image, paystack_subaccount: c.doctors?.paystack_subaccount },
      })));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const onRefresh = async () => { setRefreshing(true); await loadConsultations(); setRefreshing(false); };

  const handleBookAgain = async (c: Consultation) => {
    const { data } = await supabase.from('doctors').select('*').eq('id', c.doctor.id).single();
    if (data) navigation.navigate('BookConsultation', { doctor: data });
  };

  const handleReschedule = async (c: Consultation) => {
    const { data } = await supabase.from('consultations').select('*,doctors(*)').eq('id', c.id).single();
    if (data?.doctors) navigation.navigate('BookConsultation', { doctor: data.doctors, reschedule: true, consultationId: c.id, existingData: { type: data.consultation_type, symptoms: data.symptoms } });
  };

  const handleViewReport = (c: Consultation) => setReportSheet(c);

  const handlePayNow = async (c: Consultation) => {
    if (payingId) return;
    setPayingId(c.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from('profiles').select('phone').eq('id', user.id).single();
      popup.checkout({
        email: user.email || '',
        amount: c.consultation_fee,
        reference: `hb_${Date.now()}`,
        ...(c.doctor.paystack_subaccount ? {
          split: {
            type: 'percentage' as const,
            bearer_type: 'account' as const,
            subaccounts: [{ subaccount: c.doctor.paystack_subaccount, share: '85' }],
          },
        } : {}),
        onSuccess: async (response: any) => {
          const ref = response?.reference || `paid_${Date.now()}`;
          const { error } = await supabase.from('consultations').update({
            status: 'scheduled',
            payment_status: 'paid',
            payment_reference: ref,
            updated_at: new Date().toISOString(),
          }).eq('id', c.id);
          if (error) { toast.showError('Error', 'Payment received but booking update failed. Contact support: ' + ref); return; }
          // Notify practitioner
          if (c.doctor.user_id) {
            await supabase.from('notifications').insert({
              user_id: c.doctor.user_id,
              title: 'Consultation Paid',
              message: `A patient has paid for their ${c.consultation_type} consultation. It is now confirmed.`,
              type: 'booking',
            });
          }
          toast.showSuccess('Confirmed!', 'Payment received. Your consultation is confirmed.');
          loadConsultations();
        },
        onCancel: () => { setPayingId(null); toast.showInfo('Cancelled', 'No charge was made.'); },
      });
    } catch (e: any) {
      toast.showError('Error', e.message);
    } finally {
      setPayingId(null);
    }
  };

  const joinCall = async (id: string) => {
    // Mark as in_progress and record start time if not already started
    await supabase.from('consultations')
      .update({ status: 'in_progress', started_at: new Date().toISOString() })
      .eq('id', id)
      .neq('status', 'completed');
    loadConsultations();
    await WebBrowser.openBrowserAsync(`https://meet.jit.si/hbridge-${id.replace(/-/g, '').slice(0, 16)}`);
    // Browser closed — refresh to reflect any status change the doctor made
    loadConsultations();
  };

  const filtered = consultations.filter(c => {
    const matchesFilter = activeFilter === 'All'
      || (activeFilter === 'Video Call' && (c.consultation_type === 'video' || c.consultation_type === 'audio'))
      || (activeFilter === 'In-Person' && c.consultation_type === 'in_person');
    const matchesSearch = !search.trim()
      || c.doctor.full_name.toLowerCase().includes(search.toLowerCase())
      || c.doctor.specialization.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#083236" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.teal} colors={[C.teal]} />}
      >
        {/* Header */}
        <View style={s.hdrRow}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={s.hdrTitle}>Consultations</Text>
        </View>

        <View style={s.paperCard}>
        {loading ? (
          <ActivityIndicator color={C.teal} style={{ marginTop: 60 }} />
        ) : (
        <View style={s.innerPad}>
          {/* Search */}
          <View style={s.searchBar}>
            <Ionicons name="search" size={18} color={C.muted2} />
            <TextInput
              style={s.searchInput}
              placeholder="Search by doctor or specialty..."
              placeholderTextColor={C.muted2}
              value={search}
              onChangeText={setSearch}
            />
          </View>

          {/* Filter chips */}
          <View style={s.chips}>
            {(['All', 'In-Person', 'Video Call'] as const).map(f => (
              <TouchableOpacity
                key={f}
                style={[s.chip, activeFilter === f && s.chipActive]}
                onPress={() => setActiveFilter(f)}
              >
                <Text style={[s.chipText, activeFilter === f && s.chipTextActive]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* List */}
          {filtered.length === 0 ? (
            <View style={s.empty}>
              <View style={s.emptyIconWrap}>
                <Ionicons name="calendar-outline" size={34} color={C.teal} />
              </View>
              <Text style={s.emptyTitle}>No consultations found</Text>
              <Text style={s.emptyText}>Book a consultation with a doctor to get started</Text>
              <TouchableOpacity style={s.findBtn} onPress={() => navigation.navigate('Explore')}>
                <Text style={s.findBtnText}>Find a Doctor</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.list}>
              {filtered.map(c => {
                const isVirtual   = c.consultation_type === 'video' || c.consultation_type === 'audio';
                const isCancelled = c.status === 'cancelled';
                const isCompleted = c.status === 'completed';
                const isPending   = c.status === 'pending';
                const isConfirmed = c.status === 'confirmed';
                return (
                  <View key={c.id} style={s.consCard}>
                    {/* Doctor row */}
                    <View style={s.cardTop}>
                      <View style={s.avatarBox}>
                        {c.doctor.profile_image
                          ? <Image source={{ uri: c.doctor.profile_image }} style={s.avatarImg} />
                          : <MaterialCommunityIcons name="stethoscope" size={24} color={C.teal} />}
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Text style={s.doctorName} numberOfLines={1}>{drName(c.doctor.full_name, c.doctor.title)}</Text>
                          <StatusBadge status={c.status} />
                        </View>
                        <Text style={s.specialty}>{c.doctor.specialization}</Text>
                      </View>
                    </View>

                    <View style={s.divider} />

                    {/* Meta row */}
                    <View style={s.metaRow}>
                      <View style={s.metaItem}>
                        <Ionicons name="calendar-outline" size={13} color={C.muted} />
                        <Text style={s.metaText}>{formatDate(c.scheduled_at)}</Text>
                      </View>
                      <View style={s.metaItem}>
                        <Ionicons name="time-outline" size={13} color={C.muted} />
                        <Text style={s.metaText}>{formatTime(c.scheduled_at)}</Text>
                      </View>
                      <View style={s.metaItem}>
                        {isVirtual
                          ? <Ionicons name="videocam-outline" size={13} color={C.muted} />
                          : <Ionicons name="location-outline" size={13} color={C.muted} />}
                        <Text style={s.metaText}>{isVirtual ? 'Video Call' : 'In-Person'}</Text>
                      </View>
                    </View>

                    {/* Notes */}
                    {(c.diagnosis || c.symptoms) && (
                      <Text style={s.notes} numberOfLines={2}>
                        {c.diagnosis ? `Diagnosis: ${c.diagnosis}` : `Symptoms: ${c.symptoms}`}
                      </Text>
                    )}
                    {isCancelled && <Text style={s.notes}>Appointment was cancelled.</Text>}

                    {/* Actions */}
                    <View style={s.actions}>
                      {isPending ? (
                        <>
                          <TouchableOpacity style={s.btnOutline} onPress={() => handleViewReport(c)}>
                            <Ionicons name="document-text-outline" size={14} color={C.teal} />
                            <Text style={s.btnOutlineText}>Details</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={[s.btnDark, { backgroundColor: C.red }]} onPress={() => handleReschedule(c)}>
                            <Ionicons name="close-circle-outline" size={14} color="#fff" />
                            <Text style={s.btnDarkText}>Cancel</Text>
                          </TouchableOpacity>
                        </>
                      ) : isConfirmed ? (
                        <>
                          <TouchableOpacity style={s.btnOutline} onPress={() => handleViewReport(c)}>
                            <Ionicons name="document-text-outline" size={14} color={C.teal} />
                            <Text style={s.btnOutlineText}>Details</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[s.btnDark, { flex: 1, backgroundColor: '#1E9E5A' }]}
                            onPress={() => handlePayNow(c)}
                            disabled={payingId === c.id}
                          >
                            <Ionicons name="card-outline" size={14} color="#fff" />
                            <Text style={s.btnDarkText}>{payingId === c.id ? 'Processing...' : `Pay ₦${c.consultation_fee.toLocaleString()}`}</Text>
                          </TouchableOpacity>
                        </>
                      ) : isCancelled ? (
                        <TouchableOpacity style={[s.btnDark, { flex: 1 }]} onPress={() => handleReschedule(c)}>
                          <Ionicons name="calendar-outline" size={14} color="#fff" />
                          <Text style={s.btnDarkText}>Book Again</Text>
                        </TouchableOpacity>
                      ) : isCompleted ? (
                        <>
                          <TouchableOpacity style={s.btnOutline} onPress={() => handleViewReport(c)}>
                            <Ionicons name="document-text-outline" size={14} color={C.teal} />
                            <Text style={s.btnOutlineText}>View Report</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={s.btnDark} onPress={() => handleBookAgain(c)}>
                            <Ionicons name="refresh-outline" size={14} color="#fff" />
                            <Text style={s.btnDarkText}>Book Again</Text>
                          </TouchableOpacity>
                        </>
                      ) : (
                        <>
                          {isVirtual && (
                            <TouchableOpacity style={s.btnCall} onPress={() => joinCall(c.id)}>
                              <Ionicons name="videocam" size={14} color="#fff" />
                              <Text style={s.btnCallText}>Join Call</Text>
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity style={s.btnOutline} onPress={() => handleViewReport(c)}>
                            <Ionicons name="document-text-outline" size={14} color={C.teal} />
                            <Text style={s.btnOutlineText}>Details</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={s.btnDark} onPress={() => handleReschedule(c)}>
                            <Ionicons name="create-outline" size={14} color="#fff" />
                            <Text style={s.btnDarkText}>Reschedule</Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
        )}{/* end loading conditional */}
        </View>{/* paperCard */}
      </ScrollView>

      {ratingModal && (
        <RatingModal
          visible={ratingModal.visible}
          onClose={() => setRatingModal(null)}
          onSuccess={(id) => setRatedDoctorIds(prev => new Set([...prev, id]))}
          doctorId={ratingModal.doctorId}
          doctorName={ratingModal.doctorName}
          consultationId={ratingModal.consultationId}
        />
      )}

      {/* Report / Details Bottom Sheet */}
      <Modal visible={!!reportSheet} animationType="slide" transparent onRequestClose={() => setReportSheet(null)}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.sheetHandle} />
            {reportSheet && (
              <>
                <View style={s.sheetHeader}>
                  <View style={s.sheetAvatar}>
                    {reportSheet.doctor.profile_image
                      ? <Image source={{ uri: reportSheet.doctor.profile_image }} style={{ width: 48, height: 48, borderRadius: 14 }} />
                      : <MaterialCommunityIcons name="stethoscope" size={24} color={C.teal} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.sheetDrName}>{drName(reportSheet.doctor.full_name, reportSheet.doctor.title)}</Text>
                    <Text style={s.sheetDrSpec}>{reportSheet.doctor.specialization}</Text>
                  </View>
                  <StatusBadge status={reportSheet.status} />
                </View>

                <View style={s.sheetDivider} />

                <View style={s.sheetRows}>
                  <SheetRow label="Date" value={formatDate(reportSheet.scheduled_at)} />
                  <SheetRow label="Time" value={formatTime(reportSheet.scheduled_at)} />
                  <SheetRow label="Type" value={(reportSheet.consultation_type || '').replace('_', '-')} />
                  {reportSheet.consultation_fee > 0 && (
                    <SheetRow label="Fee" value={`₦${reportSheet.consultation_fee.toLocaleString()}`} />
                  )}
                </View>

                {reportSheet.symptoms && (
                  <View style={s.sheetSection}>
                    <Text style={s.sheetSectionLabel}>SYMPTOMS</Text>
                    <Text style={s.sheetSectionText}>{reportSheet.symptoms}</Text>
                  </View>
                )}
                {reportSheet.diagnosis && (
                  <View style={s.sheetSection}>
                    <Text style={s.sheetSectionLabel}>DIAGNOSIS</Text>
                    <Text style={s.sheetSectionText}>{reportSheet.diagnosis}</Text>
                  </View>
                )}
                {!reportSheet.symptoms && !reportSheet.diagnosis && (
                  <View style={s.sheetSection}>
                    <Text style={[s.sheetSectionText, { color: C.muted2, textAlign: 'center', paddingVertical: 8 }]}>No clinical notes available.</Text>
                  </View>
                )}

                <View style={s.sheetActions}>
                  {(reportSheet.consultation_type === 'video' || reportSheet.consultation_type === 'audio') &&
                    reportSheet.status !== 'completed' && reportSheet.status !== 'cancelled' && (
                    <TouchableOpacity style={s.joinBtn} onPress={() => { setReportSheet(null); joinCall(reportSheet.id); }}>
                      <Ionicons name="videocam" size={16} color="#fff" />
                      <Text style={s.joinBtnText}>Join Call</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={s.recordsBtn}
                    onPress={() => { setReportSheet(null); navigation.navigate('MedicalHistory'); }}
                  >
                    <Ionicons name="medkit-outline" size={16} color={C.teal} />
                    <Text style={s.recordsBtnText}>Prescriptions & Records</Text>
                  </TouchableOpacity>
                  {reportSheet.status === 'completed' && (
                    ratedDoctorIds.has(reportSheet.doctor.id) ? (
                      <View style={[s.rateBtn, { backgroundColor: 'rgba(212,168,67,0.10)' }]}>
                        <Ionicons name="star" size={16} color={C.gold} />
                        <Text style={[s.rateBtnText, { color: C.gold }]}>Rated</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={s.rateBtn}
                        onPress={() => {
                          setReportSheet(null);
                          setRatingModal({ visible: true, doctorId: reportSheet.doctor.id, doctorName: reportSheet.doctor.full_name, consultationId: reportSheet.id });
                        }}
                      >
                        <Ionicons name="star-outline" size={16} color={C.gold} />
                        <Text style={s.rateBtnText}>Rate Doctor</Text>
                      </TouchableOpacity>
                    )
                  )}
                  <TouchableOpacity style={s.closeBtn} onPress={() => setReportSheet(null)}>
                    <Text style={s.closeBtnText}>Close</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#083236' },

  paperCard: { flex: 1, backgroundColor: C.paper, borderTopLeftRadius: 28, borderTopRightRadius: 28 },

  hdrRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 20, backgroundColor: '#083236' },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  hdrTitle: { flex: 1, fontSize: 22, fontFamily: 'Montserrat_700Bold', color: '#fff' },

  innerPad: { paddingHorizontal: 20, paddingTop: 10, gap: 14 },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.cardBorder,
    borderRadius: 14, paddingHorizontal: 14, height: 50,
    shadowColor: C.ink, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: 'SpaceGrotesk_400Regular', color: C.textPrimary, paddingVertical: 0 },

  chips: { flexDirection: 'row', gap: 8 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 100,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.cardBorder,
  },
  chipActive: { backgroundColor: C.ink, borderColor: C.ink },
  chipText: { fontSize: 12, fontFamily: 'Montserrat_500Medium', color: C.textBody },
  chipTextActive: { color: '#fff', fontFamily: 'Montserrat_600SemiBold' },

  list: { gap: 14 },

  consCard: {
    backgroundColor: C.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.cardBorder,
    padding: 16,
    gap: 12,
    shadowColor: C.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  avatarBox: {
    width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(11,126,138,0.09)',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0,
  },
  avatarImg: { width: 48, height: 48 },
  doctorName: { fontSize: 14.5, fontFamily: 'Montserrat_700Bold', color: C.textPrimary, flexShrink: 1 },
  specialty: { fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted, marginTop: 2 },

  divider: { height: 1, backgroundColor: C.cardBorder },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 14, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted },

  notes: { fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted, lineHeight: 18 },

  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100, flexShrink: 0 },
  badgeText: { fontSize: 11, fontFamily: 'Montserrat_600SemiBold' },

  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  btnCall: {
    flex: 1, height: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, backgroundColor: '#0B7E8A', borderRadius: 11,
  },
  btnCallText: { fontSize: 12, fontFamily: 'Montserrat_600SemiBold', color: '#fff' },
  btnOutline: {
    flex: 1, height: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, borderWidth: 1.5, borderColor: C.teal, borderRadius: 11,
    backgroundColor: 'rgba(11,126,138,0.05)',
  },
  btnOutlineText: { fontSize: 12, fontFamily: 'Montserrat_600SemiBold', color: C.teal },
  btnDark: {
    flex: 1, height: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: C.ink, borderRadius: 11,
  },
  btnDarkText: { fontSize: 12, fontFamily: 'Montserrat_600SemiBold', color: '#fff' },

  empty: { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyIconWrap: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: 'rgba(11,126,138,0.1)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  emptyTitle: { fontSize: 16, fontFamily: 'Montserrat_700Bold', color: C.textPrimary },
  emptyText: { fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted, textAlign: 'center', maxWidth: 260 },
  findBtn: { marginTop: 6, backgroundColor: C.teal, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 12 },
  findBtnText: { fontSize: 14, fontFamily: 'Montserrat_600SemiBold', color: '#fff' },

  // Bottom sheet
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 36 },
  sheetHandle: { width: 40, height: 4, backgroundColor: '#EAE5DA', borderRadius: 2, alignSelf: 'center', marginBottom: 18 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  sheetAvatar: { width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(11,126,138,0.09)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 },
  sheetDrName: { fontSize: 15, fontFamily: 'Montserrat_700Bold', color: C.textPrimary },
  sheetDrSpec: { fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted, marginTop: 2 },
  sheetDivider: { height: 1, backgroundColor: C.cardBorder, marginBottom: 14 },
  sheetRows: { gap: 8, marginBottom: 14 },
  sheetSection: { backgroundColor: '#F5F3EE', borderRadius: 12, padding: 12, marginBottom: 10 },
  sheetSectionLabel: { fontSize: 10, fontFamily: 'Montserrat_700Bold', color: C.muted2, letterSpacing: 0.8, marginBottom: 5 },
  sheetSectionText: { fontSize: 13.5, fontFamily: 'SpaceGrotesk_400Regular', color: C.textPrimary, lineHeight: 20 },
  sheetActions: { gap: 8, marginTop: 4 },
  joinBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, height: 46, borderRadius: 13, backgroundColor: '#0B7E8A' },
  joinBtnText: { fontSize: 14, fontFamily: 'Montserrat_700Bold', color: '#fff' },
  recordsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, height: 44, borderRadius: 13, borderWidth: 1.5, borderColor: C.teal, backgroundColor: 'rgba(11,126,138,0.05)' },
  recordsBtnText: { fontSize: 13, fontFamily: 'Montserrat_600SemiBold', color: C.teal },
  rateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 46, borderRadius: 13, borderWidth: 1.5, borderColor: C.gold, backgroundColor: 'rgba(212,168,67,0.07)' },
  rateBtnText: { fontSize: 14, fontFamily: 'Montserrat_600SemiBold', color: C.gold },
  closeBtn: { alignItems: 'center', justifyContent: 'center', height: 44, borderRadius: 13, backgroundColor: '#EDE9E0' },
  closeBtnText: { fontSize: 14, fontFamily: 'Montserrat_600SemiBold', color: C.muted },
});

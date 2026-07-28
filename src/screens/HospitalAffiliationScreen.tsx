import React, { useState, useCallback, useEffect } from 'react';
import {
  StyleSheet, Text, View, FlatList, TouchableOpacity, Image,
  TextInput, ActivityIndicator, RefreshControl, StatusBar, Modal,
  Animated, Easing, ScrollView, Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ToastProvider';
import { shadows } from '../utils/design';
import { sendNotifications } from '../utils/notify';
import { isHospitalSetupComplete } from '../utils/hospitalSetup';

const C = {
  bg: '#F5F3EE', surface: '#EDE9E0', card: '#FFFFFF',
  text: '#0C2E30', muted: '#6B7E7F', border: '#EAE5DA',
  teal: '#0B7E8A', tealLight: 'rgba(11,126,138,0.09)', ink: '#083236',
  red: '#EF4444', green: '#1E9E5A', gold: '#D4A843',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  active:   { label: 'Active',    color: C.green, bg: 'rgba(30,158,90,0.10)' },
  pending:  { label: 'Pending',   color: C.gold,  bg: 'rgba(212,168,67,0.12)' },
  rejected: { label: 'Declined',  color: C.red,   bg: 'rgba(239,68,68,0.08)' },
  resigned: { label: 'Resigned',  color: C.muted, bg: 'rgba(107,126,127,0.12)' },
};

export default function HospitalAffiliationScreen({ navigation }: any) {
  const toast = useToast();
  const [affiliations, setAffiliations] = useState<any[]>([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [doctorId, setDoctorId]         = useState<string | null>(null);
  const [myUserId, setMyUserId]         = useState<string | null>(null);

  // Link request modal
  const [showLink, setShowLink]         = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: 'decline' | 'resign'; row: any } | null>(null);
  const [linkSearch, setLinkSearch]     = useState('');
  const [linkResults, setLinkResults]   = useState<any[]>([]);
  const [searching, setSearching]       = useState(false);
  const [requesting, setRequesting]     = useState<string | null>(null);
  const sheetY = React.useRef(new Animated.Value(600)).current;
  const [kbHeight, setKbHeight] = useState(0);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', e => setKbHeight(e.endCoordinates.height));
    const hide  = Keyboard.addListener('keyboardDidHide', () => setKbHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  useFocusEffect(useCallback(() => { loadAffiliations(); }, []));

  const loadAffiliations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setMyUserId(user.id);

      const { data: doc, error: docError } = await supabase
        .from('doctors').select('id').eq('user_id', user.id).maybeSingle();
      if (docError) { toast.showError('Error', docError.message); setLoading(false); setRefreshing(false); return; }
      if (!doc) { setLoading(false); setRefreshing(false); return; }
      setDoctorId(doc.id);

      const { data, error } = await supabase
        .from('hospital_staff')
        .select('id, status, role, requested_by, invited_at, joined_at, on_duty, on_duty_requested_at, hospitals(id, name, type, city, state)')
        .eq('doctor_id', doc.id)
        .order('invited_at', { ascending: false });

      if (error) { toast.showError('Error loading affiliations', error.message); }
      setAffiliations(data || []);
    } catch (e: any) { console.error(e); toast.showError('Error', e?.message ?? 'Something went wrong'); }
    finally { setLoading(false); setRefreshing(false); }
  };

  const openLinkSheet = () => {
    setShowLink(true);
    sheetY.setValue(600);
    Animated.spring(sheetY, { toValue: 0, tension: 180, friction: 22, useNativeDriver: true }).start();
  };

  const closeLinkSheet = () => {
    Animated.timing(sheetY, { toValue: 600, duration: 260, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => {
      setShowLink(false);
      setLinkSearch('');
      setLinkResults([]);
    });
  };

  const searchHospitals = async (q: string) => {
    setLinkSearch(q);
    if (!q.trim()) { setLinkResults([]); return; }
    setSearching(true);
    try {
      // Only real, active facilities that have finished setup are
      // discoverable — an admin who hasn't completed their profile simply
      // doesn't appear yet, rather than showing a stub that fails to link.
      const { data: hospRows } = await supabase
        .from('hospitals')
        .select('id, name, type, city, state, address')
        .ilike('name', `%${q}%`)
        .eq('is_active', true)
        .limit(20);

      setLinkResults((hospRows || []).filter(isHospitalSetupComplete));
    } catch {}
    finally { setSearching(false); }
  };

  const requestLink = async (hospital: any) => {
    if (!doctorId) return;
    setRequesting(hospital.id);
    try {
      const hospitalId: string = hospital.id;

      const { data: existing } = await supabase
        .from('hospital_staff')
        .select('id, status')
        .eq('hospital_id', hospitalId)
        .eq('doctor_id', doctorId)
        .maybeSingle();

      if (existing && (existing.status === 'active' || existing.status === 'pending')) {
        toast.showWarning('Already exists', `You ${existing.status === 'active' ? 'are already staff at' : 'have a pending request at'} ${hospital.name}.`);
        return;
      }

      if (existing) {
        // Previously resigned/declined — re-request by reviving the same row
        // rather than blocking, so leaving/declining isn't permanent.
        const { error: relinkError } = await supabase.from('hospital_staff')
          .update({ status: 'pending', requested_by: 'doctor', invited_at: new Date().toISOString(), joined_at: null })
          .eq('id', existing.id);
        if (relinkError) throw relinkError;
      } else {
        const { error: linkError } = await supabase.from('hospital_staff').insert({
          hospital_id: hospitalId,
          doctor_id: doctorId,
          status: 'pending',
          requested_by: 'doctor',
          invited_at: new Date().toISOString(),
        });
        if (linkError) throw linkError;
      }

      // Try notify the hospital admin
      const { data: adminProfiles } = await supabase
        .from('profiles')
        .select('id')
        .ilike('hospital_name', `%${hospital.name}%`)
        .limit(3);

      if (adminProfiles && adminProfiles.length > 0) {
        try {
          await sendNotifications(adminProfiles.map((p: any) => ({
            userId: p.id,
            title: 'New Staff Link Request',
            message: `A medical practitioner has requested to link their account to ${hospital.name}. Review it in your Staff screen.`,
            type: 'system',
            is_read: false,
          })));
        } catch (e) { console.warn('Notification failed', e); }
      }

      toast.showSuccess('Request Sent', `Your request to join ${hospital.name} has been submitted. They will review and approve it.`);
      closeLinkSheet();
      loadAffiliations();
    } catch (e: any) {
      toast.showError('Error', e.message);
    } finally {
      setRequesting(null);
    }
  };

  const acceptInvite = async (row: any) => {
    try {
      const { error } = await supabase.from('hospital_staff')
        .update({ status: 'active', joined_at: new Date().toISOString() })
        .eq('id', row.id);
      if (error) throw error;

      // Notify hospital admin
      const hosp = row.hospitals;
      if (hosp) {
        const { data: admins } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_type', 'hospital_admin')
          .or(`full_name.ilike.%${hosp.name}%,hospital_name.ilike.%${hosp.name}%`)
          .limit(3);
        if (admins && admins.length > 0) {
          try {
            await sendNotifications(admins.map((p: any) => ({
              userId: p.id,
              title: 'Staff Invitation Accepted',
              message: `A practitioner has accepted your staff invitation and is now part of your team.`,
              type: 'system',
              is_read: false,
            })));
          } catch (e) { console.warn('Notification failed', e); }
        }
      }

      toast.showSuccess('Accepted', `You are now staff at ${hosp?.name || 'the hospital'}.`);
      loadAffiliations();
    } catch (e: any) {
      toast.showError('Error', e.message);
    }
  };

  const declineInvite = async (row: any) => {
    try {
      const { error } = await supabase.from('hospital_staff').update({ status: 'rejected' }).eq('id', row.id);
      if (error) throw error;
      toast.showInfo('Declined', 'Invitation declined.');
      loadAffiliations();
    } catch (e: any) {
      toast.showError('Error', e.message);
    }
  };

  const toggleOnDuty = async (row: any) => {
    // Going OFF duty is self-service. Going ON duty requires hospital
    // confirmation -- tapping while off requests it; tapping again while
    // pending cancels the request.
    if (row.on_duty) {
      const { error } = await supabase.from('hospital_staff')
        .update({ on_duty: false, on_duty_requested_at: null }).eq('id', row.id);
      if (error) { toast.showError('Error', error.message); return; }
      setAffiliations(prev => prev.map(a => a.id === row.id ? { ...a, on_duty: false, on_duty_requested_at: null } : a));
      return;
    }

    if (row.on_duty_requested_at) {
      const { error } = await supabase.from('hospital_staff')
        .update({ on_duty_requested_at: null }).eq('id', row.id);
      if (error) { toast.showError('Error', error.message); return; }
      setAffiliations(prev => prev.map(a => a.id === row.id ? { ...a, on_duty_requested_at: null } : a));
      return;
    }

    const requestedAt = new Date().toISOString();
    const { error } = await supabase.from('hospital_staff')
      .update({ on_duty_requested_at: requestedAt }).eq('id', row.id);
    if (error) { toast.showError('Error', error.message); return; }
    setAffiliations(prev => prev.map(a => a.id === row.id ? { ...a, on_duty_requested_at: requestedAt } : a));

    try {
      const { data: admins } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_type', 'hospital_admin')
        .ilike('hospital_name', `%${row.hospitals?.name ?? ''}%`)
        .limit(3);
      if (admins && admins.length > 0) {
        await sendNotifications(admins.map((p: any) => ({
          userId: p.id,
          title: 'On-Duty Request',
          message: 'A staff member has requested to go on duty. Review it in your Shifts screen.',
          type: 'system',
          is_read: false,
        })));
      }
    } catch (e) { console.warn('Notification failed', e); }
  };

  const resign = async (row: any) => {
    try {
      const { error } = await supabase.from('hospital_staff').update({ status: 'resigned' }).eq('id', row.id);
      if (error) throw error;
      toast.showInfo('Resigned', `You have left ${row.hospitals?.name || 'the hospital'}.`);
      loadAffiliations();
    } catch (e: any) {
      toast.showError('Error', e.message);
    }
  };

  const CONFIRM_COPY: Record<string, { title: string; body: (row: any) => string; confirmLabel: string; run: (row: any) => Promise<void> }> = {
    decline: {
      title: 'Decline Invitation?',
      body: (row) => `You'll decline ${row.hospitals?.name ?? 'this hospital'}'s invitation to join their staff.`,
      confirmLabel: 'Decline',
      run: declineInvite,
    },
    resign: {
      title: 'Resign From Hospital?',
      body: (row) => `You'll immediately lose staff access to ${row.hospitals?.name ?? 'this hospital'}. You can request to rejoin later.`,
      confirmLabel: 'Resign',
      run: resign,
    },
  };

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={C.ink} />

      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Hospital Affiliations</Text>
          <Text style={s.headerSub}>{affiliations.filter(a => a.status === 'active').length} active</Text>
        </View>
        <TouchableOpacity style={s.linkBtn} onPress={openLinkSheet} activeOpacity={0.8}>
          <Ionicons name="link-outline" size={16} color="#fff" />
          <Text style={s.linkBtnText}>Link</Text>
        </TouchableOpacity>
      </View>

      <View style={s.paper}>
        {loading ? (
          <ActivityIndicator color={C.teal} style={{ flex: 1, marginTop: 40 }} />
        ) : (
          <FlatList
            data={affiliations}
            keyExtractor={i => i.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAffiliations(); }} tintColor={C.teal} colors={[C.teal]} />}
            contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
            ListHeaderComponent={
              <View style={s.infoBanner}>
                <Ionicons name="information-circle-outline" size={16} color={C.teal} />
                <Text style={s.infoText}>
                  Link your account to hospitals where you work. Hospitals can also invite you directly.
                </Text>
              </View>
            }
            ListEmptyComponent={
              <View style={s.empty}>
                <View style={s.emptyIconWrap}>
                  <Ionicons name="business-outline" size={34} color={C.teal} />
                </View>
                <Text style={s.emptyTitle}>No affiliations yet</Text>
                <Text style={s.emptySub}>Tap "Link" to connect your account to your hospital, or wait for a hospital to invite you.</Text>
              </View>
            }
            renderItem={({ item }) => {
              const hosp   = item.hospitals;
              const st     = STATUS_CONFIG[item.status] || STATUS_CONFIG['pending'];
              const isPendingInvite = item.status === 'pending' && item.requested_by === 'hospital';
              const isPendingRequest = item.status === 'pending' && item.requested_by === 'doctor';

              return (
                <View style={s.card}>
                  <View style={s.cardTop}>
                    <View style={s.hospIcon}>
                      <Ionicons name="business" size={22} color={C.teal} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.hospName} numberOfLines={1}>{hosp?.name || 'Hospital'}</Text>
                      <Text style={s.hospMeta}>
                        {hosp?.type ? `${hosp.type} · ` : ''}{hosp?.city || hosp?.state || 'Nigeria'}
                      </Text>
                      {item.role && <Text style={s.roleText}>{item.role}</Text>}
                    </View>
                    <View style={[s.statusBadge, { backgroundColor: st.bg }]}>
                      <Text style={[s.statusText, { color: st.color }]}>{st.label}</Text>
                    </View>
                  </View>

                  {item.status === 'active' && item.joined_at && (
                    <Text style={s.since}>Staff since {new Date(item.joined_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</Text>
                  )}

                  {item.status === 'active' && (() => {
                    const pending = !item.on_duty && !!item.on_duty_requested_at;
                    const dotColor = item.on_duty ? C.green : pending ? C.gold : C.muted;
                    const label = item.on_duty
                      ? "You're on duty at this hospital"
                      : pending
                        ? 'Awaiting hospital confirmation…'
                        : 'Request to go on duty';
                    return (
                      <TouchableOpacity
                        style={[s.onDutyRow, item.on_duty && s.onDutyRowActive, pending && s.onDutyRowPending]}
                        activeOpacity={0.8}
                        onPress={() => toggleOnDuty(item)}
                      >
                        <View style={[s.onDutyDot, { backgroundColor: dotColor }]} />
                        <Text style={[s.onDutyText, item.on_duty && { color: C.green }, pending && { color: '#8A6A1F' }]}>
                          {label}
                        </Text>
                        {!pending && (
                          <View style={[s.onDutySwitch, item.on_duty && s.onDutySwitchActive]}>
                            <View style={[s.onDutyKnob, item.on_duty && s.onDutyKnobActive]} />
                          </View>
                        )}
                        {pending && <Text style={s.onDutyCancelText}>Cancel</Text>}
                      </TouchableOpacity>
                    );
                  })()}

                  {isPendingRequest && (
                    <Text style={s.pendingNote}>Your request is awaiting approval from the hospital.</Text>
                  )}

                  {/* Action buttons */}
                  <View style={s.cardActions}>
                    {isPendingInvite && (
                      <>
                        <TouchableOpacity style={s.acceptBtn} onPress={() => acceptInvite(item)}>
                          <Ionicons name="checkmark" size={15} color="#fff" />
                          <Text style={s.acceptBtnText}>Accept Invitation</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={s.declineBtn} onPress={() => setConfirmAction({ type: 'decline', row: item })}>
                          <Text style={s.declineBtnText}>Decline</Text>
                        </TouchableOpacity>
                      </>
                    )}
                    {item.status === 'active' && (
                      <>
                        <TouchableOpacity
                          style={s.acceptBtn}
                          onPress={() => navigation.navigate('HospitalTeamChat', { hospitalId: hosp?.id, hospitalName: hosp?.name })}
                        >
                          <Ionicons name="chatbubbles-outline" size={15} color="#fff" />
                          <Text style={s.acceptBtnText}>Team Chat</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={s.resignBtn} onPress={() => setConfirmAction({ type: 'resign', row: item })}>
                          <Ionicons name="exit-outline" size={15} color={C.red} />
                          <Text style={s.resignBtnText}>Resign</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                </View>
              );
            }}
          />
        )}
      </View>

      {/* Link to hospital modal */}
      <Modal visible={showLink} transparent animationType="none" statusBarTranslucent onRequestClose={closeLinkSheet}>
        <View style={s.scrim}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={closeLinkSheet} />
          <Animated.View style={[s.sheet, { transform: [{ translateY: sheetY }], paddingBottom: kbHeight > 0 ? kbHeight : 44 }]}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>Link to a Hospital</Text>
            <Text style={s.sheetSub}>Search for your hospital. They'll receive a notification to approve your request.</Text>

            <View style={s.searchWrap}>
              <Ionicons name="search" size={16} color={C.muted} />
              <TextInput
                style={s.searchInput}
                value={linkSearch}
                onChangeText={searchHospitals}
                placeholder="Search hospital name…"
                placeholderTextColor={C.muted}
                autoFocus
                autoCorrect={false}
              />
              {searching && <ActivityIndicator size="small" color={C.teal} />}
            </View>

            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              {linkResults.length === 0 && linkSearch.trim() && !searching && (
                <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                  <Text style={s.emptySub}>No hospitals found</Text>
                  <Text style={{ fontSize: 11, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted, marginTop: 6, textAlign: 'center' }}>
                    Try a different spelling or ask the hospital admin to complete their profile setup.
                  </Text>
                </View>
              )}
              {linkResults.map(h => {
                const key = h.id || h.name;
                const isRequesting = requesting === key;
                return (
                  <View key={key} style={s.resultRow}>
                    <View style={[s.hospIcon, { backgroundColor: C.tealLight }]}>
                      <Ionicons name="business" size={18} color={C.teal} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.hospName} numberOfLines={1}>{h.name}</Text>
                      <Text style={s.hospMeta}>{h.type ? `${h.type} · ` : ''}{h.city || h.state || 'Nigeria'}</Text>
                    </View>
                    <TouchableOpacity
                      style={[s.requestBtn, isRequesting && { opacity: 0.5 }]}
                      onPress={() => requestLink(h)}
                      disabled={!!requesting}
                    >
                      <Text style={s.requestBtnText}>{isRequesting ? '…' : 'Request'}</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>

      {/* Confirm destructive action */}
      <Modal visible={!!confirmAction} animationType="slide" transparent onRequestClose={() => setConfirmAction(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 }}>
            <View style={{ width: 40, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 }} />
            {confirmAction && (
              <>
                <Text style={{ fontSize: 18, fontFamily: 'Montserrat_700Bold', color: C.text, marginBottom: 6 }}>
                  {CONFIRM_COPY[confirmAction.type].title}
                </Text>
                <Text style={{ fontSize: 13.5, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted, marginBottom: 24, lineHeight: 20 }}>
                  {CONFIRM_COPY[confirmAction.type].body(confirmAction.row)}
                </Text>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <TouchableOpacity onPress={() => setConfirmAction(null)} style={{ flex: 1, padding: 14, borderRadius: 13, backgroundColor: C.surface, alignItems: 'center' }}>
                    <Text style={{ fontSize: 14, fontFamily: 'Montserrat_600SemiBold', color: C.muted }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={async () => {
                      const action = confirmAction;
                      setConfirmAction(null);
                      if (action) await CONFIRM_COPY[action.type].run(action.row);
                    }}
                    style={{ flex: 1, padding: 14, borderRadius: 13, backgroundColor: C.red, alignItems: 'center' }}
                  >
                    <Text style={{ fontSize: 14, fontFamily: 'Montserrat_700Bold', color: '#fff' }}>{CONFIRM_COPY[confirmAction.type].confirmLabel}</Text>
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
  root: { flex: 1, backgroundColor: C.ink },

  header:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 24 },
  backBtn:      { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  headerTitle:  { fontSize: 20, fontFamily: 'Montserrat_800ExtraBold', color: '#fff', letterSpacing: -0.4 },
  headerSub:    { fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: 'rgba(255,255,255,0.55)', marginTop: 1 },
  linkBtn:      { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.teal, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9 },
  linkBtnText:  { fontSize: 13, fontFamily: 'Montserrat_700Bold', color: '#fff' },

  paper: { flex: 1, backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },

  infoBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: C.tealLight, borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(11,126,138,0.2)' },
  infoText:   { flex: 1, fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: C.teal, lineHeight: 18 },

  card:     { backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 10, ...shadows.sm },
  cardTop:  { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 8 },
  hospIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: C.tealLight, alignItems: 'center', justifyContent: 'center' },
  hospName: { fontSize: 14, fontFamily: 'Montserrat_700Bold', color: C.text, marginBottom: 2 },
  hospMeta: { fontSize: 11, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted },
  roleText: { fontSize: 11, fontFamily: 'Montserrat_600SemiBold', color: C.teal, marginTop: 3 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
  statusText:  { fontSize: 11, fontFamily: 'Montserrat_700Bold' },
  since:        { fontSize: 11, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted, marginBottom: 8 },
  onDutyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.surface,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12,
  },
  onDutyRowActive: { backgroundColor: 'rgba(30,158,90,0.08)' },
  onDutyRowPending: { backgroundColor: 'rgba(212,168,67,0.10)' },
  onDutyCancelText: { fontSize: 11, fontFamily: 'Montserrat_600SemiBold', color: '#8A6A1F' },
  onDutyDot:  { width: 8, height: 8, borderRadius: 4 },
  onDutyText: { flex: 1, fontSize: 12.5, fontFamily: 'Montserrat_600SemiBold', color: C.text },
  onDutySwitch: { width: 38, height: 22, borderRadius: 11, backgroundColor: C.border, padding: 2, justifyContent: 'center' },
  onDutySwitchActive: { backgroundColor: C.green },
  onDutyKnob: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff', alignSelf: 'flex-start' },
  onDutyKnobActive: { alignSelf: 'flex-end' },
  pendingNote:  { fontSize: 11, fontFamily: 'SpaceGrotesk_400Regular', color: C.gold, marginBottom: 8 },

  cardActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  acceptBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: C.teal, borderRadius: 10, paddingVertical: 10 },
  acceptBtnText:  { fontSize: 13, fontFamily: 'Montserrat_700Bold', color: '#fff' },
  declineBtn:     { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' },
  declineBtnText: { fontSize: 13, fontFamily: 'Montserrat_600SemiBold', color: C.red },
  resignBtn:      { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(239,68,68,0.06)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.15)' },
  resignBtnText:  { fontSize: 12, fontFamily: 'Montserrat_600SemiBold', color: C.red },

  empty:        { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyIconWrap:{ width: 72, height: 72, borderRadius: 36, backgroundColor: C.tealLight, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle:   { fontSize: 16, fontFamily: 'Montserrat_700Bold', color: C.text },
  emptySub:     { fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted, textAlign: 'center', maxWidth: 280, lineHeight: 20 },

  scrim: { flex: 1, backgroundColor: 'rgba(8,50,54,0.55)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginBottom: 20 },
  sheetTitle:  { fontSize: 18, fontFamily: 'Montserrat_800ExtraBold', color: C.ink, marginBottom: 4 },
  sheetSub:    { fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted, marginBottom: 16 },

  searchWrap:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.bg, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1.5, borderColor: C.border, marginBottom: 12 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: 'SpaceGrotesk_400Regular', color: C.text, paddingVertical: 0 },

  resultRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  requestBtn:   { backgroundColor: C.tealLight, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: 'rgba(11,126,138,0.25)' },
  requestBtnText:{ fontSize: 13, fontFamily: 'Montserrat_700Bold', color: C.teal },
});

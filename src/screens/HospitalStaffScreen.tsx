import React, { useState, useCallback, useEffect } from 'react';
import {
  StyleSheet, Text, View, FlatList, TouchableOpacity, Image,
  TextInput, ActivityIndicator, RefreshControl, StatusBar, Modal,
  Animated, Easing, ScrollView, Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ToastProvider';

const C = {
  bg: '#F5F3EE', surface: '#EDE9E0', card: '#FFFFFF',
  text: '#0C2E30', muted: '#6B7E7F', border: '#EAE5DA',
  teal: '#0B7E8A', tealLight: 'rgba(11,126,138,0.09)', ink: '#083236',
  gold: '#D4A843', red: '#EF4444', green: '#1E9E5A',
};

function Avatar({ name, image, size = 46 }: { name?: string; image?: string; size?: number }) {
  const initials = (name ?? '?').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  if (image) return <Image source={{ uri: image }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.34, fontFamily: 'Montserrat_700Bold', color: '#fff' }}>{initials}</Text>
    </View>
  );
}

const TABS = [
  { key: 'active',   label: 'Active Staff' },
  { key: 'requests', label: 'Join Requests' },
  { key: 'invites',  label: 'Sent Invites' },
] as const;
type TabKey = typeof TABS[number]['key'];

export default function HospitalStaffScreen({ navigation }: any) {
  const toast = useToast();
  const [tab, setTab]               = useState<TabKey>('active');
  const [activeStaff, setActiveStaff]   = useState<any[]>([]);
  const [requests, setRequests]         = useState<any[]>([]);
  const [invites, setInvites]           = useState<any[]>([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [hospitalId, setHospitalId]     = useState<string | null>(null);
  const [myUserId, setMyUserId]         = useState<string | null>(null);

  // Invite modal
  const [showInvite, setShowInvite] = useState(false);
  const [inviteSearch, setInviteSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching]   = useState(false);
  const [inviting, setInviting]     = useState<string | null>(null);
  const inviteSheetY = React.useRef(new Animated.Value(600)).current;
  const [kbHeight, setKbHeight] = useState(0);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', e => setKbHeight(e.endCoordinates.height));
    const hide  = Keyboard.addListener('keyboardDidHide', () => setKbHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setMyUserId(user.id);

      const { data: prof } = await supabase
        .from('profiles').select('full_name, hospital_name').eq('id', user.id).maybeSingle();

      const name = prof?.hospital_name || prof?.full_name;
      if (!name) { setLoading(false); setRefreshing(false); return; }

      let { data: hosp } = await supabase
        .from('hospitals').select('id').ilike('name', `%${name}%`).maybeSingle();
      if (!hosp?.id) {
        const { data: created } = await supabase.from('hospitals')
          .insert({ name: name.trim(), is_active: true, rating: 0, total_reviews: 0 })
          .select('id').maybeSingle();
        hosp = created;
      }
      if (!hosp?.id) { setLoading(false); setRefreshing(false); return; }
      setHospitalId(hosp.id);

      const { data: rows } = await supabase
        .from('hospital_staff')
        .select('id, status, role, requested_by, invited_at, joined_at, doctor_id, doctors(id, full_name, specialization, profile_image, title, is_available, average_rating, user_id)')
        .eq('hospital_id', hosp.id)
        .neq('status', 'rejected');

      const all = rows || [];
      setActiveStaff(all.filter((r: any) => r.status === 'active'));
      setRequests(all.filter((r: any) => r.status === 'pending' && r.requested_by === 'doctor'));
      setInvites(all.filter((r: any) => r.status === 'pending' && r.requested_by === 'hospital'));
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  const openInviteSheet = () => {
    setShowInvite(true);
    inviteSheetY.setValue(600);
    Animated.spring(inviteSheetY, { toValue: 0, tension: 180, friction: 22, useNativeDriver: true }).start();
  };

  const closeInviteSheet = () => {
    Animated.timing(inviteSheetY, { toValue: 600, duration: 260, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => {
      setShowInvite(false);
      setInviteSearch('');
      setSearchResults([]);
    });
  };

  const searchDoctors = async (q: string) => {
    setInviteSearch(q);
    if (!q.trim()) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const { data } = await supabase
        .from('doctors')
        .select('id, full_name, specialization, profile_image, title, user_id')
        .ilike('full_name', `%${q}%`)
        .limit(15);
      setSearchResults(data || []);
    } catch {}
    finally { setSearching(false); }
  };

  const sendInvite = async (doctor: any) => {
    if (!hospitalId) return;
    setInviting(doctor.id);
    try {
      const { data: existing } = await supabase
        .from('hospital_staff')
        .select('id, status')
        .eq('hospital_id', hospitalId)
        .eq('doctor_id', doctor.id)
        .maybeSingle();

      if (existing) {
        toast.showWarning('Already exists', `${doctor.full_name} is already ${existing.status === 'active' ? 'on your staff' : 'has a pending invitation'}.`);
        return;
      }

      await supabase.from('hospital_staff').insert({
        hospital_id: hospitalId,
        doctor_id: doctor.id,
        status: 'pending',
        requested_by: 'hospital',
        invited_at: new Date().toISOString(),
      });

      // Notify the doctor
      await supabase.from('notifications').insert({
        user_id: doctor.user_id,
        title: 'Hospital Staff Invitation',
        message: 'A hospital has invited you to join their staff on Hbridge. Review it in your Hospital Affiliations.',
        type: 'system',
        is_read: false,
      });

      toast.showSuccess('Invitation Sent', `${doctor.title || 'Dr.'} ${doctor.full_name} has been invited.`);
      closeInviteSheet();
      loadData();
    } catch (e: any) {
      toast.showError('Error', e.message);
    } finally {
      setInviting(null);
    }
  };

  const approveRequest = async (row: any) => {
    try {
      await supabase.from('hospital_staff')
        .update({ status: 'active', joined_at: new Date().toISOString() })
        .eq('id', row.id);

      await supabase.from('notifications').insert({
        user_id: row.doctors?.user_id,
        title: 'Affiliation Approved',
        message: 'Your request to join the hospital staff has been approved.',
        type: 'system',
        is_read: false,
      });

      toast.showSuccess('Approved', `${row.doctors?.full_name} is now on your staff.`);
      loadData();
    } catch (e: any) {
      toast.showError('Error', e.message);
    }
  };

  const rejectRequest = async (row: any) => {
    try {
      await supabase.from('hospital_staff').update({ status: 'rejected' }).eq('id', row.id);

      await supabase.from('notifications').insert({
        user_id: row.doctors?.user_id,
        title: 'Affiliation Declined',
        message: 'Your request to join the hospital staff was not approved at this time.',
        type: 'system',
        is_read: false,
      });

      toast.showInfo('Declined', `Request from ${row.doctors?.full_name} declined.`);
      loadData();
    } catch (e: any) {
      toast.showError('Error', e.message);
    }
  };

  const cancelInvite = async (row: any) => {
    try {
      await supabase.from('hospital_staff').update({ status: 'rejected' }).eq('id', row.id);
      toast.showInfo('Cancelled', 'Invitation cancelled.');
      loadData();
    } catch (e: any) {
      toast.showError('Error', e.message);
    }
  };

  const removeStaff = async (row: any) => {
    try {
      await supabase.from('hospital_staff').update({ status: 'resigned' }).eq('id', row.id);

      await supabase.from('notifications').insert({
        user_id: row.doctors?.user_id,
        title: 'Staff Affiliation Removed',
        message: 'Your hospital staff affiliation has been removed.',
        type: 'system',
        is_read: false,
      });

      toast.showInfo('Removed', `${row.doctors?.full_name} removed from staff.`);
      loadData();
    } catch (e: any) {
      toast.showError('Error', e.message);
    }
  };

  const counts = { active: activeStaff.length, requests: requests.length, invites: invites.length };
  const listData = tab === 'active' ? activeStaff : tab === 'requests' ? requests : invites;

  const renderRow = ({ item }: { item: any }) => {
    const doc = item.doctors;
    if (!doc) return null;
    return (
      <View style={s.card}>
        <TouchableOpacity
          style={s.cardLeft}
          activeOpacity={0.75}
          onPress={() => navigation.navigate('DoctorDetail', { doctor: doc })}
        >
          <Avatar name={doc.full_name} image={doc.profile_image} />
          <View style={{ flex: 1 }}>
            <Text style={s.name} numberOfLines={1}>{doc.title || 'Dr.'} {doc.full_name}</Text>
            <Text style={s.spec} numberOfLines={1}>{doc.specialization || 'General Practice'}</Text>
            {item.role && <Text style={s.role}>{item.role}</Text>}
            {tab === 'active' && item.joined_at && (
              <Text style={s.joinedDate}>
                Since {new Date(item.joined_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
              </Text>
            )}
          </View>
        </TouchableOpacity>

        <View style={s.actions}>
          {tab === 'requests' && (
            <>
              <TouchableOpacity style={s.approveBtn} onPress={() => approveRequest(item)}>
                <Ionicons name="checkmark" size={16} color="#fff" />
                <Text style={s.approveBtnText}>Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.rejectBtn} onPress={() => rejectRequest(item)}>
                <Ionicons name="close" size={16} color={C.red} />
              </TouchableOpacity>
            </>
          )}
          {tab === 'invites' && (
            <TouchableOpacity style={s.rejectBtn} onPress={() => cancelInvite(item)}>
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
          )}
          {tab === 'active' && (
            <TouchableOpacity style={s.rejectBtn} onPress={() => removeStaff(item)}>
              <Ionicons name="person-remove-outline" size={17} color={C.red} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={C.ink} />

      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Staff</Text>
          <Text style={s.headerSub}>{counts.active} active · {counts.requests} request{counts.requests !== 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity style={s.inviteBtn} onPress={openInviteSheet} activeOpacity={0.8}>
          <Ionicons name="person-add-outline" size={17} color="#fff" />
          <Text style={s.inviteBtnText}>Invite</Text>
        </TouchableOpacity>
      </View>

      <View style={s.paper}>
        {/* Tabs */}
        <View style={s.tabRow}>
          {TABS.map(t => (
            <TouchableOpacity
              key={t.key}
              style={[s.tabBtn, tab === t.key && s.tabBtnActive]}
              onPress={() => setTab(t.key)}
            >
              <Text style={[s.tabText, tab === t.key && s.tabTextActive]}>{t.label}</Text>
              {counts[t.key] > 0 && (
                <View style={[s.tabBadge, tab === t.key && s.tabBadgeActive]}>
                  <Text style={[s.tabBadgeText, tab === t.key && s.tabBadgeTextActive]}>{counts[t.key]}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator color={C.teal} style={{ flex: 1, marginTop: 40 }} />
        ) : (
          <FlatList
            data={listData}
            keyExtractor={i => i.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={C.teal} colors={[C.teal]} />}
            contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
            ListEmptyComponent={
              <View style={s.empty}>
                <View style={s.emptyIconWrap}>
                  <Ionicons name="people-outline" size={34} color={C.teal} />
                </View>
                <Text style={s.emptyTitle}>
                  {tab === 'active' ? 'No active staff yet'
                    : tab === 'requests' ? 'No pending requests'
                    : 'No sent invitations'}
                </Text>
                <Text style={s.emptySub}>
                  {tab === 'active'
                    ? 'Invite practitioners or approve their link requests to build your team.'
                    : tab === 'requests'
                    ? 'When a practitioner requests to join your hospital, they appear here.'
                    : 'Tap "Invite" to search and invite a practitioner.'}
                </Text>
              </View>
            }
            renderItem={renderRow}
          />
        )}
      </View>

      {/* Invite practitioner modal */}
      <Modal visible={showInvite} transparent animationType="none" statusBarTranslucent onRequestClose={closeInviteSheet}>
        <View style={{ flex: 1 }}>
          <View style={s.scrim}>
            <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={closeInviteSheet} />
            <Animated.View style={[s.sheet, { transform: [{ translateY: inviteSheetY }], paddingBottom: kbHeight }]}>
              <View style={s.sheetHandle} />
              <Text style={s.sheetTitle}>Invite a Practitioner</Text>
              <Text style={s.sheetSub}>Search for a registered practitioner to invite to your staff.</Text>

              <View style={s.searchWrap}>
                <Ionicons name="search" size={16} color={C.muted} />
                <TextInput
                  style={s.searchInput}
                  value={inviteSearch}
                  onChangeText={searchDoctors}
                  placeholder="Search by name…"
                  placeholderTextColor={C.muted}
                  autoFocus
                  autoCorrect={false}
                />
                {searching && <ActivityIndicator size="small" color={C.teal} />}
              </View>

              <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {searchResults.length === 0 && inviteSearch.trim() && !searching && (
                  <Text style={[s.emptySub, { textAlign: 'center', paddingVertical: 24 }]}>No practitioners found</Text>
                )}
                {searchResults.map(doc => (
                  <View key={doc.id} style={s.resultRow}>
                    <Avatar name={doc.full_name} image={doc.profile_image} size={42} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.name} numberOfLines={1}>{doc.title || 'Dr.'} {doc.full_name}</Text>
                      <Text style={s.spec}>{doc.specialization || 'General Practice'}</Text>
                    </View>
                    <TouchableOpacity
                      style={[s.sendInviteBtn, inviting === doc.id && { opacity: 0.5 }]}
                      onPress={() => sendInvite(doc)}
                      disabled={inviting === doc.id}
                    >
                      <Text style={s.sendInviteText}>{inviting === doc.id ? '…' : 'Invite'}</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </Animated.View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.ink },

  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24 },
  headerTitle:  { fontSize: 24, fontFamily: 'Montserrat_800ExtraBold', color: '#fff', letterSpacing: -0.5 },
  headerSub:    { fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  inviteBtn:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.teal, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  inviteBtnText:{ fontSize: 13, fontFamily: 'Montserrat_700Bold', color: '#fff' },

  paper: { flex: 1, backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },

  tabRow:          { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, gap: 8 },
  tabBtn:          { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.border },
  tabBtnActive:    { backgroundColor: C.tealLight, borderColor: C.teal },
  tabText:         { fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted },
  tabTextActive:   { fontFamily: 'Montserrat_600SemiBold', color: C.teal },
  tabBadge:        { backgroundColor: C.border, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 },
  tabBadgeActive:  { backgroundColor: C.teal },
  tabBadgeText:    { fontSize: 10, fontFamily: 'Montserrat_700Bold', color: C.muted },
  tabBadgeTextActive:{ color: '#fff' },

  card:     { backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 10 },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  name:     { fontSize: 14, fontFamily: 'Montserrat_700Bold', color: C.text },
  spec:     { fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted, marginTop: 2 },
  role:     { fontSize: 11, fontFamily: 'Montserrat_600SemiBold', color: C.teal, marginTop: 3 },
  joinedDate:{ fontSize: 11, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted, marginTop: 2 },
  actions:  { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'flex-end' },
  approveBtn:    { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.green, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  approveBtnText:{ fontSize: 13, fontFamily: 'Montserrat_700Bold', color: '#fff' },
  rejectBtn:     { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(239,68,68,0.08)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' },
  cancelText:    { fontSize: 12, fontFamily: 'Montserrat_600SemiBold', color: C.red },

  empty:        { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyIconWrap:{ width: 72, height: 72, borderRadius: 36, backgroundColor: C.tealLight, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle:   { fontSize: 16, fontFamily: 'Montserrat_700Bold', color: C.text },
  emptySub:     { fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted, textAlign: 'center', maxWidth: 280, lineHeight: 20 },

  scrim: { flex: 1, backgroundColor: 'rgba(8,50,54,0.55)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 44 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginBottom: 20 },
  sheetTitle:  { fontSize: 18, fontFamily: 'Montserrat_800ExtraBold', color: C.ink, marginBottom: 4 },
  sheetSub:    { fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted, marginBottom: 16 },

  searchWrap:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.bg, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1.5, borderColor: C.border, marginBottom: 12 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: 'SpaceGrotesk_400Regular', color: C.text, paddingVertical: 0 },

  resultRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  sendInviteBtn:  { backgroundColor: C.tealLight, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: 'rgba(11,126,138,0.25)' },
  sendInviteText: { fontSize: 13, fontFamily: 'Montserrat_700Bold', color: C.teal },
});

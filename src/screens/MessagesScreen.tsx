import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, Image, ActivityIndicator, RefreshControl, StatusBar, TextInput, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useChatBadge } from '../context/ChatBadgeContext';

const C = { bg: '#F5F3EE', surface: '#EDE9E0', card: '#FFFFFF', text: '#0C2E30', muted: '#6B7E7F', border: '#EAE5DA', teal: '#0B7E8A', tealLight: 'rgba(11,126,138,0.09)' };

type SortMode   = 'newest' | 'oldest' | 'unread';
type FilterMode = 'all' | 'unread';

export default function MessagesScreen({ navigation }: any) {
  const [conversations, setConversations]   = useState<any[]>([]);
  const [loading, setLoading]               = useState(true);
  const [refreshing, setRefreshing]         = useState(false);
  const [currentUserId, setCurrentUserId]   = useState<string | null>(null);
  const [isDoctor, setIsDoctor]             = useState(false);
  const [isHospitalAdmin, setIsHospitalAdmin] = useState(false);
  const [searchQuery, setSearchQuery]       = useState('');
  const [searchFocused, setSearchFocused]   = useState(false);
  const [sortMode, setSortMode]             = useState<SortMode>('newest');
  const [filterMode, setFilterMode]         = useState<FilterMode>('all');
  const [showSortMenu, setShowSortMenu]     = useState(false);
  const [markingRead, setMarkingRead]       = useState(false);
  const { refreshUnreadCount }              = useChatBadge();
  const userIdRef                           = useRef<string | null>(null);
  const convIdsRef                          = useRef<string[]>([]);

  useEffect(() => {
    let channel: any;
    const setup = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setCurrentUserId(user.id);
      userIdRef.current = user.id;
      await loadConversations(user.id);
      setLoading(false);
      channel = supabase
        .channel('messages-list')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
          if (userIdRef.current) loadConversations(userIdRef.current);
        })
        .subscribe();
    };
    setup();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, []);

  // Re-fetch on tab focus — uses context navigation so it fires on tab switches, not just stack pops
  useFocusEffect(useCallback(() => {
    if (userIdRef.current) loadConversations(userIdRef.current);
  }, []));

  const loadConversations = async (userId: string) => {
    try {
      const activeRole = await AsyncStorage.getItem(`active_role_${userId}`);
      const isHospital = activeRole === 'hospital_admin';

      if (isHospital) {
        setIsDoctor(false);
        setIsHospitalAdmin(true);
        await loadHospitalConversations(userId);
        return;
      }
      setIsHospitalAdmin(false);

      const doctorData = (await supabase.from('doctors').select('id').eq('user_id', userId).maybeSingle()).data;

      if (userId === currentUserId || !currentUserId) setIsDoctor(!!doctorData);
      const conversationFilter = doctorData
        ? `doctor_id.eq.${doctorData.id},patient_id.eq.${userId}`
        : `patient_id.eq.${userId}`;

      const { data: convs, error } = await supabase
        .from('conversations').select('id, updated_at, patient_id, doctor_id')
        .or(conversationFilter).order('updated_at', { ascending: false });
      if (error) throw error;
      if (!convs || convs.length === 0) { setConversations([]); return; }

      const doctorIds  = [...new Set(convs.map((c: any) => c.doctor_id).filter(Boolean))];
      const patientIds = [...new Set(convs.map((c: any) => c.patient_id).filter(Boolean))];

      const { data: doctorRows }     = doctorIds.length > 0
        ? await supabase.from('doctors').select('id, user_id, full_name, profile_image, title').in('id', doctorIds)
        : { data: [] };
      const { data: patientProfiles } = patientIds.length > 0
        ? await supabase.from('profiles').select('id, full_name, profile_image').in('id', patientIds)
        : { data: [] };

      const doctorUserIds = (doctorRows || []).map((d: any) => d.user_id).filter(Boolean);
      const { data: doctorProfiles } = doctorUserIds.length > 0
        ? await supabase.from('profiles').select('id, full_name, profile_image').in('id', doctorUserIds)
        : { data: [] };
      const doctorProfileByUserId = new Map((doctorProfiles || []).map((p: any) => [p.id, p]));
      const doctorMap = new Map((doctorRows || []).map((d: any) => {
        const profile = doctorProfileByUserId.get(d.user_id);
        const title = d.title || 'Dr.';
        const name  = profile?.full_name || d.full_name || '';
        const displayName = /^dr\.?\s/i.test(name.trim()) ? name.trim() : `${title.endsWith('.') ? title : title + '.'} ${name}`.trim();
        return [d.id, { id: d.id, full_name: displayName, profile_image: profile?.profile_image || d.profile_image, title }];
      }));
      const patientMap = new Map((patientProfiles || []).map((p: any) => [p.id, p]));

      const getOtherUser = (conv: any) => {
        if (doctorData && conv.doctor_id === doctorData.id) return patientMap.get(conv.patient_id) || null;
        return doctorMap.get(conv.doctor_id) || null;
      };

      const convIds = convs.map((c: any) => c.id);
      const { data: lastMsgs } = await supabase
        .from('messages').select('id, conversation_id, content, created_at, sender_id, read_at, attachment_type')
        .in('conversation_id', convIds).order('created_at', { ascending: false });

      const lastMsgMap = new Map<string, any>();
      const unreadMap  = new Map<string, number>();
      (lastMsgs || []).forEach((m: any) => {
        if (!lastMsgMap.has(m.conversation_id)) lastMsgMap.set(m.conversation_id, m);
        if (m.sender_id !== userId && !m.read_at)
          unreadMap.set(m.conversation_id, (unreadMap.get(m.conversation_id) || 0) + 1);
      });

      const enriched = convs.map((conv: any) => ({
        ...conv,
        otherUser:          getOtherUser(conv),
        lastMessage:        lastMsgMap.get(conv.id) || null,
        unreadCount:        unreadMap.get(conv.id) || 0,
        currentUserId:      userId,
        isCurrentUserDoctor: doctorData && conv.doctor_id === doctorData.id,
      }));
      convIdsRef.current = convs.map((c: any) => c.id);
      setConversations(enriched);
      refreshUnreadCount();

      // Also show hospital-channel conversations for practitioners who are staff
      try {
        const { data: hospConvs } = await supabase
          .from('conversations')
          .select('id, hospital_id, updated_at')
          .eq('patient_id', userId)
          .not('hospital_id', 'is', null);

        if (hospConvs?.length) {
          const hospIds = [...new Set(hospConvs.map((c: any) => c.hospital_id))];
          const { data: hosps } = await supabase.from('hospitals').select('id, name').in('id', hospIds);
          const hospMap = new Map((hosps || []).map((h: any) => [h.id, h]));

          const hConvIds = hospConvs.map((c: any) => c.id);
          const hLastMsgMap = new Map<string, any>();
          const hUnreadMap  = new Map<string, number>();
          if (hConvIds.length > 0) {
            const { data: hMsgs } = await supabase
              .from('messages').select('id, conversation_id, content, created_at, sender_id, read_at, attachment_type')
              .in('conversation_id', hConvIds).order('created_at', { ascending: false });
            (hMsgs || []).forEach((m: any) => {
              if (!hLastMsgMap.has(m.conversation_id)) hLastMsgMap.set(m.conversation_id, m);
              if (m.sender_id !== userId && !m.read_at)
                hUnreadMap.set(m.conversation_id, (hUnreadMap.get(m.conversation_id) || 0) + 1);
            });
          }

          const hospEnriched = hospConvs.map((conv: any) => ({
            ...conv,
            patient_id: userId,
            doctor_id: null,
            otherUser: {
              id: conv.hospital_id,
              full_name: hospMap.get(conv.hospital_id)?.name || 'Hospital',
              profile_image: null,
              isHospital: true,
            },
            lastMessage: hLastMsgMap.get(conv.id) || null,
            unreadCount: hUnreadMap.get(conv.id) || 0,
            currentUserId: userId,
            isCurrentUserDoctor: false,
            isHospitalConv: true,
          }));

          convIdsRef.current = [...convIdsRef.current, ...hConvIds];
          setConversations(prev => [...prev, ...hospEnriched].sort((a: any, b: any) => {
            const ta = new Date(a.lastMessage?.created_at || a.updated_at || 0).getTime();
            const tb = new Date(b.lastMessage?.created_at || b.updated_at || 0).getTime();
            return tb - ta;
          }));
          refreshUnreadCount();
        }
      } catch {
        // hospital_id column not yet added — skip silently
      }
    } catch (e) { console.error('Load conversations error:', e); }
  };

  const loadHospitalConversations = async (userId: string) => {
    try {
      const { data: prof } = await supabase
        .from('profiles').select('full_name, hospital_name').eq('id', userId).maybeSingle();
      const name = prof?.hospital_name || prof?.full_name;
      if (!name) { setConversations([]); return; }

      const { data: hosp } = await supabase
        .from('hospitals').select('id, name').ilike('name', `%${name}%`).maybeSingle();
      if (!hosp?.id) { setConversations([]); return; }

      const { data: staff } = await supabase
        .from('hospital_staff')
        .select('doctor_id, doctors!inner(id, full_name, title, profile_image, user_id)')
        .eq('hospital_id', hosp.id)
        .eq('status', 'active');

      if (!staff?.length) { setConversations([]); return; }

      const staffUserIds = staff.map((s: any) => s.doctors?.user_id).filter(Boolean);

      const { data: existingConvs } = await supabase
        .from('conversations')
        .select('id, patient_id, updated_at')
        .eq('hospital_id', hosp.id)
        .in('patient_id', staffUserIds);

      const convMap = new Map<string, any>((existingConvs || []).map((c: any) => [c.patient_id, c]));

      // Create conversations for staff members who don't have one yet
      const missing = staff.filter((s: any) => s.doctors?.user_id && !convMap.has(s.doctors.user_id));
      if (missing.length > 0) {
        const toInsert = missing.map((s: any) => ({ hospital_id: hosp.id, patient_id: s.doctors.user_id }));
        const { data: created } = await supabase.from('conversations').insert(toInsert).select('id, patient_id, updated_at');
        (created || []).forEach((c: any) => convMap.set(c.patient_id, c));
      }

      const convIds = [...convMap.values()].map((c: any) => c.id).filter(Boolean);
      const lastMsgMap = new Map<string, any>();
      const unreadMap  = new Map<string, number>();

      if (convIds.length > 0) {
        const { data: msgs } = await supabase
          .from('messages').select('id, conversation_id, content, created_at, sender_id, read_at, attachment_type')
          .in('conversation_id', convIds).order('created_at', { ascending: false });
        (msgs || []).forEach((m: any) => {
          if (!lastMsgMap.has(m.conversation_id)) lastMsgMap.set(m.conversation_id, m);
          if (m.sender_id !== userId && !m.read_at)
            unreadMap.set(m.conversation_id, (unreadMap.get(m.conversation_id) || 0) + 1);
        });
      }

      const enriched = staff
        .filter((s: any) => s.doctors?.user_id && convMap.has(s.doctors.user_id))
        .map((s: any) => {
          const conv = convMap.get(s.doctors.user_id)!;
          const title  = s.doctors.title || 'Dr.';
          const dName  = s.doctors.full_name || '';
          const displayName = /^dr\.?\s/i.test(dName.trim()) ? dName.trim() : `${title.endsWith('.') ? title : title + '.'} ${dName}`.trim();
          return {
            ...conv,
            otherUser: {
              id: s.doctors.user_id,
              full_name: displayName,
              profile_image: s.doctors.profile_image,
              title: s.doctors.title,
              isDoctor: true,
              isHospitalConv: true,
            },
            lastMessage: lastMsgMap.get(conv.id) || null,
            unreadCount: unreadMap.get(conv.id) || 0,
            currentUserId: userId,
            isCurrentUserDoctor: false,
            isHospitalConv: true,
          };
        })
        .sort((a: any, b: any) => {
          const ta = new Date(a.lastMessage?.created_at || a.updated_at || 0).getTime();
          const tb = new Date(b.lastMessage?.created_at || b.updated_at || 0).getTime();
          return tb - ta;
        });

      convIdsRef.current = convIds;
      setConversations(enriched);
      refreshUnreadCount();
    } catch (e) {
      console.error('Hospital conversations error:', e);
      setConversations([]);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (currentUserId) await loadConversations(currentUserId);
    setRefreshing(false);
  };

  const markAllRead = async () => {
    if (!currentUserId || convIdsRef.current.length === 0) return;
    setMarkingRead(true);
    try {
      await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .in('conversation_id', convIdsRef.current)
        .neq('sender_id', currentUserId)
        .is('read_at', null);
      await loadConversations(currentUserId);
    } catch {}
    setMarkingRead(false);
  };

  const totalUnread = conversations.reduce((s, c) => s + c.unreadCount, 0);

  const formatTime = (iso: string) => {
    const d = new Date(iso), now = new Date();
    if (d.toDateString() === now.toDateString())
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const filtered = conversations
    .filter(c => {
      const matchesSearch = !searchQuery.trim() ||
        (c.otherUser?.full_name || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = filterMode === 'all' || c.unreadCount > 0;
      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      if (sortMode === 'unread') {
        if (b.unreadCount !== a.unreadCount) return b.unreadCount - a.unreadCount;
      }
      const ta = new Date(a.lastMessage?.created_at || a.updated_at).getTime();
      const tb = new Date(b.lastMessage?.created_at || b.updated_at).getTime();
      return sortMode === 'oldest' ? ta - tb : tb - ta;
    });

  const previewIcon = (msg: any) => {
    if (msg?.attachment_type === 'voice') return 'mic';
    if (msg?.attachment_type === 'image') return 'image-outline';
    if (msg?.attachment_type === 'file')  return 'document-outline';
    return null;
  };

  const previewText = (msg: any) => {
    if (msg?.attachment_type === 'voice') return 'Voice message';
    if (msg?.attachment_type === 'image') return 'Photo';
    if (msg?.attachment_type === 'file')  return 'Document';
    return msg?.content || 'No messages yet';
  };

  const renderItem = ({ item }: any) => {
    const icon    = previewIcon(item.lastMessage);
    const preview = previewText(item.lastMessage);
    const hasUnread = item.unreadCount > 0;

    return (
      <TouchableOpacity style={s.item} activeOpacity={0.75} onPress={() => navigation.navigate('Conversation', {
        conversationId: item.id,
        other: {
          id:            item.otherUser?.id ?? (item.isCurrentUserDoctor ? item.patient_id : item.doctor_id),
          full_name:     item.otherUser?.full_name,
          avatar_url:    item.otherUser?.profile_image,
          isDoctor:      item.isHospitalConv ? !!item.otherUser?.isDoctor : !item.isCurrentUserDoctor,
          isHospital:    item.otherUser?.isHospital,
          isHospitalConv: item.isHospitalConv,
          title:         item.otherUser?.title,
        },
        currentUserId,
      })}>
        <View style={s.avatarWrap}>
          {item.otherUser?.profile_image
            ? <Image source={{ uri: item.otherUser.profile_image }} style={s.avatarImg} />
            : <View style={[s.avatarImg, s.avatarFallback]}>
                {item.otherUser?.isHospital
                  ? <Ionicons name="business-outline" size={22} color={C.teal} />
                  : item.isCurrentUserDoctor
                  ? <Ionicons name="person" size={22} color={C.teal} />
                  : <MaterialCommunityIcons name="stethoscope" size={22} color={C.teal} />}
              </View>}
          {hasUnread && <View style={s.onlineDot} />}
        </View>
        <View style={s.info}>
          <View style={s.infoTop}>
            <Text style={s.name} numberOfLines={1}>{item.otherUser?.full_name || 'Unknown'}</Text>
            {item.lastMessage && <Text style={s.time}>{formatTime(item.lastMessage.created_at)}</Text>}
          </View>
          <View style={s.infoBottom}>
            <View style={s.previewRow}>
              {icon && (
                <Ionicons name={icon as any} size={13} color={hasUnread ? C.text : C.muted} style={{ marginRight: 3 }} />
              )}
              <Text style={[s.lastMsg, hasUnread && s.lastMsgUnread]} numberOfLines={1}>
                {preview}
              </Text>
            </View>
            {hasUnread && (
              <View style={s.unreadBadge}>
                <Text style={s.unreadText}>{item.unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#083236" />

      {/* Teal Header */}
      <View style={s.header}>
        <View style={s.headerTitles}>
          <Text style={s.headerTitle}>Messages</Text>
          <Text style={s.headerSubtitle}>{totalUnread > 0 ? `${totalUnread} unread` : 'Your conversations'}</Text>
        </View>
        {totalUnread > 0 && (
          <TouchableOpacity style={s.readAllBtn} onPress={markAllRead} disabled={markingRead}>
            {markingRead
              ? <ActivityIndicator size="small" color="#fff" />
              : <>
                  <Ionicons name="checkmark-done-outline" size={15} color="#fff" />
                  <Text style={s.readAllText}>Read All</Text>
                </>}
          </TouchableOpacity>
        )}
      </View>

      {/* White Card */}
      <View style={s.card}>
        {/* Search bar */}
        <View style={[s.searchWrap, searchFocused && s.searchWrapFocused]}>
          <Ionicons name="search-outline" size={17} color={C.muted} />
          <TextInput
            style={s.searchInput}
            placeholder="Search conversations..."
            placeholderTextColor={C.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {!!searchQuery && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color={C.muted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter + Sort toolbar */}
        <View style={s.toolbarWrap}>
          <View style={s.toolbar}>
            <View style={s.filterTabs}>
              <TouchableOpacity
                style={[s.filterTab, filterMode === 'all' && s.filterTabActive]}
                onPress={() => setFilterMode('all')}
              >
                <Text style={[s.filterTabText, filterMode === 'all' && s.filterTabTextActive]}>All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.filterTab, filterMode === 'unread' && s.filterTabActive]}
                onPress={() => setFilterMode('unread')}
              >
                <Text style={[s.filterTabText, filterMode === 'unread' && s.filterTabTextActive]}>Unread</Text>
                {totalUnread > 0 && (
                  <View style={s.filterBadge}>
                    <Text style={s.filterBadgeText}>{totalUnread}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={s.sortBtn} onPress={() => setShowSortMenu(v => !v)}>
              <Ionicons name="funnel-outline" size={14} color={C.teal} />
              <Text style={s.sortBtnText}>
                {sortMode === 'newest' ? 'Newest' : sortMode === 'oldest' ? 'Oldest' : 'Unread first'}
              </Text>
              <Ionicons name={showSortMenu ? 'chevron-up' : 'chevron-down'} size={13} color={C.teal} />
            </TouchableOpacity>
          </View>

          {/* Sort dropdown — floats over list */}
          {showSortMenu && (
            <>
              <TouchableOpacity style={s.sortBackdrop} activeOpacity={1} onPress={() => setShowSortMenu(false)} />
              <View style={s.sortMenu}>
                {([['newest', 'Newest first'], ['unread', 'Unread first'], ['oldest', 'Oldest first']] as [SortMode, string][]).map(([key, label]) => (
                  <TouchableOpacity
                    key={key}
                    style={s.sortMenuItem}
                    onPress={() => { setSortMode(key); setShowSortMenu(false); }}
                  >
                    <Text style={[s.sortMenuText, sortMode === key && s.sortMenuTextActive]}>{label}</Text>
                    {sortMode === key && <Ionicons name="checkmark" size={15} color={C.teal} />}
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </View>

        {loading ? (
          <ActivityIndicator color={C.teal} style={{ flex: 1 }} />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={i => i.id}
            renderItem={renderItem}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.teal} colors={[C.teal]} />}
            ListEmptyComponent={
              <View style={s.empty}>
                <View style={s.emptyIconWrap}>
                  {searchQuery
                    ? <Ionicons name="search-outline" size={40} color={C.teal} />
                    : filterMode === 'unread'
                    ? <Ionicons name="checkmark-done-outline" size={40} color={C.teal} />
                    : <Ionicons name="chatbubbles-outline" size={40} color={C.teal} />}
                </View>
                <Text style={s.emptyText}>
                  {isHospitalAdmin ? 'No staff yet' : searchQuery ? 'No results' : filterMode === 'unread' ? 'All read' : 'No conversations yet'}
                </Text>
                <Text style={s.emptySub}>
                  {isHospitalAdmin
                    ? 'Invite practitioners from the Staff tab to start messaging them here.'
                    : searchQuery
                    ? `Nothing matching "${searchQuery}"`
                    : filterMode === 'unread'
                    ? "You're all caught up — no unread messages"
                    : 'Messages with doctors and patients appear here'}
                </Text>
              </View>
            }
            ItemSeparatorComponent={() => <View style={s.separator} />}
            contentContainerStyle={{ flexGrow: 1 }}
          />
        )}
      </View>

      {/* FAB: practitioners can start a conversation with another practitioner */}
      {isDoctor && (
        <TouchableOpacity
          style={s.fab}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('DoctorsList')}
        >
          <Ionicons name="create-outline" size={22} color="#fff" />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#083236' },

  // Header
  header:       { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 24, paddingTop: 28, paddingBottom: 32 },
  headerTitles: { flex: 1 },
  headerTitle:  { fontSize: 26, fontFamily: 'Montserrat_800ExtraBold', color: '#ffffff', letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: 'rgba(255,255,255,0.70)', marginTop: 2 },
  readAllBtn:   { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  readAllText:  { fontSize: 12, fontFamily: 'Montserrat_600SemiBold', color: '#fff' },

  // Toolbar
  toolbarWrap:  { zIndex: 10 },
  toolbar:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 },
  filterTabs:   { flexDirection: 'row', gap: 6 },
  filterTab:    { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: C.surface },
  filterTabActive: { backgroundColor: C.teal },
  filterTabText:   { fontSize: 13, fontFamily: 'Montserrat_600SemiBold', color: C.muted },
  filterTabTextActive: { color: '#fff' },
  filterBadge:  { backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  filterBadgeText: { fontSize: 10, fontFamily: 'Montserrat_700Bold', color: '#fff' },
  sortBtn:      { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  sortBtnText:  { fontSize: 12, fontFamily: 'SpaceGrotesk_500Medium', color: C.teal },
  sortBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: -9999 },
  sortMenu:     { position: 'absolute', top: 46, right: 16, width: 180, backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 8 },
  sortMenuItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.border },
  sortMenuText: { fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: C.text },
  sortMenuTextActive: { fontFamily: 'SpaceGrotesk_500Medium', color: C.teal },

  // Paper card
  card: { flex: 1, backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },

  // Search
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 14, marginBottom: 6, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: C.surface, borderRadius: 14, borderWidth: 1.5, borderColor: 'transparent' },
  searchWrapFocused: { borderColor: C.teal, backgroundColor: C.card },
  searchInput: { flex: 1, fontSize: 14, fontFamily: 'SpaceGrotesk_400Regular', color: C.text, paddingVertical: 0 },
  previewRow: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },

  // List item
  item:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 14 },
  avatarWrap:  { position: 'relative' },
  avatarImg:   { width: 52, height: 52, borderRadius: 26 },
  avatarFallback: { backgroundColor: C.tealLight, alignItems: 'center', justifyContent: 'center' },
  onlineDot:   { position: 'absolute', bottom: 1, right: 1, width: 13, height: 13, borderRadius: 7, backgroundColor: '#22C55E', borderWidth: 2, borderColor: C.bg },
  info:        { flex: 1, gap: 4 },
  infoTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoBottom:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name:        { fontSize: 15, fontFamily: 'Montserrat_600SemiBold', color: C.text, flex: 1, marginRight: 8 },
  time:        { fontSize: 11, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted },
  lastMsg:     { fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted, flex: 1, marginRight: 8 },
  lastMsgUnread: { color: C.text, fontFamily: 'SpaceGrotesk_500Medium' },
  unreadBadge: { backgroundColor: C.teal, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  unreadText:  { fontSize: 11, fontFamily: 'Montserrat_700Bold', color: '#fff' },
  separator:   { height: 1, backgroundColor: C.border, marginLeft: 86 },

  // FAB
  fab: { position: 'absolute', bottom: 28, right: 24, width: 52, height: 52, borderRadius: 26, backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center', shadowColor: '#083236', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.28, shadowRadius: 14, elevation: 8 },

  // Empty
  empty:       { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyIconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: C.tealLight, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyText:   { fontSize: 16, fontFamily: 'Montserrat_700Bold', color: C.text },
  emptySub:    { fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted, textAlign: 'center', maxWidth: 240 },
});

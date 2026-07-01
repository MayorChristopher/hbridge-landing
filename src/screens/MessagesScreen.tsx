import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, Image, ActivityIndicator, RefreshControl, StatusBar, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useChatBadge } from '../context/ChatBadgeContext';

const C = { bg: '#FFFFFF', surface: '#F5F5F5', text: '#171717', muted: '#737373', border: '#E5E5E5', teal: '#0B7E8A', tealLight: '#E6F5F5' };

export default function MessagesScreen({ navigation }: any) {
  const [conversations, setConversations]   = useState<any[]>([]);
  const [loading, setLoading]               = useState(true);
  const [refreshing, setRefreshing]         = useState(false);
  const [currentUserId, setCurrentUserId]   = useState<string | null>(null);
  const [searchQuery, setSearchQuery]       = useState('');
  const [searchFocused, setSearchFocused]   = useState(false);
  const { refreshUnreadCount }              = useChatBadge();
  const userIdRef                           = useRef<string | null>(null);

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

  // Re-fetch on focus so read_at updates are picked up and badge clears
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (userIdRef.current) loadConversations(userIdRef.current);
    });
    return unsubscribe;
  }, [navigation]);

  const loadConversations = async (userId: string) => {
    try {
      const { data: doctorData } = await supabase.from('doctors').select('id').eq('user_id', userId).maybeSingle();
      const conversationFilter = doctorData
        ? `doctor_id.eq.${doctorData.id}`
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
      setConversations(enriched);
      refreshUnreadCount();
    } catch (e) { console.error('Load conversations error:', e); }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (currentUserId) await loadConversations(currentUserId);
    setRefreshing(false);
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso), now = new Date();
    if (d.toDateString() === now.toDateString())
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const filtered = conversations.filter(c =>
    !searchQuery.trim() ||
    (c.otherUser?.full_name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

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
          id:         item.isCurrentUserDoctor ? item.patient_id : item.doctor_id,
          full_name:  item.otherUser?.full_name,
          avatar_url: item.otherUser?.profile_image,
          isDoctor:   !item.isCurrentUserDoctor,
          title:      item.otherUser?.title,
        },
        currentUserId,
      })}>
        <View style={s.avatarWrap}>
          {item.otherUser?.profile_image
            ? <Image source={{ uri: item.otherUser.profile_image }} style={s.avatarImg} />
            : <View style={[s.avatarImg, s.avatarFallback]}>
                {item.isCurrentUserDoctor
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
      <StatusBar barStyle="light-content" backgroundColor="#0B7E8A" />

      {/* Teal Header */}
      <View style={s.header}>
        <View style={s.headerIconWrap}>
          <Ionicons name="chatbubbles" size={26} color="#ffffff" />
        </View>
        <View style={s.headerTitles}>
          <Text style={s.headerTitle}>Messages</Text>
          <Text style={s.headerSubtitle}>Your conversations</Text>
        </View>
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
                    : <Ionicons name="chatbubbles-outline" size={40} color={C.teal} />}
                </View>
                <Text style={s.emptyText}>{searchQuery ? 'No results' : 'No conversations yet'}</Text>
                <Text style={s.emptySub}>
                  {searchQuery ? `Nothing matching "${searchQuery}"` : 'Messages with doctors and patients appear here'}
                </Text>
              </View>
            }
            ItemSeparatorComponent={() => <View style={s.separator} />}
            contentContainerStyle={{ flexGrow: 1 }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#0B7E8A' },

  // Header
  header:       { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 32 },
  headerIconWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center' },
  headerTitles: { flex: 1 },
  headerTitle:  { fontSize: 26, fontWeight: '700', color: '#ffffff', letterSpacing: -0.3 },
  headerSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.75)', marginTop: 2 },

  // White card
  card: { flex: 1, backgroundColor: '#ffffff', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden' },

  // Search
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 14, marginBottom: 6, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: C.surface, borderRadius: 14, borderWidth: 1.5, borderColor: 'transparent' },
  searchWrapFocused: { borderColor: C.teal, backgroundColor: '#fff' },
  searchInput: { flex: 1, fontSize: 14, color: C.text, paddingVertical: 0 },
  previewRow: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },

  // List item
  item:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 14 },
  avatarWrap:  { position: 'relative' },
  avatarImg:   { width: 52, height: 52, borderRadius: 26 },
  avatarFallback: { backgroundColor: C.tealLight, alignItems: 'center', justifyContent: 'center' },
  onlineDot:   { position: 'absolute', bottom: 1, right: 1, width: 13, height: 13, borderRadius: 7, backgroundColor: C.teal, borderWidth: 2, borderColor: '#fff' },
  info:        { flex: 1, gap: 4 },
  infoTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoBottom:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name:        { fontSize: 15, fontWeight: '600', color: C.text, flex: 1, marginRight: 8 },
  time:        { fontSize: 12, color: C.muted },
  lastMsg:     { fontSize: 13, color: C.muted, flex: 1, marginRight: 8 },
  lastMsgUnread: { color: C.text, fontWeight: '600' },
  unreadBadge: { backgroundColor: C.teal, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  unreadText:  { fontSize: 11, fontWeight: '700', color: '#fff' },
  separator:   { height: 1, backgroundColor: C.border, marginLeft: 86 },

  // Empty
  empty:       { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyIconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: C.tealLight, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyText:   { fontSize: 16, fontWeight: '700', color: C.text },
  emptySub:    { fontSize: 13, color: C.muted, textAlign: 'center', maxWidth: 240 },
});

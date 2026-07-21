import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, FlatList, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, StatusBar, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ToastProvider';

const C = {
  bg: '#F5F3EE', card: '#FFFFFF', border: '#EAE5DA', text: '#0C2E30',
  muted: '#6B7E7F', teal: '#0B7E8A', ink: '#083236', bubbleMe: '#0B7E8A', bubbleThem: '#FFFFFF',
};

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default function HospitalTeamChatScreen({ route, navigation }: any) {
  const { hospitalId, hospitalName } = route.params;
  const toast = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const flatRef = useRef<FlatList>(null);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    load();
    channelRef.current = supabase
      .channel(`hospital-team-${hospitalId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'hospital_team_messages',
        filter: `hospital_id=eq.${hospitalId}`,
      }, (payload: any) => {
        const msg = payload.new;
        setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
        setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 80);
      })
      .subscribe();
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current); };
  }, [hospitalId]);

  const load = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data } = await supabase
        .from('hospital_team_messages')
        .select('id, sender_id, content, created_at, profiles!sender_id(full_name)')
        .eq('hospital_id', hospitalId)
        .order('created_at', { ascending: true })
        .limit(200);
      setMessages(data || []);
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: false }), 100);
    } catch (e: any) {
      toast.showError('Error', e.message);
    } finally { setLoading(false); }
  };

  const send = async () => {
    if (!text.trim() || !userId) return;
    const content = text.trim();
    setText('');
    setSending(true);
    try {
      const { error } = await supabase.from('hospital_team_messages').insert({
        hospital_id: hospitalId, sender_id: userId, content,
      });
      if (error) throw error;
    } catch (e: any) {
      toast.showError('Error', e.message);
    } finally { setSending(false); }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={C.ink} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerTitles}>
          <Text style={styles.headerTitle}>Team Chat</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>{hospitalName}</Text>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        {loading ? (
          <ActivityIndicator style={{ marginTop: 60 }} color={C.teal} size="large" />
        ) : (
          <FlatList
            ref={flatRef}
            data={messages}
            keyExtractor={m => m.id}
            contentContainerStyle={{ padding: 16 }}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingTop: 60 }}>
                <Ionicons name="people-outline" size={40} color={C.muted} />
                <Text style={{ color: C.muted, marginTop: 10, fontFamily: 'SpaceGrotesk_400Regular' }}>
                  No messages yet — say hello to your team.
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const isMe = item.sender_id === userId;
              return (
                <View style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowThem]}>
                  {!isMe && <Text style={styles.senderName}>{item.profiles?.full_name ?? 'Team member'}</Text>}
                  <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
                    <Text style={[styles.msgText, isMe && { color: '#fff' }]}>{item.content}</Text>
                  </View>
                  <Text style={styles.msgTime}>{fmtTime(item.created_at)}</Text>
                </View>
              );
            }}
          />
        )}

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Message your team…"
            placeholderTextColor={C.muted}
            multiline
          />
          <TouchableOpacity style={[styles.sendBtn, (!text.trim() || sending) && { opacity: 0.5 }]} onPress={send} disabled={!text.trim() || sending}>
            <Ionicons name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { backgroundColor: C.ink, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  headerTitles: { flex: 1 },
  headerTitle: { color: '#fff', fontSize: 17, fontFamily: 'Montserrat_600SemiBold' },
  headerSubtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular' },
  msgRow: { marginBottom: 14, maxWidth: '80%' },
  msgRowMe: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  msgRowThem: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  senderName: { fontSize: 11, color: C.muted, fontFamily: 'SpaceGrotesk_400Regular', marginBottom: 3, marginLeft: 4 },
  bubble: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMe: { backgroundColor: C.bubbleMe, borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: C.bubbleThem, borderWidth: 1, borderColor: C.border, borderBottomLeftRadius: 4 },
  msgText: { fontSize: 14, color: C.text, fontFamily: 'SpaceGrotesk_400Regular', lineHeight: 20 },
  msgTime: { fontSize: 10, color: C.muted, marginTop: 3, marginHorizontal: 4 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, padding: 12, backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.border },
  input: { flex: 1, maxHeight: 100, backgroundColor: C.bg, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, fontFamily: 'SpaceGrotesk_400Regular', color: C.text },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center' },
});

import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, FlatList, TextInput, TouchableOpacity,
  Image, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
  Linking, Keyboard, Modal, Pressable, Animated, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';

const C = {
  bg: '#FFFFFF', surface: '#F4F4F5', text: '#0A0A0A',
  muted: '#737373', border: '#E4E4E7', teal: '#0B7E8A',
  greenLight: '#E6F5F5', greenDark: '#038a36', bubble: '#F4F4F5',
};

type Msg = {
  id: string;
  sender_id: string;
  content: string;
  attachment_url?: string;
  attachment_type?: 'image' | 'file';
  attachment_name?: string;
  attachment_size?: string;
  read_at?: string | null;
  created_at: string;
  _pending?: boolean;
  _failed?: boolean;
};

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const formatDayLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
};

export default function ConversationScreen({ route, navigation }: any) {
  const { conversationId, other, currentUserId } = route.params;
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachVisible, setAttachVisible] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const flatRef = useRef<FlatList>(null);
  const typingTimeout = useRef<any>(null);
  const sendBtnScale = useRef(new Animated.Value(1)).current;
  const sendBtnRotate = useRef(new Animated.Value(0)).current;

  // display name with title prefix for doctors
  const displayName = other?.isDoctor
    ? `${other?.title || 'Dr.'} ${other?.full_name || ''}`.trim()
    : (other?.full_name || 'Chat');

  useEffect(() => {
    loadMessages();
    const keyboardSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 80),
    );
    const channel = supabase
      .channel(`conv-${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, payload => {
        const msg = payload.new as Msg;
        setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
        setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 80);
        // mark as read immediately if received
        if (msg.sender_id !== currentUserId) {
          supabase.from('messages').update({ read_at: new Date().toISOString() })
            .eq('id', msg.id).then(() => {});
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, payload => {
        const updated = payload.new as Msg;
        setMessages(prev => prev.map(m => m.id === updated.id ? { ...m, read_at: updated.read_at } : m));
      })
      .subscribe();
    return () => { keyboardSub.remove(); supabase.removeChannel(channel); };
  }, []);

  const loadMessages = async () => {
    const { data } = await supabase
      .from('messages').select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    if (data) setMessages(data);
    setLoading(false);
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: false }), 100);
    // mark all unread as read
    await supabase.from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .neq('sender_id', currentUserId)
      .is('read_at', null);
  };

  const sendMessage = async (
    content: string,
    attachmentUrl?: string,
    attachmentType?: string,
    attachmentName?: string,
    attachmentSize?: string,
  ) => {
    if (!content.trim() && !attachmentUrl) return;
    const tempId = `temp-${Date.now()}`;
    const optimistic: Msg = {
      id: tempId, sender_id: currentUserId,
      content: content.trim(),
      attachment_url: attachmentUrl,
      attachment_type: attachmentType as any,
      attachment_name: attachmentName,
      attachment_size: attachmentSize,
      created_at: new Date().toISOString(),
      _pending: true,
    };
    setMessages(prev => [...prev, optimistic]);
    setInput('');
    setSending(true);
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 50);
    try {
      const { data, error } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: currentUserId,
        content: content.trim(),
        attachment_url: attachmentUrl || null,
        attachment_type: attachmentType || null,
        attachment_name: attachmentName || null,
        attachment_size: attachmentSize || null,
      }).select().single();
      if (error) throw error;
      setMessages(prev => prev.map(m => m.id === tempId ? { ...data, _pending: false } : m));
      supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId).then(() => {});
    } catch {
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, _pending: false, _failed: true } : m));
    } finally {
      setSending(false);
    }
  };

  const uploadFile = async (uri: string, name: string, mimeType: string) => {
    const path = `chat/${conversationId}/${Date.now()}-${name}`;
    const { data: session } = await supabase.auth.getSession();
    const token = session?.session?.access_token;
    const supabaseUrl = (supabase as any).supabaseUrl as string;
    const form = new FormData();
    form.append('file', { uri, name, type: mimeType } as any);
    const res = await fetch(`${supabaseUrl}/storage/v1/object/attachments/${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'x-upsert': 'true' },
      body: form,
    });
    if (!res.ok) throw new Error(await res.text());
    const { data: { publicUrl } } = supabase.storage.from('attachments').getPublicUrl(path);
    return publicUrl;
  };

  const pickImage = async () => {
    setAttachVisible(false);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Allow photo access to send images'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const ext = asset.uri.split('.').pop() || 'jpg';
      const name = `image_${Date.now()}.${ext}`;
      setUploading(true);
      try {
        const url = await uploadFile(asset.uri, name, `image/${ext}`);
        await sendMessage('', url, 'image', name);
      } catch (e: any) {
        Alert.alert('Upload failed', e.message);
      } finally { setUploading(false); }
    }
  };

  const pickDocument = async () => {
    setAttachVisible(false);
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setUploading(true);
      try {
        const url = await uploadFile(asset.uri, asset.name, asset.mimeType || 'application/octet-stream');
        const sizeKB = asset.size ? `${Math.round(asset.size / 1024)} KB` : '';
        await sendMessage('', url, 'file', asset.name, sizeKB);
      } catch (e: any) {
        Alert.alert('Upload failed', e.message);
      } finally { setUploading(false); }
    }
  };

  const renderMsg = ({ item, index }: { item: Msg; index: number }) => {
    const isMe = item.sender_id === currentUserId;
    const prev = messages[index - 1];
    const next = messages[index + 1];
    const showDay = !prev || new Date(item.created_at).toDateString() !== new Date(prev.created_at).toDateString();
    const isLastInGroup = !next || next.sender_id !== item.sender_id;
    const isRead = isMe && !!item.read_at;

    return (
      <>
        {showDay && (
          <View style={s.dayWrap}>
            <View style={s.dayLine} />
            <Text style={s.dayText}>{formatDayLabel(item.created_at)}</Text>
            <View style={s.dayLine} />
          </View>
        )}
        <View style={[s.msgRow, isMe ? s.msgRowMe : s.msgRowThem, !isLastInGroup && { marginBottom: 2 }]}>
          {/* avatar for other person, only on last in group */}
          {!isMe && (
            <View style={s.msgAvatar}>
              {isLastInGroup ? (
                other?.avatar_url
                  ? <Image source={{ uri: other.avatar_url }} style={s.msgAvatarImg} />
                  : <View style={[s.msgAvatarImg, s.msgAvatarFallback]}>
                      {other?.isDoctor
                        ? <MaterialCommunityIcons name="stethoscope" size={12} color={C.teal} />
                        : <Ionicons name="person" size={12} color={C.teal} />}
                    </View>
              ) : <View style={s.msgAvatarImg} />}
            </View>
          )}

          <View style={[s.bubble, isMe ? s.bubbleMe : s.bubbleThem,
            isMe
              ? { borderBottomRightRadius: isLastInGroup ? 4 : 18 }
              : { borderBottomLeftRadius: isLastInGroup ? 4 : 18 }
          ]}>
            {/* image attachment */}
            {item.attachment_type === 'image' && item.attachment_url && (
              <TouchableOpacity onPress={() => Linking.openURL(item.attachment_url!)}>
                <Image source={{ uri: item.attachment_url }} style={s.attachImg} resizeMode="cover" />
              </TouchableOpacity>
            )}
            {/* file attachment */}
            {item.attachment_type === 'file' && item.attachment_url && (
              <TouchableOpacity style={[s.fileCard, isMe && s.fileCardMe]} onPress={() => Linking.openURL(item.attachment_url!)}>
                <View style={s.fileIconBox}>
                  <Ionicons name="document-text" size={18} color={isMe ? '#fff' : C.teal} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.fileName, isMe && { color: '#fff' }]} numberOfLines={1}>{item.attachment_name || 'File'}</Text>
                  <Text style={[s.fileSize, isMe && { color: 'rgba(255,255,255,0.7)' }]}>{item.attachment_size || 'Tap to open'}</Text>
                </View>
                <Ionicons name="arrow-down-circle-outline" size={20} color={isMe ? '#fff' : C.muted} />
              </TouchableOpacity>
            )}
            {/* text */}
            {!!item.content && (
              <Text style={[s.msgText, isMe && s.msgTextMe]}>{item.content}</Text>
            )}
            {/* time + status */}
            <View style={s.msgMeta}>
              <Text style={[s.msgTime, isMe && s.msgTimeMe]}>{formatTime(item.created_at)}</Text>
              {isMe && (
                item._failed
                  ? <Ionicons name="alert-circle" size={12} color="#EF4444" style={{ marginLeft: 4 }} />
                  : item._pending
                  ? <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.6)" style={{ marginLeft: 4 }} />
                  : isRead
                  ? <Ionicons name="checkmark-done" size={12} color={C.greenLight} style={{ marginLeft: 4 }} />
                  : <Ionicons name="checkmark" size={12} color="rgba(255,255,255,0.6)" style={{ marginLeft: 4 }} />
              )}
            </View>
          </View>
        </View>
      </>
    );
  };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#0B7E8A" />
      {/* Teal Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#ffffff" />
        </TouchableOpacity>
        <View style={s.headerAvatarWrap}>
          {other?.avatar_url
            ? <Image source={{ uri: other.avatar_url }} style={s.headerAvatar} />
            : <View style={[s.headerAvatar, s.headerAvatarFallback]}>
                {other?.isDoctor
                  ? <MaterialCommunityIcons name="stethoscope" size={18} color={C.teal} />
                  : <Ionicons name="person" size={18} color={C.teal} />}
              </View>}
          <View style={s.onlineDot} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.headerName} numberOfLines={1}>{displayName}</Text>
          <Text style={s.headerSub}>{other?.isDoctor ? 'Medical Professional' : 'Patient'}</Text>
        </View>
        <TouchableOpacity
          style={s.headerAction}
          onPress={() => navigation.navigate('BookConsultation', { doctor: other })}
        >
          <Ionicons name="calendar-outline" size={20} color="rgba(255,255,255,0.85)" />
        </TouchableOpacity>
      </View>

      {/* White card */}
      <View style={s.contentCard}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        {loading ? (
          <View style={s.center}><ActivityIndicator color={C.teal} size="large" /></View>
        ) : messages.length === 0 ? (
          <View style={s.center}>
            <View style={s.emptyIcon}>
              <Ionicons name="chatbubbles-outline" size={40} color={C.teal} />
            </View>
            <Text style={s.emptyTitle}>Start the conversation</Text>
            <Text style={s.emptySub}>Messages are private and secure</Text>
          </View>
        ) : (
          <FlatList
            ref={flatRef}
            data={messages}
            keyExtractor={i => i.id}
            renderItem={renderMsg}
            contentContainerStyle={s.list}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
          />
        )}

        {/* uploading indicator */}
        {uploading && (
          <View style={s.uploadingBar}>
            <ActivityIndicator size="small" color={C.teal} />
            <Text style={s.uploadingText}>Uploading...</Text>
          </View>
        )}

        {/* Input bar */}
        <View style={s.inputBar}>
          <TouchableOpacity style={s.attachBtn} onPress={() => setAttachVisible(true)}>
            <Ionicons name="add" size={22} color={C.teal} />
          </TouchableOpacity>
          <View style={s.inputWrap}>
            <TextInput
              style={s.input}
              value={input}
              onChangeText={setInput}
              placeholder="Message..."
              placeholderTextColor={C.muted}
              multiline
              maxLength={2000}
            />
          </View>
          <TouchableOpacity
            style={[s.sendBtn, (!input.trim() && !uploading) && s.sendBtnOff]}
            onPress={() => sendMessage(input)}
            disabled={!input.trim() || sending || uploading}
          >
            {sending
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="send" size={17} color="#fff" />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Attachment sheet */}
      <Modal visible={attachVisible} transparent animationType="slide">
        <Pressable style={s.sheetOverlay} onPress={() => setAttachVisible(false)}>
          <Pressable style={s.sheet}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>Send Attachment</Text>
            <TouchableOpacity style={s.sheetRow} onPress={pickImage}>
              <View style={[s.sheetIcon, { backgroundColor: '#E6F5F5' }]}>
                <Ionicons name="image" size={22} color={C.teal} />
              </View>
              <View>
                <Text style={s.sheetLabel}>Photo</Text>
                <Text style={s.sheetSub}>Send image from your library</Text>
              </View>
            </TouchableOpacity>
            <View style={s.sheetDivider} />
            <TouchableOpacity style={s.sheetRow} onPress={pickDocument}>
              <View style={[s.sheetIcon, { backgroundColor: '#EEF2FF' }]}>
                <Ionicons name="document-text" size={22} color="#6366F1" />
              </View>
              <View>
                <Text style={s.sheetLabel}>Document</Text>
                <Text style={s.sheetSub}>Send PDF, DOC or any file</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={[s.sheetRow, { justifyContent: 'center', marginTop: 4 }]} onPress={() => setAttachVisible(false)}>
              <Text style={{ color: C.muted, fontSize: 15, fontWeight: '500' }}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B7E8A' },
  contentCard: { flex: 1, backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: C.text },
  emptySub: { fontSize: 13, color: C.muted },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 28, backgroundColor: 'transparent' },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerAvatarWrap: { position: 'relative' },
  headerAvatar: { width: 42, height: 42, borderRadius: 21 },
  headerAvatarFallback: { backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  onlineDot: { position: 'absolute', bottom: 1, right: 1, width: 10, height: 10, borderRadius: 5, backgroundColor: '#4ADE80', borderWidth: 2, borderColor: '#0B7E8A' },
  headerName: { fontSize: 15, fontWeight: '700', color: '#ffffff' },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 1 },
  headerAction: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },

  // List
  list: { paddingHorizontal: 12, paddingVertical: 16, gap: 4 },

  // Day separator
  dayWrap: { flexDirection: 'row', alignItems: 'center', marginVertical: 16, gap: 8 },
  dayLine: { flex: 1, height: 1, backgroundColor: C.border },
  dayText: { fontSize: 11, color: C.muted, fontWeight: '500' },

  // Message rows
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 6, gap: 6 },
  msgRowMe: { justifyContent: 'flex-end' },
  msgRowThem: { justifyContent: 'flex-start' },
  msgAvatar: { width: 28 },
  msgAvatarImg: { width: 28, height: 28, borderRadius: 14 },
  msgAvatarFallback: { backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center' },

  // Bubbles
  bubble: { maxWidth: '75%', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18 },
  bubbleMe: { backgroundColor: C.teal, borderTopLeftRadius: 18, borderTopRightRadius: 18, borderBottomLeftRadius: 18 },
  bubbleThem: { backgroundColor: C.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, borderBottomRightRadius: 18 },

  // Attachments
  attachImg: { width: 210, height: 160, borderRadius: 10, marginBottom: 4 },
  fileCard: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, paddingHorizontal: 4 },
  fileCardMe: {},
  fileIconBox: { width: 36, height: 36, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  fileName: { fontSize: 13, fontWeight: '600', color: C.text },
  fileSize: { fontSize: 11, color: C.muted },

  // Text + meta
  msgText: { fontSize: 14, color: C.text, lineHeight: 20 },
  msgTextMe: { color: '#fff' },
  msgMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 3 },
  msgTime: { fontSize: 10, color: C.muted },
  msgTimeMe: { color: 'rgba(255,255,255,0.65)' },

  // Uploading
  uploadingBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 8, backgroundColor: C.greenLight },
  uploadingText: { fontSize: 13, color: C.teal, fontWeight: '500' },

  // Input bar
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.bg },
  attachBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center' },
  inputWrap: { flex: 1, backgroundColor: C.surface, borderRadius: 22, paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 10 : 6, minHeight: 40, justifyContent: 'center' },
  input: { fontSize: 14, color: C.text, maxHeight: 120, paddingVertical: 0 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center' },
  sendBtnOff: { backgroundColor: C.muted },

  // Attachment sheet
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, paddingBottom: 36, paddingHorizontal: 20 },
  sheetHandle: { width: 36, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 16 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  sheetIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  sheetLabel: { fontSize: 15, fontWeight: '600', color: C.text },
  sheetSub: { fontSize: 12, color: C.muted, marginTop: 2 },
  sheetDivider: { height: 1, backgroundColor: C.border },
});

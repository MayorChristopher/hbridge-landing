import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet, Text, View, FlatList, TextInput, TouchableOpacity,
  Image, KeyboardAvoidingView, Platform, ActivityIndicator,
  Linking, Keyboard, Modal, Pressable, Animated, StatusBar, PanResponder,
} from 'react-native';
import { Audio } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ToastProvider';

const C = {
  bg: '#F5F3EE', surface: '#EDE9E0', card: '#FFFFFF', text: '#0C2E30',
  muted: '#6B7E7F', border: '#EAE5DA', teal: '#0B7E8A',
  greenLight: 'rgba(11,126,138,0.09)',
};

type Msg = {
  id: string; sender_id: string; content: string;
  attachment_url?: string; attachment_type?: 'image' | 'file' | 'voice';
  attachment_name?: string; attachment_size?: string;
  read_at?: string | null; created_at: string;
  edited_at?: string | null;
  reply_to_id?: string | null;
  reply_to_content?: string | null;
  reply_to_sender?: string | null;
  _pending?: boolean; _failed?: boolean;
};

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const formatDayLabel = (iso: string) => {
  const d = new Date(iso); const today = new Date();
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
};

// Each new message slides up from below and fades in
const AnimatedMsg = React.memo(({ children, isNew }: { children: React.ReactNode; isNew: boolean }) => {
  const translateY = useRef(new Animated.Value(isNew ? 18 : 0)).current;
  const opacity = useRef(new Animated.Value(isNew ? 0 : 1)).current;
  useEffect(() => {
    if (!isNew) return;
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, tension: 80, friction: 9, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 170, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
});

// Three bouncing dots â€” Telegram-style typing indicator
const TypingIndicator = () => {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const bounce = (dot: Animated.Value, delay: number) =>
      Animated.loop(Animated.sequence([
        Animated.delay(delay),
        Animated.timing(dot, { toValue: -5, duration: 220, useNativeDriver: true }),
        Animated.timing(dot, { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.delay(380),
      ]));
    const a1 = bounce(dot1, 0); const a2 = bounce(dot2, 140); const a3 = bounce(dot3, 280);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, []);
  return (
    <View style={{ flexDirection: 'row', gap: 5, paddingVertical: 5, paddingHorizontal: 2, alignItems: 'flex-end' }}>
      {[dot1, dot2, dot3].map((d, i) => (
        <Animated.View key={i} style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.muted, transform: [{ translateY: d }] }} />
      ))}
    </View>
  );
};

// ─── Swipeable message bubble ────────────────────────────────────────────────
interface MsgBubbleProps {
  item: Msg; prev?: Msg; next?: Msg;
  currentUserId: string; other: any;
  knownMsgIds: React.MutableRefObject<Set<string>>;
  soundPlayingId: string | null;
  onAction: (msg: Msg) => void;
  onReply:  (msg: Msg) => void;
  onPlay:   (url: string, id: string) => void;
}

const REPLY_THRESHOLD = 65;

const MessageBubble = React.memo(({
  item, prev, next, currentUserId, other, knownMsgIds,
  soundPlayingId, onAction, onReply, onPlay,
}: MsgBubbleProps) => {
  const isMe = item.sender_id === currentUserId;
  const showDay = !prev ||
    new Date(item.created_at).toDateString() !== new Date(prev.created_at).toDateString();
  const isFirstInGroup = !prev || prev.sender_id !== item.sender_id || showDay;
  const isLastInGroup  = !next || next.sender_id !== item.sender_id ||
    new Date(item.created_at).toDateString() !== new Date(next.created_at).toDateString();
  const isRead = isMe && !!item.read_at;
  const isNew  = !knownMsgIds.current.has(item.id);

  // Swipe-to-reply
  const swipeX   = useRef(new Animated.Value(0)).current;
  const arrowAnim = useRef(new Animated.Value(0)).current;
  const triggered = useRef(false);
  const onReplyRef = useRef(onReply);
  useEffect(() => { onReplyRef.current = onReply; }, [onReply]);

  const snapBack = () => Animated.parallel([
    Animated.spring(swipeX,    { toValue: 0, tension: 120, friction: 8, useNativeDriver: false }),
    Animated.timing(arrowAnim, { toValue: 0, duration: 180, useNativeDriver: false }),
  ]).start();

  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, { dx, dy }) =>
      dx > 8 && Math.abs(dx) > Math.abs(dy) * 1.5,
    onPanResponderGrant: () => { triggered.current = false; },
    onPanResponderMove: (_, { dx }) => {
      if (dx <= 0) return;
      const x = Math.min(dx, REPLY_THRESHOLD + 12);
      swipeX.setValue(x);
      arrowAnim.setValue(Math.min(x / REPLY_THRESHOLD, 1));
      if (!triggered.current && x >= REPLY_THRESHOLD) {
        triggered.current = true;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onReplyRef.current(item);
      }
    },
    onPanResponderRelease:   snapBack,
    onPanResponderTerminate: snapBack,
  })).current;

  const bubbleExtras = isMe
    ? { borderTopLeftRadius: 18, borderTopRightRadius: isFirstInGroup ? 18 : 5,
        borderBottomLeftRadius: 18, borderBottomRightRadius: isLastInGroup ? 4 : 5 }
    : { borderTopLeftRadius: isFirstInGroup ? 18 : 5, borderTopRightRadius: 18,
        borderBottomLeftRadius: isLastInGroup ? 4 : 5, borderBottomRightRadius: 18 };

  return (
    <AnimatedMsg isNew={isNew}>
      {showDay && (
        <View style={s.dayWrap}>
          <View style={s.dayLine} />
          <Text style={s.dayText}>{formatDayLabel(item.created_at)}</Text>
          <View style={s.dayLine} />
        </View>
      )}

      {/* Outer wrapper: reply arrow is fixed, message row slides right */}
      <View>
        {/* Reply arrow — stays put while row slides, fades in from left */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute', left: 4, top: 0, bottom: 0,
            justifyContent: 'center', zIndex: 0,
            opacity: arrowAnim,
            transform: [{ scale: arrowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }],
          }}
        >
          <View style={s.replyArrowCircle}>
            <Ionicons name="return-down-back-outline" size={16} color={C.teal} />
          </View>
        </Animated.View>

        {/* Sliding message row */}
        <Animated.View style={{ transform: [{ translateX: swipeX }] }} {...pan.panHandlers}>
          <View style={[
            s.msgRow,
            isMe ? s.msgRowMe : s.msgRowThem,
            !isLastInGroup && { marginBottom: 2 },
            isFirstInGroup && !showDay && { marginTop: 6 },
          ]}>
            {/* Avatar (received only) */}
            {!isMe && (
              <View style={s.msgAvatar}>
                {isLastInGroup
                  ? other?.avatar_url
                    ? <Image source={{ uri: other.avatar_url }} style={s.msgAvatarImg} />
                    : <View style={[s.msgAvatarImg, s.msgAvatarFallback]}>
                        {other?.isDoctor
                          ? <MaterialCommunityIcons name="stethoscope" size={12} color={C.teal} />
                          : <Ionicons name="person" size={12} color={C.teal} />}
                      </View>
                  : <View style={s.msgAvatarImg} />}
              </View>
            )}

            <TouchableOpacity
              activeOpacity={0.85}
              onLongPress={() => onAction(item)}
              delayLongPress={280}
              style={s.bubbleTouch}
            >
              <View style={[s.bubble, isMe ? s.bubbleMe : s.bubbleThem, bubbleExtras]}>
                {/* Image */}
                {item.attachment_type === 'image' && item.attachment_url && (
                  <TouchableOpacity onPress={() => Linking.openURL(item.attachment_url!)}>
                    <Image source={{ uri: item.attachment_url }} style={s.attachImg} resizeMode="cover" />
                  </TouchableOpacity>
                )}
                {/* File */}
                {item.attachment_type === 'file' && item.attachment_url && (
                  <TouchableOpacity style={s.fileCard} onPress={() => Linking.openURL(item.attachment_url!)}>
                    <View style={[s.fileIconBox, isMe && { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
                      <Ionicons name="document-text" size={18} color={isMe ? '#fff' : C.teal} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.fileName, isMe && { color: '#fff' }]} numberOfLines={1}>{item.attachment_name || 'File'}</Text>
                      <Text style={[s.fileSize, isMe && { color: 'rgba(255,255,255,0.65)' }]}>{item.attachment_size || 'Tap to open'}</Text>
                    </View>
                    <Ionicons name="arrow-down-circle-outline" size={20} color={isMe ? 'rgba(255,255,255,0.75)' : C.muted} />
                  </TouchableOpacity>
                )}
                {/* Reply quote */}
                {item.reply_to_id && (
                  <View style={[s.replyQuote, isMe && s.replyQuoteMe]}>
                    <View style={[s.replyQuoteBar, isMe && { backgroundColor: 'rgba(255,255,255,0.7)' }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[s.replyQuoteFrom, isMe && { color: 'rgba(255,255,255,0.85)' }]}>
                        {item.reply_to_sender === currentUserId ? 'You' : (other?.full_name?.split(' ')[0] || 'Message')}
                      </Text>
                      <Text style={[s.replyQuoteText, isMe && { color: 'rgba(255,255,255,0.7)' }]} numberOfLines={2}>
                        {item.reply_to_content || 'Attachment'}
                      </Text>
                    </View>
                  </View>
                )}
                {/* Voice */}
                {item.attachment_type === 'voice' && item.attachment_url && (
                  <TouchableOpacity style={s.voiceCard} onPress={() => onPlay(item.attachment_url!, item.id)}>
                    <Ionicons
                      name={soundPlayingId === item.id ? 'pause-circle' : 'play-circle'}
                      size={28} color={isMe ? '#fff' : C.teal}
                    />
                    <View style={s.voiceWave}>
                      {[4,7,11,6,9,14,8,5,10,7,12,8,6].map((h, i) => (
                        <View key={i} style={[s.voiceBar, {
                          height: h,
                          backgroundColor: isMe
                            ? (soundPlayingId === item.id ? '#fff' : 'rgba(255,255,255,0.55)')
                            : (soundPlayingId === item.id ? C.teal : C.muted),
                        }]} />
                      ))}
                    </View>
                    <Text style={[s.voiceDur, isMe && { color: 'rgba(255,255,255,0.8)' }]}>
                      {item.attachment_size || '0:00'}
                    </Text>
                  </TouchableOpacity>
                )}
                {/* Text */}
                {!!item.content && (
                  <Text style={[s.msgText, isMe && s.msgTextMe]}>{item.content}</Text>
                )}
                {/* Meta: time + status */}
                <View style={s.msgMeta}>
                  <Text style={[s.msgTime, isMe && s.msgTimeMe]}>{formatTime(item.created_at)}</Text>
                  {!!item.edited_at && (
                    <Text style={[s.msgTime, isMe && s.msgTimeMe, s.editedLabel]}>· edited</Text>
                  )}
                  {isMe && (
                    item._failed   ? <Ionicons name="alert-circle"   size={12} color="#EF4444"                  style={{ marginLeft: 4 }} />
                    : item._pending ? <Ionicons name="time-outline"   size={12} color="rgba(255,255,255,0.55)"   style={{ marginLeft: 4 }} />
                    : isRead        ? <Ionicons name="checkmark-done" size={13} color="#7FFFC4"                  style={{ marginLeft: 4 }} />
                                    : <Ionicons name="checkmark-done" size={13} color="rgba(255,255,255,0.45)"   style={{ marginLeft: 4 }} />
                  )}
                </View>
              </View>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </AnimatedMsg>
  );
});
// ─────────────────────────────────────────────────────────────────────────────

export default function ConversationScreen({ route, navigation }: any) {
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { conversationId, other, currentUserId } = route.params;
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachVisible, setAttachVisible] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [editingMsg, setEditingMsg] = useState<Msg | null>(null);
  const [actionMsg, setActionMsg] = useState<Msg | null>(null);
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordLocked, setIsRecordLocked] = useState(false);
  const [isRecordPaused, setIsRecordPaused] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [soundPlayingId, setSoundPlayingId] = useState<string | null>(null);
  const [msgSearch, setMsgSearch] = useState('');
  const [showMsgSearch, setShowMsgSearch] = useState(false);

  const flatRef = useRef<FlatList>(null);
  const hasInitialScrolled = useRef(false);
  const channelRef = useRef<any>(null);
  const typingTimeout = useRef<any>(null);
  const typingThrottle = useRef<any>(null);
  const showScrollRef = useRef(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordTimerRef = useRef<any>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const recordCancelRef = useRef(false);
  const isRecordLockedRef = useRef(false);
  const recShouldCancelRef = useRef(false);
  const recordDurationRef = useRef(0);
  const recHandlersRef = useRef<Record<string, any>>({});
  const recCancelProgress = useRef(new Animated.Value(0)).current;
  // Track IDs of messages present at initial load â€” only NEW ones animate
  const knownMsgIds = useRef<Set<string>>(new Set());

  // Animation values
  const scrollFabAnim = useRef(new Animated.Value(0)).current;
  const sendBtnScale = useRef(new Animated.Value(1)).current;

  const hasTxt = input.trim().length > 0;

  const displayName = other?.isHospital
    ? (other?.full_name || 'Hospital')
    : other?.isDoctor
    ? /^dr\.?\s/i.test(other?.full_name || '')
      ? (other?.full_name || '')
      : `${other?.title || 'Dr.'} ${other?.full_name || ''}`
    : (other?.full_name || 'Chat');

  // FAB show/hide spring
  useEffect(() => {
    Animated.spring(scrollFabAnim, {
      toValue: showScrollBtn ? 1 : 0, tension: 80, friction: 8, useNativeDriver: true,
    }).start();
  }, [showScrollBtn]);

  useEffect(() => {
    loadMessages();
    const keyboardSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 80),
    );

    channelRef.current = supabase
      .channel(`conv-${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, payload => {
        const msg = payload.new as Msg;
        setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
        // Auto-scroll only when user is already near bottom
        if (!showScrollRef.current) {
          setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 80);
        }
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
        setMessages(prev => prev.map(m => m.id === updated.id
          ? { ...m, read_at: updated.read_at, content: updated.content, edited_at: updated.edited_at }
          : m));
      })
      .on('broadcast', { event: 'typing' }, ({ payload }: any) => {
        if (payload?.userId !== currentUserId) {
          setOtherTyping(true);
          if (!showScrollRef.current) {
            setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 60);
          }
          if (typingTimeout.current) clearTimeout(typingTimeout.current);
          typingTimeout.current = setTimeout(() => setOtherTyping(false), 2500);
        }
      })
      .subscribe();

    return () => {
      keyboardSub.remove();
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      if (typingThrottle.current) clearTimeout(typingThrottle.current);
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
        recordingRef.current = null;
        Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
      }
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  useEffect(() => { recordDurationRef.current = recordDuration; }, [recordDuration]);

  const loadMessages = async () => {
    const { data } = await supabase
      .from('messages').select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    if (data) {
      data.forEach(m => knownMsgIds.current.add(m.id));
      setMessages(data);
      hasInitialScrolled.current = false; // reset so onContentSizeChange fires
    }
    setLoading(false);
    await supabase.from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .neq('sender_id', currentUserId)
      .is('read_at', null);
  };

  // Throttled typing broadcast â€” max 1 event per 1.5s
  const broadcastTyping = useCallback(() => {
    if (!channelRef.current || typingThrottle.current) return;
    channelRef.current.send({ type: 'broadcast', event: 'typing', payload: { userId: currentUserId } });
    typingThrottle.current = setTimeout(() => { typingThrottle.current = null; }, 1500);
  }, [currentUserId]);

  const animateSend = () => {
    Animated.sequence([
      Animated.timing(sendBtnScale, { toValue: 0.80, duration: 70, useNativeDriver: true }),
      Animated.spring(sendBtnScale, { toValue: 1, tension: 120, friction: 5, useNativeDriver: true }),
    ]).start();
  };

  const sendMessage = async (
    content: string, attachmentUrl?: string, attachmentType?: string,
    attachmentName?: string, attachmentSize?: string,
  ) => {
    if (!content.trim() && !attachmentUrl) return;
    animateSend();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const tempId = `temp-${Date.now()}`;
    const reply = replyTo;
    setReplyTo(null);
    const optimistic: Msg = {
      id: tempId, sender_id: currentUserId, content: content.trim(),
      attachment_url: attachmentUrl, attachment_type: attachmentType as any,
      attachment_name: attachmentName, attachment_size: attachmentSize,
      reply_to_id: reply?.id, reply_to_content: reply?.content,
      reply_to_sender: reply?.sender_id,
      created_at: new Date().toISOString(), _pending: true,
    };
    setMessages(prev => [...prev, optimistic]);
    setInput('');
    setSending(true);
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 50);
    try {
      const { data, error } = await supabase.from('messages').insert({
        conversation_id: conversationId, sender_id: currentUserId,
        content: content.trim(), attachment_url: attachmentUrl || null,
        attachment_type: attachmentType || null, attachment_name: attachmentName || null,
        attachment_size: attachmentSize || null,
        reply_to_id: reply?.id || null, reply_to_content: reply?.content || null,
        reply_to_sender: reply?.sender_id || null,
      }).select().single();
      if (error) throw error;
      knownMsgIds.current.add(data.id);
      setMessages(prev => {
        // If realtime already appended the real message, just drop the temp
        if (prev.some(m => m.id === data.id)) return prev.filter(m => m.id !== tempId);
        return prev.map(m => m.id === tempId ? { ...data, _pending: false } : m);
      });
      supabase.from('conversations').update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId).then(() => {});
    } catch {
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, _pending: false, _failed: true } : m));
    } finally { setSending(false); }
  };

  const saveEdit = async () => {
    if (!editingMsg || !input.trim()) return;
    const updatedText = input.trim();
    const editedAt = new Date().toISOString();
    setInput('');
    setEditingMsg(null);
    setMessages(prev => prev.map(m =>
      m.id === editingMsg.id ? { ...m, content: updatedText, edited_at: editedAt } : m));
    try {
      await supabase.from('messages')
        .update({ content: updatedText, edited_at: editedAt })
        .eq('id', editingMsg.id);
    } catch {
      setMessages(prev => prev.map(m =>
        m.id === editingMsg.id ? { ...m, content: editingMsg.content, edited_at: editingMsg.edited_at } : m));
    }
  };

  const formatRecDuration = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const startRecording = async () => {
    if (recordingRef.current) return; // guard: already has an active recording
    recordCancelRef.current = false;
    isRecordLockedRef.current = false;
    recShouldCancelRef.current = false;
    setIsRecordLocked(false);
    setIsRecordPaused(false);
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        toast.showWarning('Permission needed', 'Allow microphone access to send voice messages');
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      if (recordCancelRef.current) {
        // Finger released before createAsync resolved — await cleanup so next press doesn't collide
        await recording.stopAndUnloadAsync().catch(() => {});
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
        return;
      }
      recordingRef.current = recording;
      setIsRecording(true);
      setRecordDuration(0);
      recordTimerRef.current = setInterval(() => setRecordDuration(d => d + 1), 1000);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e) { console.error('startRecording failed', e); }
  };

  const stopAndSendRecording = async () => {
    recordCancelRef.current = true;
    if (!recordingRef.current) return;
    clearInterval(recordTimerRef.current);
    recordTimerRef.current = null;
    const dur = recordDurationRef.current;
    isRecordLockedRef.current = false;
    recShouldCancelRef.current = false;
    setIsRecording(false);
    setIsRecordLocked(false);
    setIsRecordPaused(false);
    setRecordDuration(0);
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      if (!uri || dur < 1) {
        toast.showWarning('Too short', 'Hold longer to record a voice message');
        return;
      }
      setUploading(true);
      const filename = `voice_${Date.now()}.m4a`;
      const url = await uploadFile(uri, filename, 'audio/m4a');
      await sendMessage('', url, 'voice', filename, formatRecDuration(dur));
    } catch (e: any) {
      toast.showError('Recording failed', e.message);
      recordingRef.current = null;
    } finally {
      setUploading(false);
      Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
    }
  };

  const cancelRecording = async () => {
    recordCancelRef.current = true;
    clearInterval(recordTimerRef.current);
    recordTimerRef.current = null;
    isRecordLockedRef.current = false;
    recShouldCancelRef.current = false;
    setIsRecording(false);
    setIsRecordLocked(false);
    setIsRecordPaused(false);
    setRecordDuration(0);
    if (recordingRef.current) {
      try { await recordingRef.current.stopAndUnloadAsync(); } catch {}
      recordingRef.current = null;
    }
    Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const lockRecording = () => {
    if (isRecordLockedRef.current) return;
    isRecordLockedRef.current = true;
    setIsRecordLocked(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const pauseRecording = async () => {
    if (!recordingRef.current) return;
    clearInterval(recordTimerRef.current);
    recordTimerRef.current = null;
    try { await recordingRef.current.pauseAsync(); } catch {}
    setIsRecordPaused(true);
  };

  const resumeRecording = async () => {
    if (!recordingRef.current) return;
    try { await recordingRef.current.startAsync(); } catch {}
    recordTimerRef.current = setInterval(() => setRecordDuration(d => d + 1), 1000);
    setIsRecordPaused(false);
  };

  // Keep handler ref current so PanResponder always calls the latest version
  recHandlersRef.current = { startRecording, cancelRecording, lockRecording, stopAndSendRecording };

  const CANCEL_THRESHOLD = 80;
  const LOCK_THRESHOLD   = 50;

  const micPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      recCancelProgress.setValue(0);
      recHandlersRef.current.startRecording();
    },
    onPanResponderMove: (_, { dx, dy }) => {
      if (isRecordLockedRef.current) return;
      const progress = Math.min(Math.max(-dx / CANCEL_THRESHOLD, 0), 1);
      recCancelProgress.setValue(progress);
      if (!recShouldCancelRef.current && dx < -CANCEL_THRESHOLD) {
        recShouldCancelRef.current = true;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else if (recShouldCancelRef.current && dx > -CANCEL_THRESHOLD) {
        recShouldCancelRef.current = false;
      }
      if (dy < -LOCK_THRESHOLD) {
        recHandlersRef.current.lockRecording();
      }
    },
    onPanResponderRelease: () => {
      if (isRecordLockedRef.current) return;
      recCancelProgress.setValue(0);
      if (recShouldCancelRef.current) {
        recHandlersRef.current.cancelRecording();
      } else {
        recHandlersRef.current.stopAndSendRecording();
      }
    },
    onPanResponderTerminate: () => {
      recCancelProgress.setValue(0);
      if (!isRecordLockedRef.current) recHandlersRef.current.cancelRecording();
    },
  })).current;

  const playVoice = async (url: string, msgId: string) => {
    if (soundPlayingId === msgId) {
      await soundRef.current?.stopAsync().catch(() => {});
      await soundRef.current?.unloadAsync().catch(() => {});
      soundRef.current = null;
      setSoundPlayingId(null);
      return;
    }
    if (soundRef.current) {
      await soundRef.current.stopAsync().catch(() => {});
      await soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
    }
    setSoundPlayingId(msgId);
    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync({ uri: url });
      soundRef.current = sound;
      await sound.playAsync();
      sound.setOnPlaybackStatusUpdate(st => {
        if (st.isLoaded && st.didJustFinish) {
          setSoundPlayingId(null);
          soundRef.current = null;
        }
      });
    } catch { setSoundPlayingId(null); }
  };

  const deleteMsg = async (msgId: string) => {
    setActionMsg(null);
    setMessages(prev => prev.filter(m => m.id !== msgId));
    await supabase.from('messages').delete().eq('id', msgId);
  };

  const uploadFile = async (uri: string, name: string, mimeType: string) => {
    const path = `chat/${conversationId}/${Date.now()}-${name}`;
    const { data: session } = await supabase.auth.getSession();
    const token = session?.session?.access_token;
    const supabaseUrl = (supabase as any).supabaseUrl as string;
    const form = new FormData();
    form.append('file', { uri, name, type: mimeType } as any);
    const res = await fetch(`${supabaseUrl}/storage/v1/object/attachments/${path}`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'x-upsert': 'true' }, body: form,
    });
    if (!res.ok) throw new Error(await res.text());
    const { data: { publicUrl } } = supabase.storage.from('attachments').getPublicUrl(path);
    return publicUrl;
  };

  const pickImage = async () => {
    setAttachVisible(false);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { toast.showWarning('Permission needed', 'Allow photo access to send images'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const ext = asset.uri.split('.').pop() || 'jpg';
      setUploading(true);
      try {
        const url = await uploadFile(asset.uri, `image_${Date.now()}.${ext}`, `image/${ext}`);
        await sendMessage('', url, 'image', `image_${Date.now()}.${ext}`);
      } catch (e: any) { toast.showError('Upload failed', e.message); }
      finally { setUploading(false); }
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
      } catch (e: any) { toast.showError('Upload failed', e.message); }
      finally { setUploading(false); }
    }
  };

  const handleScroll = useCallback((event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
    const shouldShow = distFromBottom > 160;
    showScrollRef.current = shouldShow;
    setShowScrollBtn(shouldShow);
  }, []);

  const handleAction = useCallback((msg: Msg) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActionMsg(msg);
  }, []);

  const handleReply = useCallback((msg: Msg) => setReplyTo(msg), []);

  const renderItem = useCallback(({ item, index }: { item: Msg; index: number }) => (
    <MessageBubble
      item={item}
      prev={messages[index - 1]}
      next={messages[index + 1]}
      currentUserId={currentUserId}
      other={other}
      knownMsgIds={knownMsgIds}
      soundPlayingId={soundPlayingId}
      onAction={handleAction}
      onReply={handleReply}
      onPlay={playVoice}
    />
  ), [messages, soundPlayingId, handleAction, handleReply, playVoice]);

  const fabStyle = {
    opacity: scrollFabAnim,
    transform: [{ scale: scrollFabAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="#083236" />
      {/* Teal fill only behind the status bar — outer bg is cream so nothing bleeds below */}
      <View style={{ height: insets.top, backgroundColor: '#083236' }} />

      {/* Teal header — outside KAV so it doesn't jump when keyboard opens */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#ffffff" />
        </TouchableOpacity>
        <View style={s.headerAvatarWrap}>
          {other?.avatar_url
            ? <Image source={{ uri: other.avatar_url }} style={s.headerAvatar} />
            : <View style={[s.headerAvatar, s.headerAvatarFallback]}>
                {other?.isHospital
                  ? <Ionicons name="business-outline" size={18} color={C.teal} />
                  : other?.isDoctor
                  ? <MaterialCommunityIcons name="stethoscope" size={18} color={C.teal} />
                  : <Ionicons name="person" size={18} color={C.teal} />}
              </View>}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.headerName} numberOfLines={1}>{displayName}</Text>
          <Text style={s.headerSub}>
            {otherTyping
              ? 'typing...'
              : other?.isHospital
              ? 'Hospital Channel'
              : other?.isHospitalConv
              ? 'Practitioner'
              : other?.isDoctor
              ? 'Medical Professional'
              : 'Patient'}
          </Text>
        </View>
        <TouchableOpacity
          style={s.headerAction}
          onPress={() => { setShowMsgSearch(v => !v); setMsgSearch(''); }}
        >
          <Ionicons name={showMsgSearch ? 'close' : 'search-outline'} size={20} color="rgba(255,255,255,0.85)" />
        </TouchableOpacity>
        {!showMsgSearch && other?.isDoctor && !other?.isHospital && !other?.isHospitalConv && (
          <TouchableOpacity
            style={s.headerAction}
            onPress={() => navigation.navigate('BookConsultation', { doctor: other })}
          >
            <Ionicons name="calendar-outline" size={20} color="rgba(255,255,255,0.85)" />
          </TouchableOpacity>
        )}
      </View>

      {/* behavior="height": KAV shrinks its own height when keyboard shows — no internal padding gap,
          so the teal background never leaks below contentCard during keyboard dismiss animation. */}
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: '#083236' }}
        behavior="height"
      >
      <View style={s.contentCard}>
        <View style={{ flex: 1 }}>
          {/* Message search bar */}
          {showMsgSearch && (
            <View style={s.msgSearchBar}>
              <Ionicons name="search-outline" size={16} color={C.muted} />
              <TextInput
                style={s.msgSearchInput}
                placeholder="Search messages..."
                placeholderTextColor={C.muted}
                value={msgSearch}
                onChangeText={setMsgSearch}
                autoFocus
              />
              {!!msgSearch && (
                <TouchableOpacity onPress={() => setMsgSearch('')}>
                  <Ionicons name="close-circle" size={16} color={C.muted} />
                </TouchableOpacity>
              )}
            </View>
          )}
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
              data={msgSearch ? messages.filter(m => m.content?.toLowerCase().includes(msgSearch.toLowerCase())) : messages}
              keyExtractor={i => i.id}
              renderItem={renderItem}
              contentContainerStyle={s.list}
              onContentSizeChange={() => {
                if (!hasInitialScrolled.current && !msgSearch) {
                  flatRef.current?.scrollToEnd({ animated: false });
                  hasInitialScrolled.current = true;
                }
              }}
              showsVerticalScrollIndicator={false}
              scrollEventThrottle={32}
              onScroll={handleScroll}
              ListFooterComponent={otherTyping ? (
                <View style={[s.msgRow, s.msgRowThem, { marginTop: 2, marginBottom: 10 }]}>
                  <View style={s.msgAvatar}>
                    <View style={[s.msgAvatarImg, s.msgAvatarFallback]}>
                      {other?.isDoctor
                        ? <MaterialCommunityIcons name="stethoscope" size={12} color={C.teal} />
                        : <Ionicons name="person" size={12} color={C.teal} />}
                    </View>
                  </View>
                  <View style={[s.bubble, s.bubbleThem, { borderBottomLeftRadius: 4 }]}>
                    <TypingIndicator />
                  </View>
                </View>
              ) : <View style={{ height: 8 }} />}
            />
          )}

          {/* Upload progress */}
          {uploading && (
            <View style={s.uploadingBar}>
              <ActivityIndicator size="small" color={C.teal} />
              <Text style={s.uploadingText}>Uploading...</Text>
            </View>
          )}

          {/* Edit mode banner */}
          {editingMsg && (
            <View style={s.editBanner}>
              <View style={s.editBannerBar} />
              <View style={{ flex: 1 }}>
                <Text style={s.editBannerLabel}>Editing message</Text>
                <Text style={s.editBannerPreview} numberOfLines={1}>{editingMsg.content}</Text>
              </View>
              <TouchableOpacity onPress={() => { setEditingMsg(null); setInput(''); }}>
                <Ionicons name="close" size={20} color={C.muted} />
              </TouchableOpacity>
            </View>
          )}

          {/* Reply banner */}
          {replyTo && (
            <View style={s.replyBanner}>
              <View style={s.replyBannerBar} />
              <View style={{ flex: 1 }}>
                <Text style={s.replyBannerLabel}>
                  Replying to {replyTo.sender_id === currentUserId ? 'yourself' : (other?.full_name?.split(' ')[0] || 'message')}
                </Text>
                <Text style={s.replyBannerPreview} numberOfLines={1}>
                  {replyTo.content || 'Attachment'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setReplyTo(null)}>
                <Ionicons name="close" size={20} color={C.muted} />
              </TouchableOpacity>
            </View>
          )}

          {/* ── Unified input bar ────────────────────────────────────────────
               One bar, three states. The mic button stays mounted across
               normal↔hold so the pan gesture is never interrupted by a re-render. */}
          <View style={[s.inputBar, { paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 20 : 12) }]}>

            {/* Left slot */}
            {isRecordLocked ? (
              <TouchableOpacity style={[s.attachBtn, s.recDeleteBtn]} onPress={cancelRecording}>
                <Ionicons name="trash-outline" size={20} color="#EF4444" />
              </TouchableOpacity>
            ) : !isRecording && !editingMsg ? (
              <TouchableOpacity style={s.attachBtn} onPress={() => setAttachVisible(true)}>
                <Ionicons name="add" size={22} color={C.teal} />
              </TouchableOpacity>
            ) : null}

            {/* Center slot */}
            {isRecordLocked ? (
              <View style={[s.inputWrap, { justifyContent: 'center' }]}>
                <View style={s.recordingRow}>
                  {isRecordPaused
                    ? <Ionicons name="pause-circle" size={14} color={C.muted} />
                    : <View style={s.recDot} />}
                  <Text style={s.recTimer}>{formatRecDuration(recordDuration)}</Text>
                  <Text style={s.recHint}>{isRecordPaused ? ' · Paused' : ' · Locked'}</Text>
                </View>
              </View>
            ) : isRecording ? (
              <Animated.View style={[s.inputWrap, {
                justifyContent: 'center',
                borderColor: recCancelProgress.interpolate({ inputRange: [0, 1], outputRange: [C.border, '#EF4444'] }),
              }]}>
                <View style={s.recordingRow}>
                  <View style={s.recDot} />
                  <Text style={s.recTimer}>{formatRecDuration(recordDuration)}</Text>
                  <Animated.Text style={[s.recHint, {
                    color: recCancelProgress.interpolate({ inputRange: [0, 1], outputRange: [C.muted, '#EF4444'] }),
                  }]}>{'  ← Cancel  ·  ↑ Lock'}</Animated.Text>
                </View>
              </Animated.View>
            ) : (
              <View style={s.inputWrap}>
                <TextInput
                  style={s.input}
                  value={input}
                  onChangeText={(t) => { setInput(t); if (!editingMsg) broadcastTyping(); }}
                  placeholder={editingMsg ? 'Edit message...' : 'Message...'}
                  placeholderTextColor={C.muted}
                  multiline
                  maxLength={2000}
                  autoFocus={!!editingMsg}
                />
              </View>
            )}

            {/* Right slot */}
            {isRecordLocked ? (
              <>
                <TouchableOpacity style={s.attachBtn} onPress={isRecordPaused ? resumeRecording : pauseRecording}>
                  <Ionicons name={isRecordPaused ? 'play' : 'pause'} size={20} color={C.teal} />
                </TouchableOpacity>
                <TouchableOpacity style={[s.sendBtn, { backgroundColor: '#16A34A' }]} onPress={stopAndSendRecording}>
                  <Ionicons name="checkmark" size={22} color="#fff" />
                </TouchableOpacity>
              </>
            ) : hasTxt || editingMsg ? (
              <Animated.View style={{ transform: [{ scale: sendBtnScale }] }}>
                <TouchableOpacity
                  style={s.sendBtn}
                  onPress={editingMsg ? saveEdit : () => sendMessage(input)}
                  disabled={sending || uploading}
                  activeOpacity={0.8}
                >
                  {sending
                    ? <ActivityIndicator size="small" color="#fff" />
                    : editingMsg
                    ? <Ionicons name="checkmark" size={20} color="#fff" />
                    : <Ionicons name="send" size={17} color="#fff" style={{ marginLeft: 2 }} />}
                </TouchableOpacity>
              </Animated.View>
            ) : (
              /* Mic button — stays mounted across normal↔hold so the pan gesture
                 is never dropped by a re-render changing the component tree */
              <View
                {...micPan.panHandlers}
                style={[s.sendBtn, isRecording && s.sendBtnRec, isRecording && s.recMicBtn]}
              >
                <Ionicons name="mic" size={isRecording ? 24 : 20} color="#fff" />
              </View>
            )}
          </View>
        </View>{/* end inner flex:1 */}

        {/* Scroll-to-bottom FAB */}
        <Animated.View
          style={[s.scrollFab, fabStyle]}
          pointerEvents={showScrollBtn ? 'auto' : 'none'}
        >
          <TouchableOpacity
            style={s.scrollFabBtn}
            onPress={() => {
              flatRef.current?.scrollToEnd({ animated: true });
              setShowScrollBtn(false);
            }}
          >
            <Ionicons name="chevron-down" size={22} color="#fff" />
          </TouchableOpacity>
        </Animated.View>
      </View>{/* end contentCard */}
      </KeyboardAvoidingView>

      {/* Message action sheet — outside KAV so it overlays full screen */}
      <Modal visible={!!actionMsg} transparent animationType="slide">
        <Pressable style={s.sheetOverlay} onPress={() => setActionMsg(null)}>
          <Pressable style={s.sheet}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>Message</Text>
            {!!actionMsg?.content && (
              <View style={s.actionPreviewBox}>
                <Text style={s.actionPreview} numberOfLines={3}>{actionMsg.content}</Text>
              </View>
            )}
            {/* Reply â€” available for all messages */}
            <TouchableOpacity style={s.sheetRow} onPress={() => {
              setReplyTo(actionMsg);
              setActionMsg(null);
            }}>
              <View style={[s.sheetIcon, { backgroundColor: '#EEF2FF' }]}>
                <Ionicons name="return-down-back-outline" size={22} color="#6366F1" />
              </View>
              <View>
                <Text style={s.sheetLabel}>Reply</Text>
                <Text style={s.sheetSub}>Reply to this message</Text>
              </View>
            </TouchableOpacity>
            {/* Edit + Delete â€” only for own messages */}
            {actionMsg?.sender_id === currentUserId && (
              <>
                <View style={s.sheetDivider} />
                <TouchableOpacity style={s.sheetRow} onPress={() => {
                  setInput(actionMsg?.content || '');
                  setEditingMsg(actionMsg);
                  setActionMsg(null);
                }}>
                  <View style={[s.sheetIcon, { backgroundColor: C.greenLight }]}>
                    <Ionicons name="create-outline" size={22} color={C.teal} />
                  </View>
                  <View>
                    <Text style={s.sheetLabel}>Edit</Text>
                    <Text style={s.sheetSub}>Change the message text</Text>
                  </View>
                </TouchableOpacity>
                <View style={s.sheetDivider} />
                <TouchableOpacity style={s.sheetRow} onPress={() => actionMsg && deleteMsg(actionMsg.id)}>
                  <View style={[s.sheetIcon, { backgroundColor: '#fee2e2' }]}>
                    <Ionicons name="trash-outline" size={22} color="#EF4444" />
                  </View>
                  <View>
                    <Text style={[s.sheetLabel, { color: '#EF4444' }]}>Delete</Text>
                    <Text style={s.sheetSub}>Remove this message</Text>
                  </View>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity style={[s.sheetRow, { justifyContent: 'center', marginTop: 4 }]} onPress={() => setActionMsg(null)}>
              <Text style={{ color: C.muted, fontSize: 15, fontWeight: '500' }}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Attachment bottom sheet */}
      <Modal visible={attachVisible} transparent animationType="slide">
        <Pressable style={s.sheetOverlay} onPress={() => setAttachVisible(false)}>
          <Pressable style={s.sheet}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>Send Attachment</Text>
            <TouchableOpacity style={s.sheetRow} onPress={pickImage}>
              <View style={[s.sheetIcon, { backgroundColor: C.greenLight }]}>
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
            <TouchableOpacity
              style={[s.sheetRow, { justifyContent: 'center', marginTop: 4 }]}
              onPress={() => setAttachVisible(false)}
            >
              <Text style={{ color: C.muted, fontSize: 15, fontWeight: '500' }}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  contentCard: { flex: 1, backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 17, fontFamily: 'Montserrat_700Bold', color: C.text },
  emptySub: { fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 26, backgroundColor: '#083236' },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  headerAvatarWrap: { position: 'relative' },
  headerAvatar: { width: 42, height: 42, borderRadius: 21 },
  headerAvatarFallback: { backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  onlineDot: { position: 'absolute', bottom: 1, right: 1, width: 10, height: 10, borderRadius: 5, backgroundColor: '#4ADE80', borderWidth: 2, borderColor: '#083236' },
  headerName: { fontSize: 15, fontFamily: 'Montserrat_700Bold', color: '#ffffff' },
  headerSub: { fontSize: 11, fontFamily: 'SpaceGrotesk_400Regular', color: 'rgba(255,255,255,0.70)', marginTop: 1 },
  headerAction: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },

  // Messages
  list: { paddingLeft: 8, paddingRight: 0, paddingTop: 16, paddingBottom: 8 },
  dayWrap: { flexDirection: 'row', alignItems: 'center', marginVertical: 14, gap: 8 },
  dayLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: C.border },
  dayText: { fontSize: 11, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted, paddingHorizontal: 4 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 4, gap: 6, paddingRight: 6 },
  msgRowMe: { justifyContent: 'flex-end', paddingRight: 6 },
  msgRowThem: { justifyContent: 'flex-start', paddingRight: 10 },
  msgAvatar: { width: 28 },
  msgAvatarImg: { width: 28, height: 28, borderRadius: 14 },
  msgAvatarFallback: { backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center' },

  // Bubbles
  bubbleTouch: { maxWidth: '82%' },
  bubble: { minWidth: 80, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 8, borderRadius: 20 },
  bubbleMe: { backgroundColor: '#0C6570', overflow: 'hidden' },
  bubbleThem: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border },

  // Attachments
  attachImg: { width: 220, height: 170, borderRadius: 12, marginBottom: 4 },
  fileCard: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4, paddingHorizontal: 2 },
  fileIconBox: { width: 38, height: 38, borderRadius: 10, backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center' },
  fileName: { fontSize: 13, fontFamily: 'Montserrat_600SemiBold', color: C.text },
  fileSize: { fontSize: 11, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted, marginTop: 1 },

  // Text + meta
  msgText: { fontSize: 15, fontFamily: 'SpaceGrotesk_400Regular', color: C.text, lineHeight: 22 },
  msgTextMe: { color: '#fff' },
  msgMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 2, paddingBottom: 2, gap: 3 },
  msgTime: { fontSize: 10.5, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted },
  msgTimeMe: { color: 'rgba(255,255,255,0.6)' },

  // Message search bar
  msgSearchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: C.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  msgSearchInput: { flex: 1, fontSize: 14, fontFamily: 'SpaceGrotesk_400Regular', color: C.text, paddingVertical: 0 },

  // Upload bar
  uploadingBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 8, backgroundColor: C.greenLight },
  uploadingText: { fontSize: 13, fontFamily: 'SpaceGrotesk_500Medium', color: C.teal },

  // Input bar — paddingBottom set dynamically via insets in JSX
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border, backgroundColor: C.bg },
  attachBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },
  inputWrap: { flex: 1, backgroundColor: C.card, borderRadius: 22, paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 10 : 6, minHeight: 44, justifyContent: 'center', borderWidth: 1, borderColor: C.border },
  input: { fontSize: 15, fontFamily: 'SpaceGrotesk_400Regular', color: C.text, maxHeight: 120, paddingVertical: 0 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center' },
  sendBtnOff: { backgroundColor: '#C4BDB4' },
  sendBtnRec: { backgroundColor: '#EF4444' },
  recDeleteBtn: { borderColor: 'rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.07)' },
  recMicBtn: { width: 54, height: 54, borderRadius: 27 },

  // Voice message bubble
  voiceCard: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4, minWidth: 170 },
  voiceWave: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2, height: 20 },
  voiceBar: { width: 2.5, borderRadius: 2 },
  voiceDur: { fontSize: 11, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted, minWidth: 32, textAlign: 'right' },

  // Edited label
  editedLabel: { fontStyle: 'italic', marginLeft: 2 },

  // Recording indicator
  recordingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' },
  recTimer: { fontSize: 14, fontFamily: 'Montserrat_600SemiBold', color: C.text },
  recHint: { fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted },

  // Edit mode banner
  editBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: C.greenLight, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  editBannerBar: { width: 3, height: 34, borderRadius: 2, backgroundColor: C.teal },
  editBannerLabel: { fontSize: 11, fontFamily: 'Montserrat_700Bold', color: C.teal, letterSpacing: 0.3 },
  editBannerPreview: { fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted, marginTop: 1 },

  // Action sheet preview
  actionPreviewBox: { marginHorizontal: 20, marginBottom: 8, backgroundColor: C.surface, borderRadius: 10, padding: 12, borderLeftWidth: 3, borderLeftColor: C.teal },
  actionPreview: { fontSize: 14, fontFamily: 'SpaceGrotesk_400Regular', color: C.text, lineHeight: 20 },

  // Scroll-to-bottom FAB
  scrollFab: { position: 'absolute', right: 16, bottom: 78, zIndex: 99 },
  scrollFabBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: C.teal,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#0C2E30', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 6,
  },

  // Attachment sheet
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 34, paddingTop: 12 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 16, fontFamily: 'Montserrat_700Bold', color: C.text, paddingHorizontal: 20, marginBottom: 8 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 14 },
  sheetIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  sheetLabel: { fontSize: 15, fontFamily: 'Montserrat_600SemiBold', color: C.text },
  sheetSub: { fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted, marginTop: 1 },
  sheetDivider: { height: StyleSheet.hairlineWidth, backgroundColor: C.border, marginHorizontal: 20 },

  // Swipe-to-reply arrow circle
  replyArrowCircle: { width: 30, height: 30, borderRadius: 15, backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center' },

  // Reply quote inside bubble
  replyQuote: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 8, overflow: 'hidden', marginBottom: 6, maxWidth: '100%' },
  replyQuoteMe: { backgroundColor: 'rgba(255,255,255,0.18)' },
  replyQuoteBar: { width: 3, backgroundColor: C.teal },
  replyQuoteFrom: { fontSize: 11, fontFamily: 'Montserrat_700Bold', color: C.teal, paddingHorizontal: 8, paddingTop: 6 },
  replyQuoteText: { fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted, paddingHorizontal: 8, paddingBottom: 6, paddingTop: 1 },

  // Reply banner above input
  replyBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: C.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  replyBannerBar: { width: 3, height: 34, borderRadius: 2, backgroundColor: '#6366F1' },
  replyBannerLabel: { fontSize: 11, fontFamily: 'Montserrat_700Bold', color: '#6366F1', letterSpacing: 0.3 },
  replyBannerPreview: { fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted, marginTop: 1 },
});

import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, StatusBar, TouchableOpacity, Image,
  ScrollView, TextInput, KeyboardAvoidingView, Platform, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const C = {
  paper: '#F5F3EE', card: '#FFFFFF', cardBorder: '#EAE5DA',
  ink: '#0C2E30', teal: '#0B7E8A', tealHero1: '#0C6570', tealHero2: '#083236',
  gold: '#D4A843', muted: '#7A8785', muted2: '#97A2A0', textPrimary: '#16211F',
};

export type AIChatMsg = { id: string; role: 'ai' | 'user'; text: string };

export const INITIAL_AI_MESSAGES: AIChatMsg[] = [
  {
    id: '1',
    role: 'ai',
    text: "Hi! I'm your Hbridge AI Health Assistant.\n\nI'm currently being trained on the latest medical knowledge and will be available very soon.",
  },
];

const FEATURES = [
  { icon: 'pulse-outline',   label: 'Symptom Checker' },
  { icon: 'flask-outline',   label: 'Lab Insights' },
  { icon: 'medical-outline', label: 'Drug Info' },
  { icon: 'heart-outline',   label: 'Health Tips' },
];

const SUGGESTIONS = [
  'What are signs of high BP?',
  'How to read my lab results?',
  'Common drug interactions',
  'Tips for better sleep',
];

type Props = {
  navigation: any;
  initialMessages?: AIChatMsg[];
  onMessagesUpdate?: (msgs: AIChatMsg[]) => void;
};

export default function AIChatScreen({ navigation, initialMessages, onMessagesUpdate }: Props) {
  const [messages, setMessages] = useState<AIChatMsg[]>(initialMessages || INITIAL_AI_MESSAGES);
  const [inputText, setInputText] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();

  const updateMessages = (updater: AIChatMsg[] | ((prev: AIChatMsg[]) => AIChatMsg[])) => {
    setMessages(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      onMessagesUpdate?.(next);
      return next;
    });
  };

  const handleSend = () => {
    const text = inputText.trim();
    if (!text) return;
    const userMsg: AIChatMsg = { id: Date.now().toString(), role: 'user', text };
    updateMessages(prev => [...prev, userMsg]);
    setInputText('');
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    setTimeout(() => {
      const aiReply: AIChatMsg = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        text: "Thank you for your question! The AI assistant is being finalized and will be available very soon. You'll be able to get detailed answers on symptoms, medications, lab results, and more.",
      };
      updateMessages(prev => [...prev, aiReply]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }, 600);
  };

  const handleSuggestion = (q: string) => {
    setInputText(q);
  };

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#083236" />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Image source={require('../../assets/hbridge3.png')} style={s.headerLogo} resizeMode="cover" />
          <View>
            <Text style={s.headerTitle}>AI Health Assistant</Text>
            <View style={s.headerPill}>
              <View style={s.pillDot} />
              <Text style={s.headerSub}>Coming soon</Text>
            </View>
          </View>
        </View>
        <View style={s.headerSpark}>
          <MaterialCommunityIcons name="creation" size={20} color={C.gold} />
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* Messages */}
        <ScrollView
          ref={scrollRef}
          style={s.messages}
          contentContainerStyle={s.messagesContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          {messages.map((msg, i) => (
            msg.role === 'ai' ? (
              <View key={msg.id} style={s.aiBubbleRow}>
                <View style={s.aiAvatar}>
                  <Image source={require('../../assets/hbridge3.png')} style={{ width: 28, height: 28, borderRadius: 14 }} resizeMode="cover" />
                </View>
                <View style={s.aiBubble}>
                  <Text style={s.aiBubbleText}>{msg.text}</Text>
                  {i === 0 && (
                    <View style={s.featureCard}>
                      <View style={s.featureCardHeader}>
                        <View style={s.sparkBox}>
                          <MaterialCommunityIcons name="creation" size={15} color={C.gold} />
                        </View>
                        <Text style={s.featureCardTitle}>Coming Soon</Text>
                      </View>
                      <View style={s.featureGrid}>
                        {FEATURES.map((f, fi) => (
                          <View key={fi} style={s.featureItem}>
                            <View style={s.featureIconBox}>
                              <Ionicons name={f.icon as any} size={14} color={C.teal} />
                            </View>
                            <Text style={s.featureLabel}>{f.label}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              </View>
            ) : (
              <View key={msg.id} style={s.userBubbleRow}>
                <View style={s.userBubble}>
                  <Text style={s.userBubbleText}>{msg.text}</Text>
                </View>
              </View>
            )
          ))}

          {/* Suggestion chips (only when no user messages sent) */}
          {messages.length === 1 && (
            <View style={s.suggestWrap}>
              <Text style={s.suggestLabel}>Try asking:</Text>
              {SUGGESTIONS.map((q, i) => (
                <Pressable
                  key={i}
                  style={({ pressed }) => [s.suggestChip, pressed && s.suggestChipPressed]}
                  onPress={() => handleSuggestion(q)}
                >
                  {({ pressed }) => (
                    <>
                      <Text style={[s.suggestChipText, pressed && { color: C.teal }]}>{q}</Text>
                      <Ionicons name="arrow-forward" size={13} color={C.teal} />
                    </>
                  )}
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>

        {/* Input bar */}
        <View style={[s.inputBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={s.inputWrap}>
            <TextInput
              style={s.input}
              placeholder="Ask me anything about your health..."
              placeholderTextColor={C.muted2}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
              onSubmitEditing={handleSend}
              returnKeyType="send"
            />
          </View>
          <Pressable
            style={({ pressed }) => [s.sendBtn, !inputText.trim() && s.sendBtnDisabled, pressed && inputText.trim() && s.sendBtnPressed]}
            onPress={handleSend}
          >
            <Ionicons name="send" size={17} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 16, backgroundColor: '#083236' },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 11 },
  headerLogo: { width: 36, height: 36, borderRadius: 18 },
  headerTitle: { fontSize: 15, fontFamily: 'Montserrat_700Bold', color: '#fff' },
  headerPill: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  pillDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.gold },
  headerSub: { fontSize: 11, fontFamily: 'SpaceGrotesk_400Regular', color: 'rgba(255,255,255,0.70)' },
  headerSpark: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },

  // Messages
  messages: { flex: 1 },
  messagesContent: { padding: 16, gap: 14, paddingBottom: 8 },

  // AI bubble
  aiBubbleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, maxWidth: '90%' },
  aiAvatar: { width: 34, height: 34, borderRadius: 17, overflow: 'hidden', flexShrink: 0, marginTop: 2 },
  aiBubble: { flex: 1, backgroundColor: C.card, borderRadius: 18, borderBottomLeftRadius: 5, borderWidth: 1, borderColor: C.cardBorder, padding: 14, gap: 12, shadowColor: C.ink, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  aiBubbleText: { fontSize: 13.5, fontFamily: 'SpaceGrotesk_400Regular', color: C.textPrimary, lineHeight: 21 },

  // Feature card inside first AI bubble
  featureCard: { backgroundColor: C.paper, borderRadius: 14, padding: 12, gap: 10, borderWidth: 1, borderColor: C.cardBorder },
  featureCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  sparkBox: { width: 26, height: 26, borderRadius: 8, backgroundColor: 'rgba(212,168,67,0.15)', alignItems: 'center', justifyContent: 'center' },
  featureCardTitle: { fontSize: 13, fontFamily: 'Montserrat_700Bold', color: C.textPrimary },
  featureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  featureItem: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.card, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 6, borderWidth: 1, borderColor: C.cardBorder },
  featureIconBox: { width: 22, height: 22, borderRadius: 6, backgroundColor: 'rgba(11,126,138,0.10)', alignItems: 'center', justifyContent: 'center' },
  featureLabel: { fontSize: 11, fontFamily: 'Montserrat_500Medium', color: C.textPrimary },

  // User bubble
  userBubbleRow: { alignItems: 'flex-end' },
  userBubble: { maxWidth: '80%', borderRadius: 18, borderBottomRightRadius: 5, padding: 13, backgroundColor: C.tealHero2 },
  userBubbleText: { fontSize: 13.5, fontFamily: 'SpaceGrotesk_400Regular', color: '#fff', lineHeight: 21 },

  // Suggestions
  suggestWrap: { gap: 8, marginTop: 4 },
  suggestLabel: { fontSize: 11, fontFamily: 'Montserrat_600SemiBold', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 },
  suggestChip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.cardBorder, paddingHorizontal: 14, paddingVertical: 11 },
  suggestChipPressed: { backgroundColor: 'rgba(11,126,138,0.08)', borderColor: C.teal },
  suggestChipText: { fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: C.textPrimary, flex: 1, marginRight: 8 },

  // Input bar
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 16, paddingTop: 12, backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.cardBorder },
  inputWrap: { flex: 1, backgroundColor: C.paper, borderRadius: 14, borderWidth: 1, borderColor: C.cardBorder, paddingHorizontal: 14, paddingVertical: 10, maxHeight: 120 },
  input: { fontSize: 14, fontFamily: 'SpaceGrotesk_400Regular', color: C.textPrimary, paddingVertical: 0 },
  sendBtn: { width: 42, height: 42, borderRadius: 14, backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center', marginBottom: 0 },
  sendBtnDisabled: { backgroundColor: C.cardBorder },
  sendBtnPressed: { backgroundColor: C.tealHero2 },
});

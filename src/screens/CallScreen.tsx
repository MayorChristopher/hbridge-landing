// True in-app calling — replaces the old "open Jitsi in a browser tab"
// experience with a native WebRTC call screen, matching the WhatsApp/
// Telegram-style feel requested in the practitioner meeting. Signaling
// (exchanging the WebRTC offer/answer/ICE candidates between the two
// participants) rides on a Supabase Realtime channel scoped to the
// consultation — no separate signaling server needed, since Realtime
// already does exactly that job.
//
// First working version, not exhaustively hardened: reconnect-on-network-
// drop and "callee never joins" timeout handling are intentionally simple.
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image, ActivityIndicator, StatusBar, AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  RTCPeerConnection, RTCIceCandidate, RTCSessionDescription, mediaDevices, RTCView,
} from 'react-native-webrtc';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ToastProvider';
import {
  getMyCallRole, setMyRecordingConsent, subscribeToConsent,
  startLocalRecording, stopAndUploadRecording, discardActiveRecording, CallRole,
} from '../utils/callRecording';

const C = {
  bg: '#083236', teal: '#0B7E8A', gold: '#D4A843', red: '#EF4444', muted: 'rgba(255,255,255,0.65)',
};

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

type CallStatus = 'connecting' | 'ringing' | 'connected' | 'ended';

export default function CallScreen({ route, navigation }: any) {
  const { consultationId, isVideo, otherName, otherAvatar } = route.params;
  const toast = useToast();

  const [localStream, setLocalStream] = useState<any>(null);
  const [remoteStream, setRemoteStream] = useState<any>(null);
  const [status, setStatus] = useState<CallStatus>('connecting');
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const [myRole, setMyRole] = useState<CallRole | null>(null);
  const [showConsentPrompt, setShowConsentPrompt] = useState(false);
  const [myConsent, setMyConsentState] = useState<boolean | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const isRecordingRef = useRef(false);
  const consentUnsubRef = useRef<(() => void) | null>(null);

  const pcRef = useRef<any>(null);
  const channelRef = useRef<any>(null);
  const userIdRef = useRef<string | null>(null);
  const pendingCandidatesRef = useRef<any[]>([]);
  const remoteDescSetRef = useRef(false);
  const offerSentRef = useRef(false);
  const timerRef = useRef<any>(null);
  const endedRef = useRef(false);
  const connectedRef = useRef(false);
  const noAnswerTimeoutRef = useRef<any>(null);

  useEffect(() => {
    let mounted = true;

    const sendSignal = (payload: any) => {
      channelRef.current?.send({ type: 'broadcast', event: 'signal', payload: { ...payload, from: userIdRef.current } });
    };

    const flushPendingCandidates = async (pc: any) => {
      for (const c of pendingCandidatesRef.current) {
        try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
      }
      pendingCandidatesRef.current = [];
    };

    const start = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !mounted) return;
      userIdRef.current = user.id;

      const role = await getMyCallRole(consultationId, user.id);
      if (mounted) {
        setMyRole(role);
        if (role) {
          setShowConsentPrompt(true);
          consentUnsubRef.current = subscribeToConsent(consultationId, (row) => {
            const bothConsented = row.doctor_consent && row.patient_consent;
            if (bothConsented && !isRecordingRef.current) {
              isRecordingRef.current = true;
              startLocalRecording()
                .then(() => { setIsRecording(true); toast.showInfo('Recording Started', 'Both parties consented — your side of the call is being recorded.'); })
                .catch(() => { isRecordingRef.current = false; });
            }
          });
        }
      }

      let stream;
      try {
        stream = await mediaDevices.getUserMedia({ audio: true, video: isVideo ? { facingMode: 'user' } : false });
      } catch {
        toast.showError('Permission Needed', 'Camera/microphone access is required to join the call.');
        navigation.goBack();
        return;
      }
      if (!mounted) { stream.getTracks().forEach((t: any) => t.stop()); return; }
      setLocalStream(stream);

      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;
      stream.getTracks().forEach((track: any) => pc.addTrack(track, stream));

      pc.ontrack = (event: any) => {
        if (event.streams && event.streams[0]) setRemoteStream(event.streams[0]);
      };
      pc.onicecandidate = (event: any) => {
        if (event.candidate) sendSignal({ type: 'ice-candidate', candidate: event.candidate.toJSON() });
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          connectedRef.current = true;
          if (noAnswerTimeoutRef.current) { clearTimeout(noAnswerTimeoutRef.current); noAnswerTimeoutRef.current = null; }
          setStatus('connected');
        }
        if (['disconnected', 'failed', 'closed'].includes(pc.connectionState) && !endedRef.current) {
          endCall(false);
        }
      };

      // No automatic recovery exists for a callee who never joins at all
      // (as opposed to one who connects then drops, handled above) — without
      // this, a call to an offline/unreachable party leaves the caller
      // staring at "Connecting…" forever with only the manual end button.
      noAnswerTimeoutRef.current = setTimeout(() => {
        if (!mounted || endedRef.current || connectedRef.current) return;
        toast.showError('No Answer', `${otherName || 'The other party'} didn't join the call.`);
        endCall(true);
      }, 45000);

      const channel = supabase.channel(`call-${consultationId}`, { config: { presence: { key: user.id } } });
      channelRef.current = channel;

      channel.on('broadcast', { event: 'signal' }, async ({ payload }: any) => {
        if (payload.from === user.id) return;
        try {
          if (payload.type === 'offer') {
            setStatus('ringing');
            await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
            remoteDescSetRef.current = true;
            await flushPendingCandidates(pc);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            sendSignal({ type: 'answer', sdp: answer });
          } else if (payload.type === 'answer') {
            await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
            remoteDescSetRef.current = true;
            await flushPendingCandidates(pc);
          } else if (payload.type === 'ice-candidate') {
            if (remoteDescSetRef.current) {
              try { await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)); } catch {}
            } else {
              pendingCandidatesRef.current.push(payload.candidate);
            }
          } else if (payload.type === 'hangup') {
            endCall(false);
          }
        } catch (e) {
          // A malformed/out-of-order SDP exchange can't be recovered
          // mid-negotiation — end the call cleanly instead of leaving the
          // screen stuck on "Connecting…" with a silently-thrown rejection.
          if (!endedRef.current) {
            toast.showError('Call Failed', 'The connection could not be established.');
            endCall(true);
          }
        }
      });

      channel.on('presence', { event: 'sync' }, async () => {
        const state = channel.presenceState();
        const ids = Object.keys(state);
        if (ids.length === 2 && !offerSentRef.current) {
          // Deterministic offerer so both sides don't race to create one —
          // whoever's user id sorts first makes the offer.
          const amOfferer = [...ids].sort()[0] === user.id;
          if (amOfferer) {
            offerSentRef.current = true;
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            sendSignal({ type: 'offer', sdp: offer });
          }
        }
      });

      channel.subscribe(async (s: string) => {
        if (s === 'SUBSCRIBED') await channel.track({ joinedAt: Date.now() });
      });
    };

    start();

    return () => {
      mounted = false;
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (status === 'connected' && !timerRef.current) {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    }
    return () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
  }, [status]);

  const cleanup = () => {
    if (noAnswerTimeoutRef.current) { clearTimeout(noAnswerTimeoutRef.current); noAnswerTimeoutRef.current = null; }
    localStream?.getTracks().forEach((t: any) => t.stop());
    try { pcRef.current?.close(); } catch {}
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    if (consentUnsubRef.current) { consentUnsubRef.current(); consentUnsubRef.current = null; }
  };

  const endCall = async (notifyOther: boolean) => {
    if (endedRef.current) return;
    endedRef.current = true;
    setStatus('ended');
    if (notifyOther) {
      channelRef.current?.send({ type: 'broadcast', event: 'signal', payload: { type: 'hangup', from: userIdRef.current } });
    }
    if (isRecordingRef.current && myRole) {
      try {
        await stopAndUploadRecording(consultationId, myRole);
      } catch {
        toast.showWarning('Recording Not Saved', 'The call ended but your recording could not be uploaded.');
      }
    } else {
      await discardActiveRecording();
    }
    cleanup();
    navigation.goBack();
  };

  const respondToConsent = async (consent: boolean) => {
    setShowConsentPrompt(false);
    setMyConsentState(consent);
    if (myRole) {
      try { await setMyRecordingConsent(consultationId, myRole, consent); } catch {}
    }
  };

  const toggleMute = () => {
    localStream?.getAudioTracks().forEach((t: any) => { t.enabled = muted; });
    setMuted(m => !m);
  };

  const toggleCamera = () => {
    localStream?.getVideoTracks().forEach((t: any) => { t.enabled = cameraOff; });
    setCameraOff(c => !c);
  };

  const formatElapsed = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const statusText = status === 'connecting' ? 'Connecting…'
    : status === 'ringing' ? 'Connecting…'
    : status === 'connected' ? formatElapsed(elapsed)
    : 'Call ended';

  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {isVideo && remoteStream ? (
        <RTCView streamURL={remoteStream.toURL()} style={s.remoteVideo} objectFit="cover" />
      ) : (
        <View style={s.avatarScreen}>
          {otherAvatar
            ? <Image source={{ uri: otherAvatar }} style={s.bigAvatar} />
            : <View style={[s.bigAvatar, s.bigAvatarFallback]}><Ionicons name="person" size={54} color="rgba(255,255,255,0.6)" /></View>}
        </View>
      )}

      <View style={s.topOverlay}>
        <Text style={s.otherName}>{otherName || 'Consultation'}</Text>
        <Text style={s.statusText}>{statusText}</Text>
        {isRecording && (
          <View style={s.recBadge}>
            <View style={s.recDot} />
            <Text style={s.recText}>Recording</Text>
          </View>
        )}
      </View>

      {showConsentPrompt && (
        <View style={s.consentOverlay}>
          <View style={s.consentCard}>
            <Ionicons name="mic-circle-outline" size={32} color={C.gold} />
            <Text style={s.consentTitle}>Record this consultation?</Text>
            <Text style={s.consentBody}>
              For your documentation. Recording only starts once both you and the other party agree.
            </Text>
            <View style={s.consentActions}>
              <TouchableOpacity style={s.consentNo} onPress={() => respondToConsent(false)}>
                <Text style={s.consentNoText}>No Thanks</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.consentYes} onPress={() => respondToConsent(true)}>
                <Text style={s.consentYesText}>Agree to Record</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {isVideo && localStream && !cameraOff && (
        <View style={s.pipWrap}>
          <RTCView streamURL={localStream.toURL()} style={s.pipVideo} objectFit="cover" mirror />
        </View>
      )}

      {status !== 'connected' && status !== 'ended' && (
        <View style={s.centerLoading}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}

      <View style={s.controls}>
        <TouchableOpacity style={[s.ctrlBtn, muted && s.ctrlBtnActive]} onPress={toggleMute}>
          <Ionicons name={muted ? 'mic-off' : 'mic'} size={22} color="#fff" />
        </TouchableOpacity>
        {isVideo && (
          <TouchableOpacity style={[s.ctrlBtn, cameraOff && s.ctrlBtnActive]} onPress={toggleCamera}>
            <Ionicons name={cameraOff ? 'videocam-off' : 'videocam'} size={22} color="#fff" />
          </TouchableOpacity>
        )}
        <TouchableOpacity style={s.endBtn} onPress={() => endCall(true)}>
          <Ionicons name="call" size={24} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  remoteVideo: { ...StyleSheet.absoluteFillObject },
  avatarScreen: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bigAvatar: { width: 120, height: 120, borderRadius: 60 },
  bigAvatarFallback: { backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },

  topOverlay: { position: 'absolute', top: 20, left: 0, right: 0, alignItems: 'center' },
  otherName: { fontSize: 20, fontFamily: 'Montserrat_700Bold', color: '#fff' },
  statusText: { fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted, marginTop: 4 },
  recBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, backgroundColor: 'rgba(239,68,68,0.18)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  recDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.red },
  recText: { fontSize: 11, fontFamily: 'Montserrat_600SemiBold', color: '#fff' },

  consentOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(8,50,54,0.85)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  consentCard: { alignItems: 'center', gap: 10, width: '100%' },
  consentTitle: { fontSize: 18, fontFamily: 'Montserrat_700Bold', color: '#fff', textAlign: 'center' },
  consentBody: { fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted, textAlign: 'center', lineHeight: 19, paddingHorizontal: 10 },
  consentActions: { flexDirection: 'row', gap: 10, width: '100%', marginTop: 12 },
  consentNo: { flex: 1, height: 48, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  consentNoText: { fontSize: 14, fontFamily: 'Montserrat_600SemiBold', color: '#fff' },
  consentYes: { flex: 1, height: 48, borderRadius: 14, backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center' },
  consentYesText: { fontSize: 14, fontFamily: 'Montserrat_700Bold', color: '#fff' },

  pipWrap: { position: 'absolute', top: 90, right: 16, width: 100, height: 140, borderRadius: 14, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
  pipVideo: { width: '100%', height: '100%' },

  centerLoading: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 100, alignItems: 'center', justifyContent: 'center' },

  controls: { position: 'absolute', bottom: 50, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 20 },
  ctrlBtn: { width: 58, height: 58, borderRadius: 29, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  ctrlBtnActive: { backgroundColor: '#fff2' , borderWidth: 1.5, borderColor: '#fff' },
  endBtn: { width: 58, height: 58, borderRadius: 29, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center' },
});

import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import RtcEngine, { RtcLocalView, RtcRemoteView, VideoRenderMode } from 'react-native-agora';
import { colors } from '../utils/design';

const { width, height } = Dimensions.get('window');

interface VideoCallProps {
  channelName: string;
  token: string;
  uid: number;
  isAudioOnly?: boolean;
  onEndCall: () => void;
}

export default function VideoCall({ channelName, token, uid, isAudioOnly = false, onEndCall }: VideoCallProps) {
  const [engine, setEngine] = useState<RtcEngine | null>(null);
  const [joined, setJoined] = useState(false);
  const [remoteUid, setRemoteUid] = useState<number | null>(null);
  const [muted, setMuted] = useState(false);
  const [videoDisabled, setVideoDisabled] = useState(isAudioOnly);

  useEffect(() => {
    initAgora();
    return () => {
      engine?.destroy();
    };
  }, []);

  const initAgora = async () => {
    const rtcEngine = await RtcEngine.create('dd23c76a7e824c158094b64a5ea873b4');
    
    rtcEngine.addListener('UserJoined', (uid) => {
      setRemoteUid(uid);
    });

    rtcEngine.addListener('UserOffline', () => {
      setRemoteUid(null);
    });

    await rtcEngine.enableVideo();
    await rtcEngine.startPreview();
    await rtcEngine.joinChannel(token, channelName, null, uid);
    
    if (isAudioOnly) {
      await rtcEngine.disableVideo();
    }

    setEngine(rtcEngine);
    setJoined(true);
  };

  const toggleMute = async () => {
    await engine?.muteLocalAudioStream(!muted);
    setMuted(!muted);
  };

  const toggleVideo = async () => {
    if (videoDisabled) {
      await engine?.enableLocalVideo(true);
    } else {
      await engine?.enableLocalVideo(false);
    }
    setVideoDisabled(!videoDisabled);
  };

  const endCall = async () => {
    await engine?.leaveChannel();
    await engine?.destroy();
    onEndCall();
  };

  return (
    <View style={styles.container}>
      {joined && !isAudioOnly && (
        <View style={styles.videoContainer}>
          {remoteUid ? (
            <RtcRemoteView.SurfaceView
              style={styles.remoteVideo}
              uid={remoteUid}
              channelId={channelName}
              renderMode={VideoRenderMode.Hidden}
            />
          ) : (
            <View style={styles.waitingView}>
              <Ionicons name="person" size={64} color={colors.textSecondary} />
              <Text style={styles.waitingText}>Waiting for doctor to join...</Text>
            </View>
          )}

          {!videoDisabled && (
            <RtcLocalView.SurfaceView
              style={styles.localVideo}
              channelId={channelName}
              renderMode={VideoRenderMode.Hidden}
            />
          )}
        </View>
      )}

      {(isAudioOnly || videoDisabled) && (
        <View style={styles.audioOnlyView}>
          <Ionicons name="call" size={64} color={colors.primary} />
          <Text style={styles.audioOnlyText}>Audio Call in Progress</Text>
          {remoteUid ? (
            <Text style={styles.connectedText}>Connected</Text>
          ) : (
            <Text style={styles.waitingText}>Connecting...</Text>
          )}
        </View>
      )}

      <View style={styles.controls}>
        <TouchableOpacity style={styles.controlButton} onPress={toggleMute}>
          <Ionicons name={muted ? 'mic-off' : 'mic'} size={28} color="#fff" />
        </TouchableOpacity>

        {!isAudioOnly && (
          <TouchableOpacity style={styles.controlButton} onPress={toggleVideo}>
            <Ionicons name={videoDisabled ? 'videocam-off' : 'videocam'} size={28} color="#fff" />
          </TouchableOpacity>
        )}

        <TouchableOpacity style={[styles.controlButton, styles.endCallButton]} onPress={endCall}>
          <Ionicons name="call" size={28} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  videoContainer: {
    flex: 1,
  },
  remoteVideo: {
    width: width,
    height: height,
  },
  localVideo: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 120,
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  waitingView: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  waitingText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 16,
  },
  audioOnlyView: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  audioOnlyText: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 24,
  },
  connectedText: {
    fontSize: 14,
    color: colors.primary,
    marginTop: 8,
  },
  controls: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
  controlButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  endCallButton: {
    backgroundColor: colors.error,
  },
});

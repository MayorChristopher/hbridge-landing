import React, { Component, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { sanitizeForLog } from '../utils/security';

const C = {
  bg: '#083236',
  card: '#0C3D42',
  teal: '#0B7E8A',
  tealLight: 'rgba(11,126,138,0.18)',
  white: '#FFFFFF',
  offWhite: 'rgba(255,255,255,0.72)',
  muted: 'rgba(255,255,255,0.45)',
};

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('ErrorBoundary caught an error:', sanitizeForLog(error.message));
    console.error('Error info:', sanitizeForLog(errorInfo.componentStack));
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View style={s.container}>
          <StatusBar barStyle="light-content" backgroundColor={C.bg} />
          <View style={s.iconRing}>
            <Ionicons name="alert-circle-outline" size={40} color={C.teal} />
          </View>
          <Text style={s.title}>Something went wrong</Text>
          <Text style={s.message}>
            An unexpected error occurred. Please try again — your data is safe.
          </Text>
          <TouchableOpacity style={s.btn} onPress={this.handleRetry} activeOpacity={0.82}>
            <Ionicons name="refresh" size={18} color={C.white} />
            <Text style={s.btnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  iconRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: C.tealLight,
    borderWidth: 1.5,
    borderColor: 'rgba(11,126,138,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: C.white,
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: 0.2,
  },
  message: {
    fontSize: 14,
    color: C.offWhite,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    maxWidth: 280,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.teal,
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: 14,
    gap: 8,
  },
  btnText: {
    fontSize: 15,
    fontWeight: '700',
    color: C.white,
    letterSpacing: 0.2,
  },
});

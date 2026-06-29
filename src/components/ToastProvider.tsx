import React, { createContext, useContext, useState, useCallback } from 'react';
import { StyleSheet, Text, View, Animated, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ToastContextType {
  showSuccess: (title: string, message?: string) => void;
  showError:   (title: string, message?: string) => void;
  showWarning: (title: string, message?: string) => void;
  showInfo:    (title: string, message?: string) => void;
  showModal:   (title: string, message: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible]           = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [type, setType]                 = useState<'success' | 'error' | 'warning' | 'info'>('info');
  const [title, setTitle]               = useState('');
  const [message, setMessage]           = useState('');
  const [modalTitle, setModalTitle]     = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [slideAnim]                     = useState(new Animated.Value(-100));
  const [opacity]                       = useState(new Animated.Value(0));

  const show = useCallback((toastType: typeof type, toastTitle: string, toastMessage?: string) => {
    setType(toastType);
    setTitle(toastTitle);
    setMessage(toastMessage || '');
    setVisible(true);
    slideAnim.setValue(-100);
    opacity.setValue(0);

    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0,   duration: 300, useNativeDriver: true }),
      Animated.timing(opacity,   { toValue: 1,   duration: 300, useNativeDriver: true }),
    ]).start(() => {
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(slideAnim, { toValue: -100, duration: 250, useNativeDriver: true }),
          Animated.timing(opacity,   { toValue: 0,    duration: 250, useNativeDriver: true }),
        ]).start(() => setVisible(false));
      }, 3000);
    });
  }, [slideAnim, opacity]);

  const showModal = useCallback((t: string, m: string) => {
    setModalTitle(t);
    setModalMessage(m);
    setModalVisible(true);
  }, []);

  const contextValue = {
    showSuccess: (t: string, m?: string) => show('success', t, m),
    showError:   (t: string, m?: string) => show('error',   t, m),
    showWarning: (t: string, m?: string) => show('warning', t, m),
    showInfo:    (t: string, m?: string) => show('info',    t, m),
    showModal,
  };

  const getConfig = () => {
    switch (type) {
      case 'success': return { icon: 'checkmark-circle',   color: '#0B7E8A', bg: '#E6F5F5', border: '#0B7E8A40' };
      case 'error':   return { icon: 'close-circle',       color: '#FF3B30', bg: '#fff5f5', border: '#FF3B3040' };
      case 'warning': return { icon: 'warning',            color: '#D4A843', bg: '#fdf8ee', border: '#D4A84340' };
      case 'info':    return { icon: 'information-circle', color: '#0B7E8A', bg: '#E6F5F5', border: '#0B7E8A40' };
    }
  };

  const config = getConfig();

  return (
    <ToastContext.Provider value={contextValue}>
      {children}

      {visible && (
        <Animated.View style={[
          styles.toastContainer,
          { backgroundColor: config.bg, borderColor: config.border, transform: [{ translateY: slideAnim }], opacity }
        ]}>
          <View style={styles.toastContent}>
            <View style={[styles.iconContainer, { backgroundColor: config.color + '20' }]}>
              <Ionicons name={config.icon as any} size={20} color={config.color} />
            </View>
            <View style={styles.textContainer}>
              <Text style={[styles.toastTitle, { color: config.color }]}>{title}</Text>
              {message ? <Text style={styles.toastMessage}>{message}</Text> : null}
            </View>
            <TouchableOpacity onPress={() => setVisible(false)} style={styles.closeButton}>
              <Ionicons name="close" size={16} color="#737373" />
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      {modalVisible && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Ionicons name="medical" size={32} color="#0B7E8A" />
              <Text style={styles.modalTitle}>{modalTitle}</Text>
            </View>
            <Text style={styles.modalMessage}>{modalMessage}</Text>
            <TouchableOpacity style={styles.modalButton} onPress={() => setModalVisible(false)}>
              <Text style={styles.modalButtonText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    zIndex: 9999,
    borderRadius: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
  },
  toastTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  toastMessage: {
    fontSize: 12,
    color: '#525252',
    marginTop: 2,
    lineHeight: 17,
  },
  closeButton: {
    padding: 4,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    marginHorizontal: 24,
    width: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 16,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#171717',
    marginTop: 12,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 14,
    color: '#525252',
    lineHeight: 22,
    marginBottom: 24,
    textAlign: 'center',
  },
  modalButton: {
    backgroundColor: '#0B7E8A',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
});

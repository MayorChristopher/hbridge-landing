import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useToast } from './ToastProvider';

const C = { bg:'#FFFFFF', text:'#171717', muted:'#737373', border:'#E5E5E5', teal:'#0B7E8A' };

interface RatingModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (doctorId: string) => void;
  doctorId: string;
  doctorName: string;
  consultationId?: string;
}

export default function RatingModal({ visible, onClose, onSuccess, doctorId, doctorName, consultationId }: RatingModalProps) {
  const toast = useToast();
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.showWarning('Rating Required', 'Please select a star rating before submitting.');
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase.from('ratings').upsert({
        patient_id: user.id,
        doctor_id: doctorId,
        rating,
        review: review.trim() || null,
      }, { onConflict: 'patient_id,doctor_id' });
      if (error) throw error;
      toast.showSuccess('Thank You!', 'Your rating has been submitted.');
      setRating(0);
      setReview('');
      onSuccess?.(doctorId);
      onClose();
    } catch (error: any) {
      toast.showError('Error', error.message || 'Failed to submit rating');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={s.overlay}>
        <View style={s.modal}>
          <View style={s.header}>
            <Text style={s.title}>Rate Dr. {doctorName}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={C.muted} />
            </TouchableOpacity>
          </View>

          <Text style={s.subtitle}>How was your consultation experience?</Text>

          <View style={s.starsRow}>
            {[1, 2, 3, 4, 5].map(star => (
              <TouchableOpacity key={star} onPress={() => setRating(star)}>
                <Ionicons
                  name={rating >= star ? 'star' : 'star-outline'}
                  size={32}
                  color={rating >= star ? '#F59E0B' : C.muted}
                />
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.ratingText}>
            {rating === 0 ? 'Tap to rate' : 
             rating === 1 ? 'Poor' :
             rating === 2 ? 'Fair' :
             rating === 3 ? 'Good' :
             rating === 4 ? 'Very Good' : 'Excellent'}
          </Text>

          <TextInput
            style={s.reviewInput}
            value={review}
            onChangeText={setReview}
            placeholder="Write a review (optional)..."
            placeholderTextColor={C.muted}
            multiline
            maxLength={500}
          />

          <View style={s.actions}>
            <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[s.submitBtn, rating === 0 && s.submitBtnDisabled]} 
              onPress={handleSubmit}
              disabled={rating === 0 || saving}
            >
              <Text style={s.submitText}>{saving ? 'Submitting...' : 'Submit Rating'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex:1, backgroundColor:'rgba(0,0,0,0.4)', justifyContent:'center', paddingHorizontal:24 },
  modal: {
    backgroundColor:C.bg,
    borderRadius:24,
    padding:24,
    paddingBottom:32,
    gap:16,
    maxHeight:'90%'
  },
  header: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:8 },
  title: { fontSize:20, fontWeight:'700', color:C.text },
  subtitle: { fontSize:15, color:C.muted, textAlign:'center', lineHeight:22 },
  starsRow: { flexDirection:'row', justifyContent:'center', gap:12, paddingVertical:8 },
  ratingText: { fontSize:17, fontWeight:'600', color:C.text, textAlign:'center', minHeight:24 },
  reviewInput: { 
    backgroundColor:'#F5F5F5', 
    borderRadius:14, 
    padding:16, 
    fontSize:15, 
    color:C.text, 
    minHeight:100, 
    textAlignVertical:'top',
    borderWidth:1, 
    borderColor:C.border,
    marginTop:8
  },
  actions: { flexDirection:'row', gap:12, marginTop:8 },
  cancelBtn: { 
    flex:1, 
    borderWidth:1, 
    borderColor:C.border, 
    borderRadius:14, 
    paddingVertical:16, 
    alignItems:'center' 
  },
  cancelText: { fontSize:16, fontWeight:'600', color:C.text },
  submitBtn: { 
    flex:1, 
    backgroundColor:C.teal, 
    borderRadius:14, 
    paddingVertical:16, 
    alignItems:'center' 
  },
  submitBtnDisabled: { backgroundColor:C.muted },
  submitText: { fontSize:16, fontWeight:'600', color:'#fff' },
});
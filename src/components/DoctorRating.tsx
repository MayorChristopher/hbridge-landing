import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { colors, typography, spacing, borderRadius } from '../utils/design';
import { Toast } from '../utils/toast';

interface DoctorRatingProps {
  doctorId: string;
  doctorName: string;
  consultationId?: string;
  visible: boolean;
  onClose: () => void;
  onRatingSubmitted?: () => void;
}

export default function DoctorRating({ 
  doctorId, 
  doctorName, 
  consultationId,
  visible, 
  onClose, 
  onRatingSubmitted 
}: DoctorRatingProps) {
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [loading, setLoading] = useState(false);

  const submitRating = async () => {
    if (rating === 0) {
      Toast.showWarning('Rating Required', 'Please select a star rating for the doctor.');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Toast.showError('Authentication Required', 'Please log in to submit your review.');
        return;
      }

      // Insert review
      const { error: reviewError } = await supabase.from('doctor_reviews').insert({
        doctor_id: doctorId,
        patient_id: user.id,
        consultation_id: consultationId,
        rating,
        review_text: review.trim() || null,
        created_at: new Date().toISOString()
      });

      if (reviewError) throw reviewError;

      // Update doctor's average rating
      await updateDoctorRating(doctorId);

      Toast.showRatingSuccess(doctorName);
      onRatingSubmitted?.();
      onClose();
      
      // Reset form
      setRating(0);
      setReview('');
    } catch (error) {
      console.error('Error submitting rating:', error);
      Toast.showError('Review Failed', 'Unable to submit your review. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const updateDoctorRating = async (doctorId: string) => {
    try {
      // Calculate new average rating
      const { data: reviews } = await supabase
        .from('doctor_reviews')
        .select('rating')
        .eq('doctor_id', doctorId);

      if (reviews && reviews.length > 0) {
        const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
        
        // Update doctor record
        await supabase
          .from('doctors')
          .update({ 
            average_rating: Math.round(avgRating * 10) / 10,
            total_reviews: reviews.length
          })
          .eq('id', doctorId);
      }
    } catch (error) {
      console.error('Error updating doctor rating:', error);
    }
  };

  const renderStars = () => {
    return Array.from({ length: 5 }, (_, index) => (
      <TouchableOpacity
        key={index}
        onPress={() => setRating(index + 1)}
        style={styles.starButton}
      >
        <Ionicons
          name={index < rating ? 'star' : 'star-outline'}
          size={32}
          color={index < rating ? colors.primary : colors.textTertiary}
        />
      </TouchableOpacity>
    ));
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>Rate Dr. {doctorName}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>How was your consultation experience?</Text>

          <View style={styles.starsContainer}>
            {renderStars()}
          </View>

          <Text style={styles.ratingText}>
            {rating === 0 && 'Tap to rate'}
            {rating === 1 && 'Poor'}
            {rating === 2 && 'Fair'}
            {rating === 3 && 'Good'}
            {rating === 4 && 'Very Good'}
            {rating === 5 && 'Excellent'}
          </Text>

          <TextInput
            style={styles.reviewInput}
            value={review}
            onChangeText={setReview}
            placeholder="Share your experience (optional)"
            placeholderTextColor={colors.textTertiary}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          <View style={styles.buttons}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={submitRating}
              disabled={loading}
            >
              <Text style={styles.submitButtonText}>
                {loading ? 'Submitting...' : 'Submit Review'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modal: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 400,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  starButton: {
    padding: spacing.sm,
  },
  ratingText: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    fontWeight: '600',
  },
  reviewInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...typography.body,
    color: colors.textPrimary,
    minHeight: 80,
    marginBottom: spacing.xl,
  },
  buttons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  cancelButtonText: {
    ...typography.button,
    color: colors.textSecondary,
  },
  submitButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    ...typography.button,
    color: colors.textInverse,
  },
});
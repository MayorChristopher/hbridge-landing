import React, { useState } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, Image, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { StatusBar } from 'react-native';
import { supabase } from '../lib/supabase';
import { useNotificationBadge } from '../context/NotificationBadgeContext';

const C = { bg:'#FFFFFF', surface:'#F5F7FA', text:'#171717', muted:'#555F6D', border:'#E2E8EF', teal:'#0B7E8A', tealLight:'#E6F5F5' };

const TYPES = [
  { key:'audio',     label:'Audio Call',  icon:'call-outline',     fee:200 },
  { key:'video',     label:'Video Call',  icon:'videocam-outline', fee:500 },
  { key:'in_person', label:'In-Person',   icon:'person-outline',   fee:0   },
  { key:'follow_up', label:'Follow-Up',   icon:'refresh-outline',  fee:0   },
] as const;

export default function BookConsultationScreen({ route, navigation }: any) {
  const { doctor, reschedule = false, consultationId, existingData } = route.params;
  const { refreshUnreadCount } = useNotificationBadge();

  const [type, setType]         = useState<string>(existingData?.type || 'audio');
  const [symptoms, setSymptoms] = useState(existingData?.symptoms || '');
  const [date, setDate]         = useState(() => { const d = new Date(); d.setDate(d.getDate()+1); return d; });
  const [time, setTime]         = useState(() => { const t = new Date(); t.setHours(9,0,0,0); return t; });
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const [loading, setLoading]   = useState(false);

  const selectedType = TYPES.find(t => t.key === type) ?? TYPES[0];
  const baseFee  = doctor.consultation_fee ?? 0;
  const totalFee = baseFee + selectedType.fee;

  const scheduledAt = new Date(
    date.getFullYear(), date.getMonth(), date.getDate(),
    time.getHours(), time.getMinutes()
  );

  const handleBook = async () => {
    if (!symptoms.trim()) {
      Alert.alert('Required', 'Please describe your symptoms or reason for the consultation.');
      return;
    }
    if (scheduledAt <= new Date()) {
      Alert.alert('Invalid Date', 'Please choose a future date and time.');
      return;
    }
    setLoading(true);
    try {
      const { data:{ user } } = await supabase.auth.getUser();
      if (!user) { Alert.alert('Error', 'Please sign in first'); return; }

      if (reschedule && consultationId) {
        const { error } = await supabase.from('consultations').update({
          consultation_type: type,
          scheduled_at: scheduledAt.toISOString(),
          symptoms: symptoms.trim(),
          updated_at: new Date().toISOString(),
        }).eq('id', consultationId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('consultations').insert({
          patient_id: user.id,
          doctor_id: doctor.id,
          consultation_type: type,
          scheduled_at: scheduledAt.toISOString(),
          consultation_fee: totalFee,
          symptoms: symptoms.trim(),
          status: 'scheduled',
          payment_status: 'pending',
        });
        if (error) throw error;
      }

      await supabase.from('notifications').insert({
        user_id: user.id,
        title: reschedule ? 'Consultation Rescheduled' : 'Consultation Booked!',
        message: `${selectedType.label} with ${doctor.title || 'Dr.'} ${doctor.full_name} on ${scheduledAt.toLocaleDateString()} at ${scheduledAt.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}.`,
        type: 'booking',
      });

      refreshUnreadCount();
      Alert.alert(
        reschedule ? 'Rescheduled!' : 'Booked!',
        reschedule ? 'Your consultation has been updated.' : `Your ${selectedType.label} with ${doctor.title || 'Dr.'} ${doctor.full_name} is confirmed.`,
        [{ text: 'View Appointments', onPress: () => navigation.navigate('Appointments') }]
      );
    } catch(e:any) {
      Alert.alert('Booking Failed', e.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#0B7E8A" />
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#ffffff" />
        </TouchableOpacity>
        <View style={s.headerIconWrap}>
          <Ionicons name="calendar" size={26} color="#ffffff" />
        </View>
        <View style={s.headerTitles}>
          <Text style={s.headerTitle}>{reschedule ? 'Reschedule' : 'Book Consultation'}</Text>
          <Text style={s.headerSubtitle}>Fill in the details below</Text>
        </View>
      </View>

      <View style={s.card}>
      <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined} keyboardVerticalOffset={90}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.body}>

          {/* Doctor card */}
          <View style={s.doctorCard}>
            <View style={s.doctorAvatar}>
              {doctor.profile_image
                ? <Image source={{uri:doctor.profile_image}} style={s.doctorAvatarImg} />
                : <MaterialCommunityIcons name="stethoscope" size={28} color={C.teal} />}
            </View>
            <View style={{flex:1}}>
              <Text style={s.doctorName}>{doctor.title || 'Dr.'} {doctor.full_name}</Text>
              <Text style={s.doctorSpec}>{doctor.specialization}</Text>
              <View style={s.doctorMeta}>
                <Ionicons name="star" size={12} color="#F59E0B" />
                <Text style={s.metaText}>{(doctor.average_rating ?? doctor.rating ?? 0).toFixed(1)}</Text>
                <Text style={s.metaDot}>·</Text>
                <Text style={s.metaText}>{doctor.years_experience ?? 0} yrs exp</Text>
              </View>
            </View>
            <View style={s.feeBox}>
              <Text style={s.feeLabel}>Base fee</Text>
              <Text style={s.feeValue}>₦{baseFee.toLocaleString()}</Text>
            </View>
          </View>

          {/* Type */}
          <Text style={s.sectionTitle}>Consultation Type</Text>
          <View style={s.typeGrid}>
            {TYPES.map(t => (
              <TouchableOpacity key={t.key} style={[s.typeCard, type===t.key && s.typeCardActive]} onPress={()=>setType(t.key)}>
                <Ionicons name={t.icon as any} size={22} color={type===t.key ? C.teal : C.muted} />
                <Text style={[s.typeLabel, type===t.key && s.typeLabelActive]}>{t.label}</Text>
                {t.fee > 0 && <Text style={s.typeFee}>+₦{t.fee}</Text>}
              </TouchableOpacity>
            ))}
          </View>

          {/* Date & Time */}
          <Text style={s.sectionTitle}>Date & Time</Text>
          <View style={s.dateRow}>
            <TouchableOpacity style={s.datePicker} onPress={()=>setShowDate(true)}>
              <Ionicons name="calendar-outline" size={18} color={C.teal} />
              <View style={{flex:1}}>
                <Text style={s.dateLabel}>Date</Text>
                <Text style={s.dateValue}>{date.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={s.datePicker} onPress={()=>setShowTime(true)}>
              <Ionicons name="time-outline" size={18} color={C.teal} />
              <View style={{flex:1}}>
                <Text style={s.dateLabel}>Time</Text>
                <Text style={s.dateValue}>{time.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</Text>
              </View>
            </TouchableOpacity>
          </View>

          {showDate && (
            <DateTimePicker value={date} mode="date" minimumDate={new Date()}
              onChange={(_,d)=>{ setShowDate(false); if(d) setDate(d); }} />
          )}
          {showTime && (
            <DateTimePicker value={time} mode="time"
              onChange={(_,t)=>{ setShowTime(false); if(t) setTime(t); }} />
          )}

          {/* Symptoms */}
          <Text style={s.sectionTitle}>Reason / Symptoms *</Text>
          <TextInput style={s.symptomsInput} value={symptoms} onChangeText={setSymptoms}
            placeholder="Describe your symptoms, concerns, or reason for this consultation..."
            placeholderTextColor={C.muted} multiline textAlignVertical="top" />

          {/* Summary */}
          <View style={s.summary}>
            <View style={s.summaryRow}>
              <Text style={s.summaryKey}>Type</Text>
              <Text style={s.summaryVal}>{selectedType.label}</Text>
            </View>
            <View style={s.summaryRow}>
              <Text style={s.summaryKey}>Scheduled</Text>
              <Text style={s.summaryVal}>
                {scheduledAt.toLocaleDateString()} · {scheduledAt.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}
              </Text>
            </View>
            <View style={s.summaryRow}>
              <Text style={s.summaryKey}>Base fee</Text>
              <Text style={s.summaryVal}>₦{baseFee.toLocaleString()}</Text>
            </View>
            {selectedType.fee > 0 && (
              <View style={s.summaryRow}>
                <Text style={s.summaryKey}>Platform fee</Text>
                <Text style={s.summaryVal}>₦{selectedType.fee.toLocaleString()}</Text>
              </View>
            )}
            <View style={[s.summaryRow, s.summaryTotal]}>
              <Text style={s.totalLabel}>Total</Text>
              <Text style={s.totalValue}>₦{totalFee.toLocaleString()}</Text>
            </View>
          </View>

          {/* Book button */}
          <TouchableOpacity style={[s.bookBtn, loading && {opacity:0.7}]} onPress={handleBook} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <>
                  <Ionicons name="calendar-outline" size={18} color="#fff" />
                  <Text style={s.bookBtnText}>{reschedule ? 'Update Consultation' : 'Confirm Booking'}</Text>
                </>}
          </TouchableOpacity>

          <View style={{height:40}} />
        </ScrollView>
      </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex:1, backgroundColor:'#0B7E8A' },
  header: { flexDirection:'row', alignItems:'center', gap:14, paddingHorizontal:24, paddingTop:12, paddingBottom:32 },
  backBtn: { width:40, height:40, borderRadius:20, backgroundColor:'rgba(255,255,255,0.2)', alignItems:'center', justifyContent:'center' },
  headerIconWrap: { width:56, height:56, borderRadius:28, backgroundColor:'rgba(255,255,255,0.2)', borderWidth:2, borderColor:'rgba(255,255,255,0.4)', alignItems:'center', justifyContent:'center' },
  headerTitles: { flex:1 },
  headerTitle: { fontSize:26, fontWeight:'700', color:'#ffffff', letterSpacing:-0.3 },
  headerSubtitle: { fontSize:14, color:'rgba(255,255,255,0.75)', marginTop:2 },
  card: { flex:1, backgroundColor:'#ffffff', borderTopLeftRadius:28, borderTopRightRadius:28, overflow:'hidden' },
  body: { padding:16, gap:16 },
  // Doctor
  doctorCard: { flexDirection:'row', alignItems:'center', backgroundColor:C.bg, borderRadius:16, borderWidth:1, borderColor:C.border, padding:16, gap:14 },
  doctorAvatar: { width:60, height:60, borderRadius:14, backgroundColor:C.tealLight, alignItems:'center', justifyContent:'center', overflow:'hidden' },
  doctorAvatarImg: { width:60, height:60 },
  doctorName: { fontSize:15, fontWeight:'700', color:C.text },
  doctorSpec: { fontSize:12, color:C.muted, marginTop:2 },
  doctorMeta: { flexDirection:'row', alignItems:'center', gap:4, marginTop:4 },
  metaText: { fontSize:12, color:C.muted },
  metaDot: { fontSize:12, color:C.muted },
  feeBox: { alignItems:'flex-end' },
  feeLabel: { fontSize:11, color:C.muted },
  feeValue: { fontSize:16, fontWeight:'700', color:C.teal },
  // Type
  sectionTitle: { fontSize:15, fontWeight:'700', color:C.text },
  typeGrid: { flexDirection:'row', flexWrap:'wrap', gap:10 },
  typeCard: { width:'47%', backgroundColor:C.bg, borderRadius:14, borderWidth:1, borderColor:C.border, padding:14, alignItems:'center', gap:6 },
  typeCardActive: { borderColor:C.teal, backgroundColor:C.tealLight },
  typeLabel: { fontSize:13, fontWeight:'600', color:C.muted, textAlign:'center' },
  typeLabelActive: { color:C.teal },
  typeFee: { fontSize:11, color:C.muted },
  // Date
  dateRow: { flexDirection:'row', gap:10 },
  datePicker: { flex:1, flexDirection:'row', alignItems:'center', gap:10, backgroundColor:C.bg, borderRadius:12, borderWidth:1, borderColor:C.border, padding:14 },
  dateLabel: { fontSize:11, color:C.muted },
  dateValue: { fontSize:13, fontWeight:'600', color:C.text },
  // Symptoms
  symptomsInput: { backgroundColor:C.bg, borderRadius:12, borderWidth:1, borderColor:C.border, padding:14, fontSize:14, color:C.text, minHeight:100 },
  // Summary
  summary: { backgroundColor:C.bg, borderRadius:14, borderWidth:1, borderColor:C.border, overflow:'hidden' },
  summaryRow: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:16, paddingVertical:12, borderBottomWidth:1, borderBottomColor:C.border },
  summaryKey: { fontSize:13, color:C.muted },
  summaryVal: { fontSize:13, fontWeight:'600', color:C.text },
  summaryTotal: { borderBottomWidth:0, paddingVertical:14 },
  totalLabel: { fontSize:15, fontWeight:'700', color:C.text },
  totalValue: { fontSize:18, fontWeight:'800', color:C.teal },
  // Book
  bookBtn: { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, backgroundColor:C.teal, borderRadius:14, paddingVertical:16 },
  bookBtnText: { fontSize:16, fontWeight:'700', color:'#fff' },
});

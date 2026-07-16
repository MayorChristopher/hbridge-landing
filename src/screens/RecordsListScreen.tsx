import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

const C = { bg:'#F5F3EE', surface:'#EDE9E0', card:'#FFFFFF', text:'#0C2E30', muted:'#6B7E7F', border:'#EAE5DA', teal:'#0B7E8A', tealLight:'rgba(11,126,138,0.09)' };

export default function RecordsListScreen({ navigation }: any) {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { loadRecords(); }, []);

  const loadRecords = async () => {
    try {
      const { data:{ user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('medical_records').select('*').eq('patient_id',user.id).order('created_at',{ascending:false});
      setRecords(data||[]);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  };

  const onRefresh = async () => { setRefreshing(true); await loadRecords(); setRefreshing(false); };
  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#083236" />
      {/* Teal Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={s.headerIconCircle}>
          <Ionicons name="document-text" size={26} color="#fff" />
        </View>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Medical Records</Text>
          <Text style={s.headerSub}>Your health documents</Text>
        </View>
      </View>
      {/* White Card */}
      <View style={s.whiteCard}>
      {loading ? <ActivityIndicator color={C.teal} style={{flex:1}} /> : (
        <FlatList
          data={records}
          keyExtractor={i=>i.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0B7E8A" colors={["#0B7E8A"]} />}
          contentContainerStyle={{padding:16,gap:12}}
          ListEmptyComponent={<View style={s.empty}><Ionicons name="document-outline" size={48} color={C.muted} /><Text style={s.emptyText}>No records yet</Text></View>}
          renderItem={({item}) => (
            <TouchableOpacity style={s.card} onPress={() => navigation.navigate('RecordDetail',{record:item})}>
              <View style={s.iconBox}><Ionicons name="document-text" size={22} color={C.teal} /></View>
              <View style={{flex:1}}>
                <Text style={s.title}>{item.title}</Text>
                <Text style={s.sub}>{item.record_type} · {formatDate(item.created_at)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={C.muted} />
            </TouchableOpacity>
          )}
        />
      )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:{flex:1,backgroundColor:'#083236'},
  header:{flexDirection:'row',alignItems:'center',paddingHorizontal:20,paddingTop:12,paddingBottom:20,gap:14},
  backBtn:{width:40,height:40,borderRadius:20,backgroundColor:'rgba(255,255,255,0.2)',alignItems:'center',justifyContent:'center'},
  headerIconCircle:{width:56,height:56,borderRadius:28,backgroundColor:'rgba(255,255,255,0.2)',borderWidth:1,borderColor:'rgba(255,255,255,0.4)',alignItems:'center',justifyContent:'center'},
  headerCenter:{flex:1},
  headerTitle:{fontSize:26,fontFamily:'Montserrat_700Bold',color:'#fff',letterSpacing:-0.3},
  headerSub:{fontSize:14,fontFamily:'SpaceGrotesk_400Regular',color:'rgba(255,255,255,0.75)',marginTop:2},
  whiteCard:{flex:1,backgroundColor:'#F5F3EE',borderTopLeftRadius:28,borderTopRightRadius:28,overflow:'hidden'},
  card:{flexDirection:'row',alignItems:'center',backgroundColor:C.surface,borderRadius:14,padding:14,gap:14},
  iconBox:{width:48,height:48,borderRadius:12,backgroundColor:'#E6F5F5',alignItems:'center',justifyContent:'center'},
  title:{fontSize:14,fontWeight:'600',color:C.text},
  sub:{fontSize:12,color:C.muted,marginTop:2},
  empty:{flex:1,alignItems:'center',justifyContent:'center',paddingTop:80,gap:12},
  emptyText:{fontSize:16,color:C.muted},
});

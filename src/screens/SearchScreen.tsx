import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Image, RefreshControl,
  Dimensions, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { supabase } from '../lib/supabase';
import { locationService } from '../services/locationService';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const COLLAPSED_Y = Math.round(SCREEN_HEIGHT * 0.55);
const EXPANDED_Y  = 80;

const C = {
  bg: '#FFFFFF', surface: '#F5F7FA', text: '#171717',
  muted: '#555F6D', border: '#E2E8EF', teal: '#0B7E8A', tealLight: '#E6F5F5', darkText: '#FFFFFF',
};

export default function SearchScreen({ route, navigation }: any) {
  const [search, setSearch]           = useState('');
  const [results, setResults]         = useState<any[]>([]);
  const [loading, setLoading]         = useState(false);
  const [refreshing, setRefreshing]   = useState(false);
  const [activeTab, setActiveTab]     = useState<'all'|'hospitals'|'doctors'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters]         = useState({ specialty:'', distance:'all', availability:'all', rating:0, placeType:'all' });
  const [mapCategory, setMapCategory] = useState<'hospital'|'clinic'|'pharmacy'|'all'>('all');
  const [areaCounts, setAreaCounts]   = useState({ hospitals:0, clinics:0, pharmacies:0 });
  const [userLocation, setUserLocation] = useState<{latitude:number;longitude:number}|null>(null);
  const [mapRegion, setMapRegion]     = useState({ latitude:6.5244, longitude:3.3792, latitudeDelta:0.08, longitudeDelta:0.08 });
  const [expanded, setExpanded]       = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string|null>(null);
  const [currentUserDoctorId, setCurrentUserDoctorId] = useState<string|null>(null);
  const searchTimeout = useRef<any>(null);
  const sheetY = useRef(new Animated.Value(COLLAPSED_Y)).current;
  const lastY  = useRef(COLLAPSED_Y);

  const snapTo = (toExpanded: boolean) => {
    const target = toExpanded ? EXPANDED_Y : COLLAPSED_Y;
    lastY.current = target; setExpanded(toExpanded);
    Animated.spring(sheetY, { toValue: target, useNativeDriver: false, bounciness: 4 }).start();
  };

  useEffect(() => { 
    getUserLocation();
    getCurrentUser();
  }, []);
  
  const getCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        const { data: doctorData } = await supabase
          .from('doctors')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();
        if (doctorData) {
          setCurrentUserDoctorId(doctorData.id);
        }
      }
    } catch (error) {
      console.error('Error getting current user:', error);
    }
  };
  useEffect(() => {
    if (route?.params?.tab) {
      const t = route.params.tab;
      if (t === 'doctors') setActiveTab('doctors');
      else if (t === 'hospitals') setActiveTab('hospitals');
      setShowFilters(true);
    }
  }, [route?.params?.tab]);
  useEffect(() => { loadResults(search); }, [filters, activeTab, userLocation]);

  const getUserLocation = async () => {
    try {
      const loc = await locationService.getCurrentLocation();
      const { latitude, longitude } = loc.coords;
      setUserLocation({ latitude, longitude });
      setMapRegion({ latitude, longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 });
    } catch {}
  };

  const loadResults = async (text: string) => {
    setLoading(true);
    try {
      let hQ = supabase.from('hospitals').select('id,name,type,city,state,rating,latitude,longitude').eq('is_active', true);
      let dQ = supabase.from('doctors').select('id,user_id,full_name,specialization,average_rating,profile_image,is_available,consultation_fee,medical_license').eq('verification_status','verified');
      if (text.trim()) { hQ = hQ.ilike('name',`%${text}%`); dQ = dQ.ilike('full_name',`%${text}%`); }
      if (filters.specialty) dQ = dQ.ilike('specialization',`%${filters.specialty}%`);
      if (filters.availability === 'available') dQ = dQ.eq('is_available', true);
      if (filters.rating > 0) { hQ = hQ.gte('rating', filters.rating); dQ = dQ.gte('average_rating', filters.rating); }
      // Filter by place type - only for hospitals
      if (filters.placeType === 'clinic') hQ = hQ.ilike('type','%clinic%');
      else if (filters.placeType === 'pharmacy') hQ = hQ.ilike('name','%pharm%');
      const [{ data: hosp }, { data: docs }] = await Promise.all([
        hQ.order('rating',{ascending:false}).limit(30),
        dQ.order('average_rating',{ascending:false}).limit(15),
      ]);
      let hospitals = (hosp||[]).map((h:any) => {
        let distance = h.city ? `${h.city}, ${h.state}` : h.state||'';
        let distanceNum = 9999;
        if (userLocation && h.latitude && h.longitude) {
          distanceNum = locationService.calculateDistance(userLocation.latitude, userLocation.longitude, h.latitude, h.longitude);
          distance = `${distanceNum.toFixed(1)} km away`;
        }
        return { ...h, _type:'hospital', distance, distanceNum };
      });
      if (userLocation) hospitals.sort((a:any,b:any) => a.distanceNum - b.distanceNum);
      // Compute area counts
      const nearbyHospitals = hospitals.filter((h:any) => h.distanceNum <= 25);
      setAreaCounts({
        hospitals: nearbyHospitals.filter((h:any) => !h.type?.includes('clinic') && !h.name?.toLowerCase().includes('pharm')).length,
        clinics: nearbyHospitals.filter((h:any) => h.type?.includes('clinic')).length,
        pharmacies: nearbyHospitals.filter((h:any) => h.name?.toLowerCase().includes('pharm')).length,
      });
      let doctors = (docs||[]).map((d:any) => ({ ...d, _type:'doctor' }));
      if (filters.distance !== 'all' && userLocation) {
        const max = filters.distance==='5km'?5:filters.distance==='10km'?10:25;
        hospitals = hospitals.filter((h:any) => h.distanceNum <= max);
      }
      let all:any[] = [];
      if (activeTab==='all'||activeTab==='hospitals') all.push(...hospitals);
      if (activeTab==='all'||activeTab==='doctors') all.push(...doctors);
      setResults(all);
    } catch { setResults([]); }
    finally { setLoading(false); }
  };

  const onSearchChange = (text: string) => {
    setSearch(text);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => loadResults(text), 400);
  };

  const onRefresh = async () => { setRefreshing(true); await loadResults(search); setRefreshing(false); };
  const onViewPress = (item: any) => {
    if (item._type==='hospital') navigation.navigate('HospitalDetail',{hospitalId:item.id});
    else navigation.navigate('DoctorDetail',{doctor:item});
  };

  const hospitalMarkers = results.filter(r => r._type==='hospital' && r.latitude && r.longitude);
  // Color-code by type on map
  const markerColor = (h: any) => {
    if (h.name?.toLowerCase().includes('pharm')) return '#8B5CF6';
    if (h.type?.includes('clinic')) return '#F59E0B';
    return C.teal;
  };

  return (
    <View style={s.root}>
      <MapView style={StyleSheet.absoluteFillObject} provider={PROVIDER_DEFAULT} region={mapRegion} showsUserLocation showsMyLocationButton={false} scrollEnabled zoomEnabled>
        {/* Only show hospitals with proper coordinates - remove non-functional markers */}
        {hospitalMarkers.filter(h => h.latitude && h.longitude && !h.name?.toLowerCase().includes('pharm')).map(h => (
          <Marker key={h.id} coordinate={{latitude:h.latitude,longitude:h.longitude}} onPress={() => navigation.navigate('HospitalDetail',{hospitalId:h.id})}>
            <View style={[s.mapPin,{backgroundColor:C.teal}]}><Ionicons name="business" size={14} color="#fff" /></View>
          </Marker>
        ))}
      </MapView>

      {userLocation && (
        <TouchableOpacity style={s.recenterBtn} onPress={() => setMapRegion({latitude:userLocation.latitude,longitude:userLocation.longitude,latitudeDelta:0.05,longitudeDelta:0.05})}>
          <Ionicons name="locate" size={22} color={C.teal} />
        </TouchableOpacity>
      )}

      <SafeAreaView edges={['top']} style={s.searchOverlay} pointerEvents="box-none">
        <View style={s.searchBar}>
          <Ionicons name="search" size={16} color={C.muted} />
          <TextInput style={s.searchInput} placeholder="Search hospitals, doctors..." placeholderTextColor={C.muted} value={search} onChangeText={onSearchChange} returnKeyType="search" />
          <TouchableOpacity style={[s.filterBtn, showFilters && s.filterBtnActive]} onPress={() => setShowFilters(v=>!v)}>
            <Ionicons name="options-outline" size={16} color={showFilters?'#fff':C.text} />
          </TouchableOpacity>
        </View>
        {showFilters && (
          <View style={s.filtersPanel}>
            <View style={s.tabRow}>
              {[{key:'all',label:'All'},{key:'hospitals',label:'Hospitals'},{key:'doctors',label:'Doctors'}].map(tab => (
                <TouchableOpacity key={tab.key} style={[s.tab, activeTab===tab.key && s.tabActive]} onPress={() => setActiveTab(tab.key as any)}>
                  <Text style={[s.tabText, activeTab===tab.key && s.tabTextActive]}>{tab.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8}}>
              {(['5km','10km','25km'] as const).map(d => (
                <TouchableOpacity key={d} style={[s.pill, filters.distance===d && s.pillActive]} onPress={() => setFilters(f=>({...f,distance:f.distance===d?'all':d}))}>
                  <Text style={[s.pillText, filters.distance===d && s.pillTextActive]}>{d}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={[s.pill, filters.placeType==='clinic' && s.pillActive]} onPress={() => setFilters(f=>({...f,placeType:f.placeType==='clinic'?'all':'clinic'}))}>
                <Text style={[s.pillText, filters.placeType==='clinic' && s.pillTextActive]}>Clinics</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.pill, filters.placeType==='pharmacy' && s.pillActive]} onPress={() => setFilters(f=>({...f,placeType:f.placeType==='pharmacy'?'all':'pharmacy'}))}>
                <Text style={[s.pillText, filters.placeType==='pharmacy' && s.pillTextActive]}>Pharmacies</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.pill, filters.availability==='available' && s.pillActive]} onPress={() => setFilters(f=>({...f,availability:f.availability==='available'?'all':'available'}))}>
                <Text style={[s.pillText, filters.availability==='available' && s.pillTextActive]}>Available</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.pill, filters.rating>0 && s.pillActive]} onPress={() => setFilters(f=>({...f,rating:f.rating===0?4:0}))}>
                <Text style={[s.pillText, filters.rating>0 && s.pillTextActive]}>4★ & up</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}
      </SafeAreaView>

      <Animated.View style={[s.sheet,{top:sheetY}]}>
        <TouchableOpacity style={s.handleWrap} onPress={() => snapTo(!expanded)} activeOpacity={1}>
          <View style={s.handle} />
        </TouchableOpacity>
        <View style={s.entryRow}>
          <TouchableOpacity style={s.entryBtn} onPress={() => navigation.navigate('HospitalsList')}>
            <Ionicons name="business" size={18} color={C.teal} />
            <Text style={s.entryBtnText}>Hospitals</Text>
            <Ionicons name="chevron-forward" size={14} color={C.muted} />
          </TouchableOpacity>
          <TouchableOpacity style={s.entryBtn} onPress={() => navigation.navigate('DoctorsList')}>
            <MaterialCommunityIcons name="stethoscope" size={18} color={C.teal} />
            <Text style={s.entryBtnText}>Doctors</Text>
            <Ionicons name="chevron-forward" size={14} color={C.muted} />
          </TouchableOpacity>
        </View>
        <View style={s.sheetTitleWrap}>
          <Text style={s.sheetTitle}>Nearby Results</Text>
          <Text style={s.sheetCount}>{results.length} found</Text>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} style={{flex:1}} contentContainerStyle={s.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.teal} colors={[C.teal]} />}>
          {loading ? (
            <ActivityIndicator size="large" color={C.teal} style={{marginTop:24}} />
          ) : results.length===0 ? (
            <View style={s.empty}>
              <Ionicons name="search-outline" size={40} color={C.muted} />
              <Text style={s.emptyText}>No results found</Text>
              <Text style={s.emptyHint}>Try searching or adjusting filters</Text>
            </View>
          ) : (
            results.map(item => (
              <TouchableOpacity key={`${item._type}-${item.id}`} style={s.card} onPress={() => onViewPress(item)} activeOpacity={0.8}>
                <View style={s.iconBox}>
                  {item._type==='hospital' ? <Ionicons name="business" size={22} color={C.teal} />
                    : item.profile_image ? <Image source={{uri:item.profile_image}} style={s.avatar} />
                    : <MaterialCommunityIcons name="stethoscope" size={22} color={C.teal} />}
                </View>
                <View style={s.cardInfo}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={s.cardName} numberOfLines={1}>
                      {item._type==='doctor'?`Dr. ${item.full_name}`:item.name}
                    </Text>
                    {item._type==='doctor' && currentUserDoctorId === item.id && (
                      <View style={s.youBadge}>
                        <Text style={s.youBadgeText}>You</Text>
                      </View>
                    )}
                  </View>
                  <Text style={s.cardSub} numberOfLines={1}>{item._type==='hospital'?(item.type?item.type.charAt(0).toUpperCase()+item.type.slice(1)+' Hospital':'Hospital'):item.specialization}</Text>
                  <View style={s.cardMeta}>
                    <Ionicons name="location" size={11} color={C.muted} />
                    <Text style={s.metaText}>{item._type==='hospital'?item.distance:(item.city||'Nigeria')}</Text>
                    <Ionicons name="star" size={11} color={C.muted} style={{marginLeft:8}} />
                    <Text style={s.metaText}>{(item.rating||item.average_rating||0).toFixed(1)}</Text>
                    {item._type==='doctor' && item.consultation_fee && (
                      <>
                        <Text style={s.metaText}> • ₦{item.consultation_fee.toLocaleString()}</Text>
                      </>
                    )}
                  </View>
                </View>
                <View style={s.viewBtn}><Text style={s.viewBtnText}>View</Text></View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex:1, backgroundColor:'#E5E5E5' },
  searchOverlay: { position:'absolute', top:0, left:0, right:0, paddingHorizontal:16, gap:10 },
  searchBar: { flexDirection:'row', alignItems:'center', gap:8, backgroundColor:C.bg, borderRadius:14, paddingHorizontal:14, paddingVertical:12, shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.12, shadowRadius:8, elevation:4 },
  searchInput: { flex:1, fontSize:14, color:C.text, paddingVertical:0 },
  filterBtn: { backgroundColor:C.surface, borderRadius:8, padding:6, alignItems:'center', justifyContent:'center' },
  filterBtnActive: { backgroundColor:C.teal },
  filtersPanel: { backgroundColor:C.bg, borderRadius:14, padding:12, gap:10, shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.1, shadowRadius:6, elevation:3 },
  tabRow: { flexDirection:'row', gap:6 },
  tab: { flex:1, backgroundColor:C.surface, borderRadius:8, paddingVertical:8, alignItems:'center' },
  tabActive: { backgroundColor:C.teal },
  tabText: { fontSize:13, color:C.text, fontWeight:'500' },
  tabTextActive: { color:'#fff', fontWeight:'600' },
  pill: { backgroundColor:C.bg, borderRadius:999, paddingHorizontal:14, paddingVertical:6, borderWidth:1, borderColor:C.border },
  pillActive: { backgroundColor:C.teal, borderColor:C.teal },
  pillText: { fontSize:13, color:C.text },
  pillTextActive: { color:'#fff', fontWeight:'600' },
  areaChips:{ position:'absolute', bottom:COLLAPSED_Y+16, left:16, right:16, flexDirection:'row', gap:8 },
  areaChip:{ flexDirection:'row', alignItems:'center', gap:4, paddingHorizontal:10, paddingVertical:6, borderRadius:20, shadowColor:'#000', shadowOffset:{width:0,height:1}, shadowOpacity:0.15, shadowRadius:4, elevation:3 },
  areaChipText:{ fontSize:11, fontWeight:'600', color:'#fff' },
  mapPin: { width:34, height:34, borderRadius:17, backgroundColor:C.teal, alignItems:'center', justifyContent:'center', borderWidth:2, borderColor:'#fff', elevation:4 },
  recenterBtn: { position:'absolute', right:16, bottom:COLLAPSED_Y+24, width:48, height:48, borderRadius:24, backgroundColor:'#fff', alignItems:'center', justifyContent:'center', shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.2, shadowRadius:6, elevation:5 },
  sheet: { position:'absolute', left:0, right:0, bottom:0, backgroundColor:C.bg, borderTopLeftRadius:22, borderTopRightRadius:22, shadowColor:'#000', shadowOffset:{width:0,height:-3}, shadowOpacity:0.1, shadowRadius:10, elevation:10, height:SCREEN_HEIGHT-EXPANDED_Y },
  handleWrap: { alignItems:'center', paddingVertical:12 },
  handle: { width:44, height:4, borderRadius:999, backgroundColor:C.border },
  entryRow: { flexDirection:'row', gap:10, paddingHorizontal:16, paddingBottom:12 },
  entryBtn: { flex:1, flexDirection:'row', alignItems:'center', gap:8, backgroundColor:C.surface, borderRadius:12, paddingHorizontal:14, paddingVertical:12 },
  entryBtnText: { flex:1, fontSize:13, fontWeight:'600', color:C.text },
  sheetTitleWrap: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:16, paddingBottom:10 },
  sheetTitle: { fontSize:15, fontWeight:'700', color:C.text },
  sheetCount: { fontSize:12, color:C.muted },
  listContent: { gap:12, paddingHorizontal:16, paddingTop:4, paddingBottom:60 },
  card: { flexDirection:'row', alignItems:'center', gap:12, backgroundColor:C.bg, borderRadius:14, borderWidth:1, borderColor:C.border, padding:14 },
  iconBox: { width:48, height:48, borderRadius:12, backgroundColor:C.tealLight, alignItems:'center', justifyContent:'center', flexShrink:0, overflow:'hidden' },
  avatar: { width:48, height:48, borderRadius:12 },
  cardInfo: { flex:1, gap:3 },
  cardName: { fontSize:14, fontWeight:'600', color:C.text },
  cardSub: { fontSize:12, color:C.muted },
  cardMeta: { flexDirection:'row', alignItems:'center', marginTop:2 },
  metaText: { fontSize:11, color:C.muted, marginLeft:3 },
  viewBtn: { backgroundColor:C.teal, borderRadius:8, paddingHorizontal:14, paddingVertical:7 },
  viewBtnText: { fontSize:12, fontWeight:'600', color:'#fff' },
  empty: { alignItems:'center', paddingVertical:48, gap:8 },
  emptyText: { fontSize:15, fontWeight:'600', color:C.text },
  emptyHint: { fontSize:13, color:C.muted },
  youBadge: { backgroundColor:C.teal, borderRadius:4, paddingHorizontal:6, paddingVertical:2 },
  youBadgeText: { fontSize:9, fontWeight:'600', color:'#fff' },
});

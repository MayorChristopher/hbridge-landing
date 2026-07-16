import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

interface RecordsBadgeContextType {
  newRecordsCount: number;
  clearRecordsBadge: () => void;
}

const RecordsBadgeContext = createContext<RecordsBadgeContextType>({
  newRecordsCount: 0,
  clearRecordsBadge: () => {},
});

export const useRecordsBadge = () => useContext(RecordsBadgeContext);

export function RecordsBadgeProvider({ children }: { children: React.ReactNode }) {
  const [newRecordsCount, setNewRecordsCount] = useState(0);
  const doctorIdRef = useRef<string | null>(null);

  useEffect(() => {
    let channel: any;
    const setup = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: doctorRow } = await supabase
        .from('doctors').select('id').eq('user_id', user.id).maybeSingle();
      if (!doctorRow) return;

      doctorIdRef.current = doctorRow.id;

      // Read the timestamp of when this doctor last viewed Case Files
      const seenKey = `records_seen_${doctorRow.id}`;
      const lastSeen = (await AsyncStorage.getItem(seenKey)) ?? new Date(0).toISOString();

      const { count } = await supabase
        .from('medical_record_access')
        .select('id', { count: 'exact', head: true })
        .eq('doctor_id', doctorRow.id)
        .eq('is_active', true)
        .neq('access_type', 'doctor_sent')   // only records sent TO the doctor
        .gt('granted_at', lastSeen);

      setNewRecordsCount(count ?? 0);

      // Increment live when a new record is shared
      channel = supabase
        .channel(`records-badge-${doctorRow.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'medical_record_access',
          filter: `doctor_id=eq.${doctorRow.id}`,
        }, (payload: any) => {
          // Only count records sent TO the doctor, not ones the doctor sent out
          if (payload.new?.access_type !== 'doctor_sent') {
            setNewRecordsCount(prev => prev + 1);
          }
        })
        .subscribe();
    };
    setup();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, []);

  const clearRecordsBadge = () => {
    setNewRecordsCount(0);
    if (doctorIdRef.current) {
      AsyncStorage.setItem(`records_seen_${doctorIdRef.current}`, new Date().toISOString());
    }
  };

  return (
    <RecordsBadgeContext.Provider value={{ newRecordsCount, clearRecordsBadge }}>
      {children}
    </RecordsBadgeContext.Provider>
  );
}

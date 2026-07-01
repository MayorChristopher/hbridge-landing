import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
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

      // Only track for doctor accounts
      const { data: doctorRow } = await supabase
        .from('doctors').select('id').eq('user_id', user.id).maybeSingle();
      if (!doctorRow) return;

      doctorIdRef.current = doctorRow.id;

      // Count existing unread incoming records (new ones since we last saw)
      const seenKey = `records_seen_${doctorRow.id}`;
      const lastSeen = new Date(0).toISOString();

      const { count } = await supabase
        .from('medical_record_access')
        .select('id', { count: 'exact', head: true })
        .eq('doctor_id', doctorRow.id)
        .eq('is_active', true)
        .gt('granted_at', lastSeen);

      // Use realtime for new inserts
      channel = supabase
        .channel(`records-badge-${doctorRow.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'medical_record_access',
          filter: `doctor_id=eq.${doctorRow.id}`,
        }, () => {
          setNewRecordsCount(prev => prev + 1);
        })
        .subscribe();
    };
    setup();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, []);

  const clearRecordsBadge = () => setNewRecordsCount(0);

  return (
    <RecordsBadgeContext.Provider value={{ newRecordsCount, clearRecordsBadge }}>
      {children}
    </RecordsBadgeContext.Provider>
  );
}

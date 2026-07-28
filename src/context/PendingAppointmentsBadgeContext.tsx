import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

// Surfaces pending appointments as a tab-bar badge (on the Home tab) so a
// patient sees "something needs attention" from anywhere in the app, not
// only after they happen to scroll to the reminder banner on Home itself.
interface PendingAppointmentsBadgeContextType {
  pendingCount: number;
}

const PendingAppointmentsBadgeContext = createContext<PendingAppointmentsBadgeContextType>({
  pendingCount: 0,
});

export const usePendingAppointmentsBadge = () => useContext(PendingAppointmentsBadgeContext);

export function PendingAppointmentsBadgeProvider({ children }: { children: React.ReactNode }) {
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    let channel: any;
    const setup = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const refresh = async () => {
        const { count } = await supabase
          .from('consultations')
          .select('id', { count: 'exact', head: true })
          .eq('patient_id', user.id)
          .eq('status', 'pending');
        setPendingCount(count ?? 0);
      };
      await refresh();

      channel = supabase
        .channel(`pending-appointments-badge-${user.id}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'consultations',
          filter: `patient_id=eq.${user.id}`,
        }, () => { refresh(); })
        .subscribe();
    };
    setup();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, []);

  return (
    <PendingAppointmentsBadgeContext.Provider value={{ pendingCount }}>
      {children}
    </PendingAppointmentsBadgeContext.Provider>
  );
}

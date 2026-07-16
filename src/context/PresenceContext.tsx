import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { supabase } from '../lib/supabase';

// Set of user_ids currently online in the app
const PresenceContext = createContext<Set<string>>(new Set());

export function PresenceProvider({
  userId,
  children,
}: {
  userId: string | undefined;
  children: React.ReactNode;
}) {
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!userId) return;

    const channel = supabase.channel('app-presence');

    const syncIds = () => {
      const state = channel.presenceState<{ user_id: string }>();
      const ids = new Set<string>();
      Object.values(state).forEach((list: any[]) =>
        list.forEach((p: any) => ids.add(p.user_id))
      );
      setOnlineIds(new Set(ids));
    };

    channel
      .on('presence', { event: 'sync' }, syncIds)
      .on('presence', { event: 'join' }, syncIds)
      .on('presence', { event: 'leave' }, syncIds)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: userId });
        }
      });

    // Pause presence when app goes to background; resume on foreground
    const appStateSub = AppState.addEventListener('change', async (state) => {
      if (state === 'background' || state === 'inactive') {
        await channel.untrack();
      } else if (state === 'active') {
        await channel.track({ user_id: userId });
      }
    });

    return () => {
      appStateSub.remove();
      channel.untrack();
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return (
    <PresenceContext.Provider value={onlineIds}>
      {children}
    </PresenceContext.Provider>
  );
}

export const usePresence = () => useContext(PresenceContext);

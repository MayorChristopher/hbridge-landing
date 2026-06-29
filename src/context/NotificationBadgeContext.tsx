import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface NotificationBadgeContextType {
  unreadNotifications: number;
  setUnreadNotifications: (count: number) => void;
  refreshUnreadCount: () => Promise<void>;
}

const NotificationBadgeContext = createContext<NotificationBadgeContextType | null>(null);

export const useNotificationBadge = () => {
  const context = useContext(NotificationBadgeContext);
  if (!context) throw new Error('useNotificationBadge must be used within NotificationBadgeProvider');
  return context;
};

export function NotificationBadgeProvider({ children }: { children: React.ReactNode }) {
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const refreshUnreadCount = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (!error && count !== null) {
        setUnreadNotifications(count);
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  useEffect(() => {
    refreshUnreadCount();
    const interval = setInterval(refreshUnreadCount, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <NotificationBadgeContext.Provider value={{ unreadNotifications, setUnreadNotifications, refreshUnreadCount }}>
      {children}
    </NotificationBadgeContext.Provider>
  );
}

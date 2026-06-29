import React, { createContext, useContext, useState } from 'react';
import { supabase } from '../lib/supabase';

interface ChatBadgeContextType {
  unreadCount: number;
  setUnreadCount: (count: number) => void;
  incrementUnread: () => void;
  clearUnread: () => void;
  refreshUnreadCount: () => Promise<void>;
}

const ChatBadgeContext = createContext<ChatBadgeContextType | null>(null);

export const useChatBadge = () => {
  const context = useContext(ChatBadgeContext);
  if (!context) throw new Error('useChatBadge must be used within ChatBadgeProvider');
  return context;
};

export function ChatBadgeProvider({ children }: { children: React.ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0);

  const incrementUnread = () => setUnreadCount(prev => prev + 1);
  const clearUnread = () => setUnreadCount(0);

  const refreshUnreadCount = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { count } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .neq('sender_id', user.id)
        .is('read_at', null);
      setUnreadCount(count || 0);
    } catch { /* silently fail */ }
  };

  return (
    <ChatBadgeContext.Provider value={{ unreadCount, setUnreadCount, incrementUnread, clearUnread, refreshUnreadCount }}>
      {children}
    </ChatBadgeContext.Provider>
  );
}

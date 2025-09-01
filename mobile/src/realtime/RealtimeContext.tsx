import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import Constants from 'expo-constants';
import { io, Socket } from 'socket.io-client';

type Counters = {
  requests: number;
  announcements: number;
};

type RealtimeContextType = {
  connected: boolean;
  counters: Counters;
  clear: (key: keyof Counters) => void;
};

const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined);

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [counters, setCounters] = useState<Counters>({ requests: 0, announcements: 0 });

  useEffect(() => {
    const extra: any = Constants.expoConfig?.extra || {};
    const baseUrl: string = extra.API_BASE_URL || 'http://localhost:4000';
    const socket: Socket = io(baseUrl, { transports: ['websocket'] });

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('request:new', () => setCounters(c => ({ ...c, requests: c.requests + 1 })));
    socket.on('announcement:new', () => setCounters(c => ({ ...c, announcements: c.announcements + 1 })));

    return () => {
      socket.removeAllListeners();
      socket.close();
    };
  }, []);

  const clear = (key: keyof Counters) => setCounters(c => ({ ...c, [key]: 0 }));
  const value = useMemo(() => ({ connected, counters, clear }), [connected, counters]);
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime() {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error('useRealtime must be used within RealtimeProvider');
  return ctx;
}


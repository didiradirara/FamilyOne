import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import Constants from 'expo-constants';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../auth/AuthContext';

type Counters = {
  requests: number;
  announcements: number;
  reports: number;
};

type RealtimeContextType = {
  connected: boolean;
  counters: Counters;
  clear: (key: keyof Counters) => void;
};

const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined);

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [counters, setCounters] = useState<Counters>({ requests: 0, announcements: 0, reports: 0 });
  const { token } = useAuth();

  useEffect(() => {
    const extra: any = Constants.expoConfig?.extra || {};

    const baseUrl: string = extra.API_BASE_URL || 'http://34.47.82.64';

    const socket: Socket = io(baseUrl, { transports: ['websocket'], auth: token ? { token } : undefined });

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('request:new', () => setCounters(c => ({ ...c, requests: c.requests + 1 })));
    socket.on('announcement:new', () => setCounters(c => ({ ...c, announcements: c.announcements + 1 })));
    socket.on('report:new', () => setCounters(c => ({ ...c, reports: c.reports + 1 })));

    return () => {
      socket.removeAllListeners();
      socket.close();
    };
  }, [token]);

  const clear = useCallback((key: keyof Counters) => setCounters(c => ({ ...c, [key]: 0 })), []);
  const value = useMemo(() => ({ connected, counters, clear }), [connected, counters, clear]);
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime() {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error('useRealtime must be used within RealtimeProvider');
  return ctx;
}


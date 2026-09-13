import { useCallback, useEffect, useRef, useState } from 'react';
import { applyDonation, applySettings, removeDonation, type BoardSnapshot } from '@shared/board';
import type { PublicDonation } from '@shared/donations';
import { parseBoardMessage } from '@shared/messages';
import { getBoard } from './api';

export interface LiveEvent {
  donation: PublicDonation;
  /** Monotonic, so two gifts of the same size from "Anonymous" are still two events. */
  seq: number;
  /** The board total before this gift landed: for milestone detection. */
  beforeCents: number;
}

export interface LiveBoard {
  snapshot: BoardSnapshot | null;
  latest: LiveEvent | null;
  connected: boolean;
  offline: boolean;
  refresh: () => void;
}

const POLL_MS = 30_000;
const PING_MS = 25_000;

/**
 * One hook for every screen that shows live money: the landing page's ticker,
 * the thank-you screen, the projector. Snapshot over HTTP, deltas over the
 * DonationBoard WebSocket, reconnect with backoff, and a slow poll as the
 * belt to the socket's braces.
 */
export function useLiveBoard(): LiveBoard {
  const [snapshot, setSnapshot] = useState<BoardSnapshot | null>(null);
  const [latest, setLatest] = useState<LiveEvent | null>(null);
  const [connected, setConnected] = useState(false);
  const [offline, setOffline] = useState(false);
  const seq = useRef(0);
  const snapRef = useRef<BoardSnapshot | null>(null);
  snapRef.current = snapshot;

  const refresh = useCallback(async () => {
    try {
      const s = await getBoard();
      setSnapshot(s);
      setOffline(false);
    } catch {
      setOffline(true);
    }
  }, []);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let closed = false;
    let attempt = 0;
    let reconnectTimer: number | undefined;
    let pingTimer: number | undefined;

    const connect = () => {
      if (closed) return;
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      try {
        ws = new WebSocket(`${proto}://${location.host}/api/board/ws`);
      } catch {
        scheduleReconnect();
        return;
      }
      ws.onopen = () => {
        attempt = 0;
        setConnected(true);
        // Anything that happened while we were away.
        void refresh();
        pingTimer = window.setInterval(() => ws?.readyState === WebSocket.OPEN && ws.send('ping'), PING_MS);
      };
      ws.onmessage = (ev) => {
        if (ev.data === 'pong') return;
        const m = parseBoardMessage(ev.data);
        if (!m) return;
        if (m.type === 'donation.new') {
          const before = snapRef.current?.raisedCents ?? 0;
          setSnapshot((s) => (s ? applyDonation(s, m.payload) : s));
          if (!snapRef.current?.recent.some((r) => r.id === m.payload.id)) {
            seq.current += 1;
            setLatest({ donation: m.payload, seq: seq.current, beforeCents: before });
          }
        } else if (m.type === 'donation.hidden') {
          setSnapshot((s) => (s ? removeDonation(s, m.payload.id) : s));
        } else if (m.type === 'board.settings') {
          setSnapshot((s) => (s ? applySettings(s, m.payload) : s));
        }
      };
      ws.onclose = () => {
        setConnected(false);
        window.clearInterval(pingTimer);
        scheduleReconnect();
      };
      ws.onerror = () => ws?.close();
    };

    const scheduleReconnect = () => {
      if (closed) return;
      attempt += 1;
      const delay = Math.min(30_000, 800 * 2 ** Math.min(attempt, 6)) + Math.random() * 400;
      reconnectTimer = window.setTimeout(connect, delay);
    };

    void refresh();
    connect();
    const poll = window.setInterval(() => void refresh(), POLL_MS);
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      void refresh();
      if (!ws || ws.readyState === WebSocket.CLOSED) {
        window.clearTimeout(reconnectTimer);
        connect();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onVisible);

    return () => {
      closed = true;
      window.clearTimeout(reconnectTimer);
      window.clearInterval(pingTimer);
      window.clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onVisible);
      ws?.close();
    };
  }, [refresh]);

  return { snapshot, latest, connected, offline, refresh };
}

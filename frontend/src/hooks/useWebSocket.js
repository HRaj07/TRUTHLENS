import { useEffect, useRef, useState, useCallback } from 'react';

// ============================================================
//  useWebSocket — Real-time chat + AI data via WebSocket
//  TODO: Connect to your Node.js Socket.io / WS server
//        at process.env.REACT_APP_WS_URL (default: ws://localhost:3001)
// ============================================================

export function useWebSocket({ sessionCode, userId, role } = {}) {
  const wsRef         = useRef(null);
  const reconnectRef  = useRef(0);
  const pingRef       = useRef(null);

  const [status,      setStatus]      = useState('disconnected'); // disconnected | connecting | connected | error
  const [participants, setParticipants] = useState([]);
  const [liveAnalytics, setLiveAnalytics] = useState(null); // streamed from AI backend via Node.js

  // ── Connect ────────────────────────────────────────────────
  const connect = useCallback(() => {
    if (!sessionCode) return;

    setStatus('connecting');
    try {
      // MOCK: Simulate connection after delay
      setTimeout(() => {
        setStatus('connected');
        reconnectRef.current = 0;
        // Simulate other participant joining
        setTimeout(() => {
          setParticipants(prev => [...prev, {
            id: 'remote-1',
            name: role === 'interviewer' ? 'Candidate (Demo)' : 'Interviewer (Demo)',
            role: role === 'interviewer' ? 'candidate' : 'interviewer',
            joinedAt: Date.now(),
          }]);
        }, 1500);
      }, 600);

    } catch (err) {
      setStatus('error');
      console.error('[WebSocket] Connection error:', err);
    }
  }, [sessionCode, role]);

  // ── Disconnect ─────────────────────────────────────────────
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (pingRef.current) clearInterval(pingRef.current);
    setStatus('disconnected');
  }, []);

  // ── Send message ───────────────────────────────────────────
  const sendMessage = useCallback((text) => {
    const msg = {
      type: 'chat',
      sessionCode,
      senderId: userId,
      text,
      timestamp: Date.now(),
    };

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
    // MOCK: Add directly to messages (simulate echo)
    // Real server would broadcast back to all participants
    return msg;
  }, [sessionCode, userId]);

  // ── Send live analytics update ─────────────────────────────
  const broadcastAnalytics = useCallback((data) => {
    // TODO: Send emotion data to Node.js server to broadcast to interviewer
    // if (wsRef.current?.readyState === WebSocket.OPEN) {
    //   wsRef.current.send(JSON.stringify({ type: 'analytics', data }));
    // }
  }, []);

  // ── Auto-connect when sessionCode available ────────────────
  useEffect(() => {
    if (sessionCode) connect();
    return () => disconnect();
  }, [sessionCode, connect, disconnect]);

  return {
    status,
    connected: status === 'connected',
    participants,
    liveAnalytics,
    sendMessage,
    broadcastAnalytics,
    connect,
    disconnect,
  };
}

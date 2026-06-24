import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';

export function useSocket(role) {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [queueState, setQueueState] = useState(null);
  const [lastCalled, setLastCalled] = useState(null);

  useEffect(() => {
    const socket = io(SERVER_URL, {
      query: { role },
      reconnectionDelay: 1000,
      reconnectionAttempts: 20,
    });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    const stateEvent = role === 'receptionist' ? 'receptionist_state' : 'queue_state';
    socket.on(stateEvent, (data) => setQueueState(data));

    // Both roles receive this for the alert animation
    socket.on('token_called', (data) => setLastCalled(data));

    return () => socket.disconnect();
  }, [role]);

  const emit = useCallback((event, data) => {
    return new Promise((resolve) => {
      if (!socketRef.current) return resolve({ error: 'Not connected' });
      socketRef.current.emit(event, data, (ack) => resolve(ack || {}));
    });
  }, []);

  return { connected, queueState, lastCalled, emit };
}

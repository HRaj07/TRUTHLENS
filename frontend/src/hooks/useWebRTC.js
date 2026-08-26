import { useRef, useState, useEffect, useCallback } from 'react';

// ============================================================
//  useWebRTC — Real peer-to-peer video via WebRTC
//  Signaling: FastAPI WebSocket at /ws/{room_code}
//
//  KEY DESIGN:  The main init useEffect depends ONLY on
//  sessionCode so it runs exactly ONCE.  Everything else
//  (role, userName, callbacks) is accessed via refs so it
//  is always current without triggering a re-run.
// ============================================================

const apiBase = process.env.REACT_APP_FASTAPI_URL || 'https://truthlens-1-ypjm.onrender.com';
const WS_BASE = process.env.REACT_APP_WS_URL || apiBase.replace(/^http/, 'ws');

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
];

export function useWebRTC({ role = 'candidate', sessionCode = '', userName = 'User', onChatMessage, onCodeUpdate } = {}) {
  // ── DOM refs ────────────────────────────────────────────────
  const localVideoRef  = useRef(null);
  const remoteVideoRef = useRef(null);

  // ── Internal refs (never cause re-renders) ─────────────────
  const peerRef             = useRef(null);
  const wsRef               = useRef(null);
  const localStreamRef      = useRef(null);
  const screenStreamRef     = useRef(null);
  const pendingCandidateRef = useRef([]);
  const remoteStreamRef     = useRef(null);  // cached remote stream
  const tracksAddedRef      = useRef(false); // guard: true once tracks are in PC
  const offerSentRef        = useRef(false); // guard: only send one offer

  // Keep role/userName current inside callbacks without adding to deps
  const roleRef     = useRef(role);
  const userNameRef = useRef(userName);
  useEffect(() => { roleRef.current = role; },     [role]);
  useEffect(() => { userNameRef.current = userName; }, [userName]);

  // ── React state (drives UI renders) ────────────────────────
  const [micEnabled,      setMicEnabled]      = useState(true);
  const [cameraEnabled,   setCameraEnabled]   = useState(true);
  const [screenSharing,   setScreenSharing]   = useState(false);
  const [connected,       setConnected]       = useState(false);
  const [remoteConnected, setRemoteConnected] = useState(false);
  const [remoteName,      setRemoteName]      = useState('');
  const [error,           setError]           = useState(null);
  const [loading,         setLoading]         = useState(true);
  const [audioLevel,      setAudioLevel]      = useState(0);
  const [wsStatus,        setWsStatus]        = useState('disconnected');

  // ── Attach remote stream to video element ──────────────────
  const attachRemoteStream = useCallback((stream) => {
    remoteStreamRef.current = stream;
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = stream;
      remoteVideoRef.current.play().catch(() => {});
    }
    setRemoteConnected(true);
  }, []);

  // ── Create RTCPeerConnection ────────────────────────────────
  const createPeer = useCallback(() => {
    // Close any existing peer connection first
    peerRef.current?.close();
    offerSentRef.current = false;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.ontrack = (event) => {
      console.log('[WebRTC] ontrack fired — track:', event.track ? 'yes' : 'no', 'streams:', event.streams.length);
      
      // Some browsers (like Safari) might not provide streams[0] if it's arriving as individual tracks
      let stream = event.streams[0];
      if (!stream && event.track) {
        stream = new MediaStream([event.track]);
      }
      
      if (stream) {
        console.log('[WebRTC] Attaching remote stream to video element');
        attachRemoteStream(stream);
      } else {
        console.warn('[WebRTC] ontrack fired but no stream found');
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'ice-candidate',
          candidate: event.candidate,
        }));
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('[WebRTC] Connection state:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        setRemoteConnected(true);
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setRemoteConnected(false);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE state:', pc.iceConnectionState);
    };

    return pc;
  }, [attachRemoteStream]);

  // ── Send SDP offer (interviewer → candidate) ───────────────
  const sendOffer = useCallback(async () => {
    const pc  = peerRef.current;
    const ws  = wsRef.current;
    if (!pc || !ws || ws.readyState !== WebSocket.OPEN) return;
    if (offerSentRef.current) return; // don't send twice
    offerSentRef.current = true;

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      ws.send(JSON.stringify({ type: 'offer', sdp: offer }));
      console.log('[WebRTC] Offer sent');
    } catch (err) {
      console.error('[WebRTC] createOffer error:', err);
      offerSentRef.current = false;
    }
  }, []);

  // ── Handle incoming signaling messages ─────────────────────
  // Uses refs so this function never needs to be in any useEffect dep array
  const handleSignalRef = useRef(null);
  handleSignalRef.current = async (data) => {
    const pc = peerRef.current;
    if (!pc) return;
    console.log('[WebRTC] Signal received:', data.type);

    try {
      if (data.type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        // Flush pending ICE
        for (const c of pendingCandidateRef.current) {
          await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
        }
        pendingCandidateRef.current = [];

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        wsRef.current?.send(JSON.stringify({ type: 'answer', sdp: answer }));
        console.log('[WebRTC] Answer sent');

      } else if (data.type === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        // Flush pending ICE
        for (const c of pendingCandidateRef.current) {
          await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
        }
        pendingCandidateRef.current = [];

      } else if (data.type === 'ice-candidate') {
        if (pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(() => {});
        } else {
          pendingCandidateRef.current.push(data.candidate);
        }

      } else if (data.type === 'peer-joined') {
        console.log('[WebRTC] Peer joined:', data.role, data.name);
        setRemoteName(data.name || '');
        // Only the interviewer creates the offer, and only when the candidate joins
        if (roleRef.current === 'interviewer' && data.role === 'candidate') {
          if (tracksAddedRef.current) {
            sendOffer();
          } else {
            // Tracks not ready yet — wait a bit then send
            setTimeout(sendOffer, 300);
          }
        }

      } else if (data.type === 'chat') {
        if (onChatMessage) onChatMessage(data);
      } else if (data.type === 'code_update') {
        if (onCodeUpdate) onCodeUpdate(data.code, data.language);
      } else if (data.type === 'peer-left') {
        setRemoteConnected(false);
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
        remoteStreamRef.current = null;
        offerSentRef.current = false;
      }
    } catch (err) {
      console.error('[WebRTC] Signal handling error:', err);
    }
  };

  // ── Main Effect — runs ONCE per sessionCode ─────────────────
  useEffect(() => {
    if (!sessionCode) return;
    let cancelled = false;

    // Reset guards
    tracksAddedRef.current = false;
    offerSentRef.current   = false;
    pendingCandidateRef.current = [];

    const init = async () => {
      const codeUpper = sessionCode.toUpperCase().trim();
      setLoading(true);
      setError(null);
      console.log('[WebRTC] Initializing for room:', codeUpper, 'as', role);

      try {
        // ── SECURITY CHECK: getUserMedia only works on HTTPS or localhost ──
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          const isHttp = window.location.protocol === 'http:';
          const isRemote = !['localhost', '127.0.0.1'].includes(window.location.hostname);
          
          if (isHttp && isRemote) {
            throw new Error(
              `Camera blocked: Chrome requires HTTPS for remote devices. ` +
              `Fix: Open chrome://flags/#unsafely-treat-insecure-origin-as-secure ` +
              `→ add "${window.location.origin}" → Relaunch Chrome.`
            );
          }
          throw new Error('Camera/microphone not supported in this browser.');
        }

        // 1. Get local media
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }

        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        setConnected(true);

        // 2. Audio level meter
        try {
          const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          const analyser = audioCtx.createAnalyser();
          audioCtx.createMediaStreamSource(stream).connect(analyser);
          analyser.fftSize = 256;
          const buf = new Uint8Array(analyser.frequencyBinCount);
          const tick = () => {
            if (!localStreamRef.current || cancelled) return;
            analyser.getByteFrequencyData(buf);
            const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
            setAudioLevel(Math.min(100, avg * 2));
            requestAnimationFrame(tick);
          };
          tick();
        } catch (_) {}

        // 3. Create Peer Connection and add tracks
        const pc = createPeer();
        peerRef.current = pc;
        stream.getTracks().forEach(track => pc.addTrack(track, stream));
        tracksAddedRef.current = true;
        console.log('[WebRTC] Local tracks added to peer connection');

        // 4. Connect WebSocket signaling
        const wsUrl = `${WS_BASE}/ws/${sessionCode.toUpperCase().trim()}`;
        console.log('[WebRTC] Connecting to signaling server:', wsUrl);
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (cancelled) { ws.close(); return; }
          console.log('[WebRTC] WebSocket connected');
          setWsStatus('connected');
          // Identify ourselves to the room
          ws.send(JSON.stringify({ role: roleRef.current, name: userNameRef.current }));
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (handleSignalRef.current) handleSignalRef.current(data);
          } catch (e) {
            console.warn('[WebRTC] Bad WS message:', e);
          }
        };

        ws.onerror = (e) => {
          console.error('[WebRTC] WS error:', e);
          setWsStatus('error');
        };

        ws.onclose = (e) => {
          console.log('[WebRTC] WS closed, code:', e.code);
          setWsStatus('disconnected');
          setRemoteConnected(false);
        };

      } catch (err) {
        if (!cancelled) {
          let msg;
          if (err.name === 'NotAllowedError') {
            msg = 'Camera/mic access denied. Please allow permissions and reload.';
          } else if (err.message.includes('chrome://flags')) {
            msg = err.message; // Our custom secure-context message
          } else {
            msg = `WebRTC error: ${err.message}`;
          }
          setError(msg);
          console.error('[WebRTC] Init error:', err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    init();

    return () => {
      cancelled = true;
      console.log('[WebRTC] Cleaning up...');
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      peerRef.current?.close();
      wsRef.current?.close();
      localStreamRef.current  = null;
      screenStreamRef.current = null;
      peerRef.current         = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionCode]); // ← ONLY sessionCode. All other values accessed via refs.

  // ── Re-attach cached remote stream when video el becomes available
  useEffect(() => {
    if (remoteConnected && remoteStreamRef.current && remoteVideoRef.current) {
      if (!remoteVideoRef.current.srcObject) {
        remoteVideoRef.current.srcObject = remoteStreamRef.current;
        remoteVideoRef.current.play().catch(() => {});
      }
    }
  }, [remoteConnected]);

  // ── Toggle Microphone ───────────────────────────────────────
  const toggleMic = useCallback(() => {
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setMicEnabled(prev => !prev);
  }, []);

  // ── Toggle Camera ───────────────────────────────────────────
  const toggleCamera = useCallback(() => {
    localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
    setCameraEnabled(prev => !prev);
  }, []);

  // ── Screen Share ────────────────────────────────────────────
  const stopScreenShare = useCallback(() => {
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;
    if (localStreamRef.current && localVideoRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
    const camTrack = localStreamRef.current?.getVideoTracks()[0];
    const sender   = peerRef.current?.getSenders().find(s => s.track?.kind === 'video');
    if (sender && camTrack) sender.replaceTrack(camTrack);
    setScreenSharing(false);
  }, []);

  const startScreenShare = useCallback(async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      screenStreamRef.current = screenStream;
      if (localVideoRef.current) localVideoRef.current.srcObject = screenStream;
      const screenTrack = screenStream.getVideoTracks()[0];
      const sender      = peerRef.current?.getSenders().find(s => s.track?.kind === 'video');
      if (sender && screenTrack) sender.replaceTrack(screenTrack);
      setScreenSharing(true);
      screenTrack.addEventListener('ended', stopScreenShare);
    } catch (err) {
      console.error('[WebRTC] Screen share error:', err);
    }
  }, [stopScreenShare]);

  // ── Send Chat Message ───────────────────────────────────────
  const sendChatMessage = useCallback((text, senderId, senderName) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'chat',
        text,
        senderId,
        senderName
      }));
    }
  }, []);

  // ── Send Code Update ────────────────────────────────────────
  const sendCodeUpdate = useCallback((code, language) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'code_update',
        code,
        language,
      }));
    }
  }, []);

  // ── Capture frame as blob (for AI analysis) ────────────────
  const captureFrameAsBlob = useCallback((videoEl = null) => {
    return new Promise((resolve) => {
      const video = videoEl || localVideoRef.current;
      if (!video || !video.videoWidth) return resolve(null);
      const canvas = document.createElement('canvas');
      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      canvas.toBlob(resolve, 'image/jpeg', 0.85);
    });
  }, []);

  return {
    localVideoRef,
    remoteVideoRef,
    connected,
    remoteConnected,
    remoteName,
    loading,
    error,
    micEnabled,
    cameraEnabled,
    screenSharing,
    audioLevel,
    wsStatus,
    toggleMic,
    toggleCamera,
    startScreenShare,
    stopScreenShare,
    captureFrameAsBlob,
    sendChatMessage,
    sendCodeUpdate,
  };
}

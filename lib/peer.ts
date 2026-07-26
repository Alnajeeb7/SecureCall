"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type Peer from "peerjs";
import type { DataConnection, MediaConnection } from "peerjs";

/** Total people allowed in one room, host included. */
export const MAX_PARTICIPANTS = 5;

export type ChatMessage = {
  id: string;
  from: "me" | string;
  fromLabel: string;
  text: string;
  time: number;
};

export type Participant = {
  id: string;
  stream: MediaStream | null;
  micOn: boolean;
  camOn: boolean;
};

export type CallStatus =
  | "idle"
  | "waiting" // host is up, waiting for the first guest
  | "connecting"
  | "connected"
  | "full" // room was at capacity when we tried to join
  | "left"
  | "error";

type WireMsg =
  | { type: "accepted" }
  | { type: "room-full" }
  | { type: "peer-joined"; id: string }
  | { type: "peer-left"; id: string }
  | { type: "chat"; text: string }
  | { type: "media-state"; micOn: boolean; camOn: boolean };

export function shortLabel(id: string) {
  return `Guest ${id.slice(-4).toUpperCase()}`;
}

/**
 * ICE server config used for every Peer instance.
 *
 * STUN alone (PeerJS's default) is enough when both sides sit behind
 * simple/cone NATs — e.g. same-country home broadband. It is NOT enough
 * once either side is behind a symmetric or carrier-grade NAT, which is
 * common on mobile networks and many international ISPs. In that case
 * the two peers can never learn a usable public address for each other
 * and the call just hangs on "connecting" forever — this is what was
 * happening on the Saudi <-> India route.
 *
 * A TURN server relays the actual media when a direct path can't be
 * found, so it fixes exactly that case. Openrelay's public TURN server
 * below is free and fine for testing, but it's shared/rate-limited —
 * for production, swap in your own TURN credentials (Twilio, Xirsys,
 * Cloudflare Calls, or a self-hosted coturn box).
 */
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  {
    urls: "turn:openrelay.metered.ca:80",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: "turn:openrelay.metered.ca:443",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: "turn:openrelay.metered.ca:443?transport=tcp",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
];

/**
 * Mesh group call over WebRTC, up to MAX_PARTICIPANTS people, host included.
 *
 * Topology: the room code IS the host's peer id. Every guest's very first
 * move is a data connection to that code. The host is the sole gatekeeper —
 * it accepts or rejects (room-full) based on how many are already in — and
 * then tells everyone else who just joined. Existing members reach out
 * directly to the newcomer, which is what turns "everyone knows the host"
 * into a full mesh where everyone can see and hear everyone. No media or
 * chat ever passes through a server; only the initial handshake (who's
 * calling whom) goes through the PeerJS broker.
 *
 * If the host leaves, the room ends for everyone — the host is the anchor
 * that the room code refers to. Guests leaving just drop out of the mesh;
 * everyone else continues.
 */
export function useSecureCall(roomCode: string, isHost: boolean) {
  const peerRef = useRef<Peer | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null);
  const dataConnsRef = useRef<Map<string, DataConnection>>(new Map());
  const callsRef = useRef<Map<string, MediaConnection>>(new Map());

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [participants, setParticipants] = useState<Map<string, Participant>>(new Map());
  const [status, setStatus] = useState<CallStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const upsertParticipant = useCallback((id: string, patch: Partial<Participant>) => {
    setParticipants((prev) => {
      const next = new Map(prev);
      const existing = next.get(id) ?? { id, stream: null, micOn: true, camOn: true };
      next.set(id, { ...existing, ...patch });
      return next;
    });
  }, []);

  const removeParticipant = useCallback((id: string) => {
    setParticipants((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
    dataConnsRef.current.get(id)?.close();
    dataConnsRef.current.delete(id);
    callsRef.current.get(id)?.close();
    callsRef.current.delete(id);
  }, []);

  const broadcastMsg = useCallback((msg: WireMsg) => {
    dataConnsRef.current.forEach((conn) => conn.send(msg));
  }, []);

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    const dataConns = dataConnsRef.current;
    const calls = callsRef.current;

    function markConnected() {
      setStatus((s) => (s === "left" || s === "full" || s === "error" ? s : "connected"));
    }

    function wireCall(call: MediaConnection) {
      calls.set(call.peer, call);
      call.on("stream", (remote) => {
        upsertParticipant(call.peer, { stream: remote });
        markConnected();
      });
      call.on("close", () => removeParticipant(call.peer));
    }

    function wireData(conn: DataConnection) {
      dataConns.set(conn.peer, conn);
      conn.on("data", (raw) => handleMessage(conn.peer, raw as WireMsg));
      conn.on("close", () => {
        if (!isHost && conn.peer === roomCode) {
          // the host disconnected — the room is over for everyone
          setStatus("left");
          teardown();
        } else {
          removeParticipant(conn.peer);
          if (isHost) broadcastMsg({ type: "peer-left", id: conn.peer });
        }
      });
    }

    function linkTo(peerInst: Peer, id: string) {
      if (!stream) return;
      if (!dataConns.has(id)) wireData(peerInst.connect(id));
      if (!calls.has(id)) wireCall(peerInst.call(id, stream));
    }

    function handleMessage(fromId: string, msg: WireMsg) {
      const peerInst = peerRef.current;
      switch (msg.type) {
        case "accepted": {
          setStatus("connecting");
          if (stream && peerInst) wireCall(peerInst.call(fromId, stream));
          break;
        }
        case "room-full":
          setStatus("full");
          teardown();
          break;
        case "peer-joined":
          if (peerInst && msg.id !== peerInst.id) linkTo(peerInst, msg.id);
          break;
        case "peer-left":
          removeParticipant(msg.id);
          break;
        case "chat":
          setMessages((m) => [
            ...m,
            { id: crypto.randomUUID(), from: fromId, fromLabel: shortLabel(fromId), text: msg.text, time: Date.now() },
          ]);
          break;
        case "media-state":
          upsertParticipant(fromId, { micOn: msg.micOn, camOn: msg.camOn });
          break;
      }
    }

    function teardown() {
      try {
        calls.forEach((c) => c.close());
        dataConns.forEach((c) => c.close());
      } catch {
        /* already torn down */
      }
      calls.clear();
      dataConns.clear();
      stream?.getTracks().forEach((t) => t.stop());
      try {
        peerRef.current?.destroy();
      } catch {
        /* already destroyed */
      }
    }

    (async () => {
      try {
        const { default: PeerCtor } = await import("peerjs");
        const media = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720 },
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        if (cancelled) {
          media.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = media;
        localStreamRef.current = media;
        cameraTrackRef.current = media.getVideoTracks()[0] ?? null;
        setLocalStream(media);

        const peerOpts = { debug: 0, config: { iceServers: ICE_SERVERS } };
        const peer = isHost ? new PeerCtor(roomCode, peerOpts) : new PeerCtor(peerOpts);
        peerRef.current = peer;

        peer.on("open", () => {
          if (cancelled) return;
          if (isHost) {
            setStatus("waiting");
          } else {
            setStatus("connecting");
            wireData(peer.connect(roomCode));
          }
        });

        // Someone is opening a data channel to us.
        peer.on("connection", (conn) => {
          if (!isHost) {
            wireData(conn);
            return;
          }
          // Only the host gatekeeps room size.
          if (dataConns.size >= MAX_PARTICIPANTS - 1) {
            conn.on("open", () => {
              conn.send({ type: "room-full" } satisfies WireMsg);
              setTimeout(() => conn.close(), 300);
            });
            return;
          }
          conn.on("open", () => {
            wireData(conn);
            conn.send({ type: "accepted" } satisfies WireMsg);
            dataConns.forEach((c, id) => {
              if (id !== conn.peer) c.send({ type: "peer-joined", id: conn.peer } satisfies WireMsg);
            });
          });
        });

        peer.on("call", (call) => {
          if (!stream) return;
          call.answer(stream);
          wireCall(call);
        });

        peer.on("error", (err) => {
          if (cancelled) return;
          const type = (err as unknown as { type: string }).type;
          if (type === "unavailable-id") {
            setError("That room code is already active. Try creating a new meeting.");
          } else if (type === "peer-unavailable") {
            setError("No meeting found with that code. Check it and try again.");
          } else {
            setError("Couldn't establish a secure connection.");
          }
          setStatus("error");
        });
      } catch {
        if (!cancelled) {
          setError("Camera or microphone access was denied.");
          setStatus("error");
        }
      }
    })();

    return () => {
      cancelled = true;
      teardown();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, isHost, upsertParticipant, removeParticipant, broadcastMsg]);

  const toggleMic = useCallback(() => {
    const next = !micOn;
    localStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = next));
    setMicOn(next);
    broadcastMsg({ type: "media-state", micOn: next, camOn });
  }, [micOn, camOn, broadcastMsg]);

  const toggleCam = useCallback(() => {
    const next = !camOn;
    localStreamRef.current?.getVideoTracks().forEach((t) => (t.enabled = next));
    setCamOn(next);
    broadcastMsg({ type: "media-state", micOn, camOn: next });
  }, [micOn, camOn, broadcastMsg]);

  const toggleScreenShare = useCallback(async () => {
    const senders = Array.from(callsRef.current.values())
      .map((call) => call.peerConnection?.getSenders().find((s) => s.track?.kind === "video"))
      .filter((s): s is RTCRtpSender => Boolean(s));
    if (senders.length === 0) return;

    if (!screenSharing) {
      try {
        const display = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = display.getVideoTracks()[0];
        await Promise.all(senders.map((s) => s.replaceTrack(screenTrack)));
        screenTrack.onended = () => toggleScreenShare();
        setScreenSharing(true);
      } catch {
        /* user cancelled the share picker */
      }
    } else if (cameraTrackRef.current) {
      await Promise.all(senders.map((s) => s.replaceTrack(cameraTrackRef.current)));
      setScreenSharing(false);
    }
  }, [screenSharing]);

  const sendMessage = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      broadcastMsg({ type: "chat", text });
      setMessages((m) => [...m, { id: crypto.randomUUID(), from: "me", fromLabel: "You", text, time: Date.now() }]);
    },
    [broadcastMsg]
  );

  const leave = useCallback(() => {
    callsRef.current.forEach((c) => c.close());
    dataConnsRef.current.forEach((c) => c.close());
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    try {
      peerRef.current?.destroy();
    } catch {
      /* already destroyed */
    }
    setStatus("left");
  }, []);

  return {
    localStream,
    participants: Array.from(participants.values()),
    status,
    error,
    micOn,
    camOn,
    screenSharing,
    messages,
    toggleMic,
    toggleCam,
    toggleScreenShare,
    sendMessage,
    leave,
  };
}

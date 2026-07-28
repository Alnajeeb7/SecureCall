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
  name: string;
};

export type CallStatus =
  | "idle"
  | "waiting" // host is up, waiting for the first guest
  | "connecting"
  | "connected"
  | "full" // room was at capacity when we tried to join
  | "left"
  | "error"
  | "slow"; // still trying after a while — likely a tough NAT, waiting on TURN

type WireMsg =
  | { type: "accepted" }
  | { type: "room-full" }
  | { type: "peer-joined"; id: string }
  | { type: "peer-left"; id: string }
  | { type: "chat"; text: string }
  | { type: "media-state"; micOn: boolean; camOn: boolean }
  | { type: "identity"; name: string };

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
export function useCallSecure(roomCode: string, isHost: boolean, displayName: string) {
  const myName = displayName.trim().slice(0, 24) || "Guest";
  const peerRef = useRef<Peer | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null);
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);
  const dataConnsRef = useRef<Map<string, DataConnection>>(new Map());
  const callsRef = useRef<Map<string, MediaConnection>>(new Map());
  const namesRef = useRef<Map<string, string>>(new Map());

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [participants, setParticipants] = useState<Map<string, Participant>>(new Map());
  const [status, setStatus] = useState<CallStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [lowBandwidth, setLowBandwidth] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // If we've been stuck on "connecting" for a while, let the UI reassure the
  // user instead of looking frozen — this is common on tough international
  // routes where the call has to fall back to relaying through TURN.
  useEffect(() => {
    if (status !== "connecting") return;
    const t = setTimeout(() => {
      setStatus((s) => (s === "connecting" ? "slow" : s));
    }, 8000);
    return () => clearTimeout(t);
  }, [status]);

  const upsertParticipant = useCallback((id: string, patch: Partial<Participant>) => {
    setParticipants((prev) => {
      const next = new Map(prev);
      const existing = next.get(id) ?? { id, stream: null, micOn: true, camOn: true, name: shortLabel(id) };
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
    namesRef.current.delete(id);
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

    /**
     * Applied the moment any call (host<->guest or guest<->guest) is
     * established. Two problems, one shared cause: with no explicit
     * encoding parameters, the browser defaults to sending video as fast/
     * high-res as it thinks the link allows, which on a constrained or
     * long-distance connection means video traffic crowds out the much
     * smaller, latency-sensitive audio stream — audio's jitter buffer
     * starves first and goes silent while video merely gets choppy. Capping
     * video's bitrate and explicitly marking audio as high priority keeps
     * both flowing smoothly on the same constrained link instead of video
     * silently winning the contest every time.
     */
    async function applyRealtimeEncodingDefaults(pc: RTCPeerConnection) {
      for (const sender of pc.getSenders()) {
        if (!sender.track) continue;
        try {
          const params = sender.getParameters();
          if (!params.encodings?.length) params.encodings = [{}];
          if (sender.track.kind === "audio") {
            params.encodings[0].priority = "high";
            params.encodings[0].networkPriority = "high";
          } else if (sender.track.kind === "video") {
            params.encodings[0].maxBitrate = 900_000;
            params.degradationPreference = "maintain-framerate";
          }
          await sender.setParameters(params);
        } catch {
          /* not every browser/track combo allows every param — safe to skip */
        }
      }
    }

    function wireCall(call: MediaConnection) {
      calls.set(call.peer, call);
      // If we're already screen sharing when this call connects (e.g. we
      // started sharing while alone, then someone joined), give them the
      // screen track right away instead of the camera.
      if (screenTrackRef.current) {
        const sender = call.peerConnection?.getSenders().find((s) => s.track?.kind === "video");
        sender?.replaceTrack(screenTrackRef.current).catch(() => {});
      }
      if (call.peerConnection) applyRealtimeEncodingDefaults(call.peerConnection);
      call.on("stream", (remote) => {
        // eslint-disable-next-line no-console
        console.log(
          `[CallSecure] Remote stream from ${call.peer.slice(-4)} — audio tracks:`,
          remote.getAudioTracks().length,
          "video tracks:",
          remote.getVideoTracks().length
        );
        upsertParticipant(call.peer, { stream: remote });
        markConnected();
      });
      call.on("close", () => removeParticipant(call.peer));

      // A transient network blip (WiFi hand-off, brief carrier drop, etc.)
      // moves the underlying RTCPeerConnection to "disconnected" rather than
      // tearing it down outright. Left alone this often stays broken even
      // after the network recovers; an ICE restart renegotiates fresh
      // candidates on the existing connection and reliably recovers audio
      // and video together instead of requiring a full rejoin.
      const pc = call.peerConnection;
      if (pc) {
        pc.oniceconnectionstatechange = () => {
          // eslint-disable-next-line no-console
          console.log(`[CallSecure] ICE state with ${call.peer.slice(-4)}:`, pc.iceConnectionState);
          if (pc.iceConnectionState === "disconnected") {
            setTimeout(() => {
              if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed") {
                pc.restartIce?.();
              }
            }, 2000);
          } else if (pc.iceConnectionState === "failed") {
            pc.restartIce?.();
          }
        };
      }
    }

    function wireData(conn: DataConnection) {
      dataConns.set(conn.peer, conn);
      const sendIdentity = () => conn.send({ type: "identity", name: myName } satisfies WireMsg);
      // PeerJS only fires "open" once; if we're wiring a connection that's
      // already open (e.g. the host wires it inside its own "open" handler),
      // send right away instead of waiting for an event that already fired.
      if (conn.open) sendIdentity();
      else conn.on("open", sendIdentity);
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
        case "chat": {
          const knownName = namesRef.current.get(fromId) ?? shortLabel(fromId);
          setMessages((m) => [
            ...m,
            { id: crypto.randomUUID(), from: fromId, fromLabel: knownName, text: msg.text, time: Date.now() },
          ]);
          break;
        }
        case "media-state":
          upsertParticipant(fromId, { micOn: msg.micOn, camOn: msg.camOn });
          break;
        case "identity": {
          const cleanName = msg.name.trim().slice(0, 24) || shortLabel(fromId);
          namesRef.current.set(fromId, cleanName);
          upsertParticipant(fromId, { name: cleanName });
          break;
        }
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
      screenTrackRef.current?.stop();
      screenTrackRef.current = null;
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
          video: { width: { ideal: 960 }, height: { ideal: 540 }, frameRate: { ideal: 24 } },
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

        if (media.getAudioTracks().length === 0) {
          // Some OS/browser combinations (e.g. a virtual camera app that
          // grabs video-only permission, or a muted-by-OS mic) can return a
          // stream with no audio track at all, with getUserMedia never
          // throwing. Every subsequent call would then be silent on this
          // person's end no matter what the WebRTC layer does — surface it
          // immediately instead of it looking like a mystery "one-way audio"
          // bug for the other participants.
          setError(
            "No microphone audio was detected. Check that a microphone is connected and not disabled at the system level, then reload."
          );
        }

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

        // The signaling connection (to the PeerJS broker) is separate from
        // the actual peer-to-peer media — losing it doesn't drop an
        // in-progress call, but it does mean no one new can join or
        // renegotiate until it's back. Reconnect automatically instead of
        // leaving the room silently un-joinable after a network blip.
        peer.on("disconnected", () => {
          if (!cancelled) peer.reconnect();
        });

        peer.on("error", (err) => {
          if (cancelled) return;
          const type = (err as unknown as { type: string }).type;
          if (type === "unavailable-id") {
            setError("That room code is already active. Try creating a new meeting.");
          } else if (type === "peer-unavailable") {
            setError("No meeting found with that code. Check it and try again.");
          } else {
            setError(
              "Couldn't establish a secure connection. This can happen on restrictive networks — try switching from WiFi to mobile data (or vice versa) and rejoin with the same code."
            );
          }
          setStatus("error");
        });
      } catch {
        if (!cancelled) {
          setError(
            "We couldn't access your camera or microphone. Click the camera icon in your browser's address bar and choose \"Allow,\" then reload this page."
          );
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

  // iOS Safari (and therefore every browser on iPhone/iPad, since they all
  // must use WebKit under the hood) doesn't implement getDisplayMedia() at
  // all — there's no polyfill for a capability the OS/browser doesn't
  // expose. Android support also varies a lot by browser/version. Detect it
  // up front so the UI can say so honestly instead of a button that
  // silently does nothing when tapped.
  const screenShareSupported =
    typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getDisplayMedia === "function";

  const toggleScreenShare = useCallback(async () => {
    if (!screenShareSupported) {
      setError(
        "Screen sharing isn't supported by this browser — this is a limitation of mobile browsers themselves (Safari on iOS doesn't expose it at all), not something an update can add. Try from a desktop browser instead."
      );
      return;
    }

    const senders = Array.from(callsRef.current.values())
      .map((call) => call.peerConnection?.getSenders().find((s) => s.track?.kind === "video"))
      .filter((s): s is RTCRtpSender => Boolean(s));

    if (!screenSharing) {
      try {
        const display = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = display.getVideoTracks()[0];
        screenTrackRef.current = screenTrack;
        // No one may be connected yet (e.g. sharing while waiting for
        // guests) — that's fine, wireCall() applies this track the moment
        // someone does connect.
        await Promise.all(senders.map((s) => s.replaceTrack(screenTrack)));
        screenTrack.onended = () => toggleScreenShare();
        setScreenSharing(true);
      } catch {
        /* user cancelled the share picker */
      }
    } else if (cameraTrackRef.current) {
      screenTrackRef.current = null;
      await Promise.all(senders.map((s) => s.replaceTrack(cameraTrackRef.current!)));
      setScreenSharing(false);
    }
  }, [screenSharing, screenShareSupported]);

  /**
   * Weaker or congested links — common on long-distance international
   * routes, especially over mobile data — do better with a lower
   * resolution/bitrate than they do dropping frames at full HD. This caps
   * both the local capture and every outgoing video encoding.
   */
  const toggleLowBandwidth = useCallback(async () => {
    const next = !lowBandwidth;
    setLowBandwidth(next);

    const videoTrack = localStreamRef.current?.getVideoTracks()[0];
    if (videoTrack) {
      try {
        await videoTrack.applyConstraints(
          next
            ? { width: { ideal: 480 }, height: { ideal: 360 }, frameRate: { ideal: 15 } }
            : { width: { ideal: 960 }, height: { ideal: 540 }, frameRate: { ideal: 24 } }
        );
      } catch {
        /* some cameras reject constraint changes mid-stream; safe to ignore */
      }
    }

    const senders = Array.from(callsRef.current.values())
      .map((call) => call.peerConnection?.getSenders().find((s) => s.track?.kind === "video"))
      .filter((s): s is RTCRtpSender => Boolean(s));

    for (const sender of senders) {
      const params = sender.getParameters();
      if (!params.encodings?.length) params.encodings = [{}];
      params.encodings[0].maxBitrate = next ? 250_000 : 2_500_000;
      try {
        await sender.setParameters(params);
      } catch {
        /* not every browser lets encoding params change mid-call */
      }
    }
  }, [lowBandwidth]);

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
    screenTrackRef.current?.stop();
    screenTrackRef.current = null;
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
    screenShareSupported,
    lowBandwidth,
    messages,
    toggleMic,
    toggleCam,
    toggleScreenShare,
    toggleLowBandwidth,
    sendMessage,
    leave,
  };
}

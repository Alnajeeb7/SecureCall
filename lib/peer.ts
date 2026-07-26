"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type Peer from "peerjs";
import type { DataConnection, MediaConnection } from "peerjs";

export type ChatMessage = {
  id: string;
  from: "me" | "peer";
  text: string;
  time: number;
};

export type CallStatus =
  | "idle"
  | "waiting" // host is up, waiting for a guest
  | "connecting"
  | "connected"
  | "left"
  | "error";

/**
 * Peer-to-peer call over WebRTC. The room code IS the host's peer id, so
 * joining is just "dial the code". Media never touches a server — it flows
 * directly, encrypted, between the two browsers (DTLS-SRTP, mandatory in
 * WebRTC). The public PeerJS broker is only used to exchange connection
 * handshakes, never media or chat content.
 */
export function useSecureCall(roomCode: string, isHost: boolean) {
  const peerRef = useRef<Peer | null>(null);
  const callRef = useRef<MediaConnection | null>(null);
  const dataRef = useRef<DataConnection | null>(null);
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState<CallStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const wireDataConnection = useCallback((conn: DataConnection) => {
    dataRef.current = conn;
    conn.on("data", (data) => {
      const d = data as { text: string };
      setMessages((m) => [
        ...m,
        { id: crypto.randomUUID(), from: "peer", text: d.text, time: Date.now() },
      ]);
    });
    conn.on("close", () => setStatus("left"));
  }, []);

  useEffect(() => {
    let cancelled = false;
    let localStreamLocal: MediaStream | null = null;

    (async () => {
      try {
        const { default: PeerCtor } = await import("peerjs");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720 },
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStreamLocal = stream;
        cameraTrackRef.current = stream.getVideoTracks()[0] ?? null;
        setLocalStream(stream);

        const peer = isHost
          ? new PeerCtor(roomCode, { debug: 0 })
          : new PeerCtor({ debug: 0 });
        peerRef.current = peer;

        peer.on("open", () => {
          if (cancelled) return;
          setStatus(isHost ? "waiting" : "connecting");
          if (!isHost) {
            const call = peer.call(roomCode, stream);
            callRef.current = call;
            call.on("stream", (remote) => {
              setRemoteStream(remote);
              setStatus("connected");
            });
            call.on("close", () => setStatus("left"));
            call.on("error", () => setError("Connection lost."));

            const conn = peer.connect(roomCode);
            conn.on("open", () => wireDataConnection(conn));
          }
        });

        peer.on("call", (call) => {
          call.answer(stream);
          callRef.current = call;
          call.on("stream", (remote) => {
            setRemoteStream(remote);
            setStatus("connected");
          });
          call.on("close", () => setStatus("left"));
        });

        peer.on("connection", (conn) => wireDataConnection(conn));

        peer.on("error", (err) => {
          if (cancelled) return;
          if ((err as unknown as { type: string }).type === "unavailable-id") {
            setError("That room code is already active. Try creating a new meeting.");
          } else if ((err as unknown as { type: string }).type === "peer-unavailable") {
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
      localStreamLocal?.getTracks().forEach((t) => t.stop());
      callRef.current?.close();
      dataRef.current?.close();
      peerRef.current?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, isHost]);

  const toggleMic = useCallback(() => {
    setMicOn((on) => {
      localStream?.getAudioTracks().forEach((t) => (t.enabled = !on));
      return !on;
    });
  }, [localStream]);

  const toggleCam = useCallback(() => {
    setCamOn((on) => {
      localStream?.getVideoTracks().forEach((t) => (t.enabled = !on));
      return !on;
    });
  }, [localStream]);

  const toggleScreenShare = useCallback(async () => {
    const sender = callRef.current?.peerConnection
      ?.getSenders()
      .find((s) => s.track?.kind === "video");
    if (!sender) return;

    if (!screenSharing) {
      try {
        const display = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = display.getVideoTracks()[0];
        await sender.replaceTrack(screenTrack);
        screenTrack.onended = () => toggleScreenShare();
        setScreenSharing(true);
      } catch {
        /* user cancelled the share picker */
      }
    } else if (cameraTrackRef.current) {
      await sender.replaceTrack(cameraTrackRef.current);
      setScreenSharing(false);
    }
  }, [screenSharing]);

  const sendMessage = useCallback((text: string) => {
    if (!text.trim()) return;
    dataRef.current?.send({ text });
    setMessages((m) => [
      ...m,
      { id: crypto.randomUUID(), from: "me", text, time: Date.now() },
    ]);
  }, []);

  const leave = useCallback(() => {
    callRef.current?.close();
    dataRef.current?.close();
    localStream?.getTracks().forEach((t) => t.stop());
    peerRef.current?.destroy();
    setStatus("left");
  }, [localStream]);

  return {
    localStream,
    remoteStream,
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

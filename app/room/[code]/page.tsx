"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Lock, Copy, Check, ShieldAlert } from "lucide-react";
import { useSecureCall } from "@/lib/peer";
import VideoTile from "@/components/VideoTile";
import Controls from "@/components/Controls";
import Chat from "@/components/Chat";

export default function RoomPage() {
  const { code } = useParams<{ code: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const isHost = search.get("host") === "1";
  const [chatOpen, setChatOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const {
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
  } = useSecureCall(code, isHost);

  function handleLeave() {
    leave();
    router.push("/");
  }

  function copyLink() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  if (status === "error") {
    return (
      <Centered>
        <ShieldAlert size={28} className="text-alert mb-4" />
        <p className="font-display font-semibold text-lg mb-2">Connection failed</p>
        <p className="text-muted text-sm mb-6 max-w-xs">{error}</p>
        <button
          onClick={() => router.push("/")}
          className="rounded-xl bg-ink text-void font-semibold px-5 py-3"
        >
          Back home
        </button>
      </Centered>
    );
  }

  if (status === "left") {
    return (
      <Centered>
        <Lock size={22} className="text-signal mb-4" />
        <p className="font-display font-semibold text-lg mb-2">Call ended</p>
        <p className="text-muted text-sm mb-6">
          The room is gone. Nothing was recorded or stored.
        </p>
        <button
          onClick={() => router.push("/")}
          className="rounded-xl bg-ink text-void font-semibold px-5 py-3"
        >
          Back home
        </button>
      </Centered>
    );
  }

  if (status === "idle" || status === "connecting" || status === "waiting") {
    return (
      <Centered>
        <div className="w-3 h-3 rounded-full bg-signal animate-blink mb-5" />
        <p className="font-display font-semibold text-lg mb-1">
          {status === "waiting" ? "Waiting for your friend to join" : "Setting up your secure line"}
        </p>
        {status === "waiting" && (
          <button
            onClick={copyLink}
            className="mt-4 flex items-center gap-2 font-mono text-sm tracking-[0.3em] glass rounded-xl px-5 py-3"
          >
            {code}
            {copied ? <Check size={14} className="text-secure" /> : <Copy size={14} className="text-muted" />}
          </button>
        )}
        <p className="text-muted text-xs mt-5 max-w-xs">
          Share this code with the person you want to talk to. The call starts
          the instant they enter it.
        </p>
      </Centered>
    );
  }

  return (
    <main className="min-h-screen flex flex-col p-4 md:p-6 gap-4">
      <header className="flex items-center gap-2 text-xs text-secure font-mono tracking-widest">
        <Lock size={12} />
        ENCRYPTED · PEER-TO-PEER
      </header>

      <div className="flex-1 flex flex-col md:flex-row gap-4 min-h-0">
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 min-h-0">
          <VideoTile stream={remoteStream} label="Guest" micOn />
          <VideoTile stream={localStream} muted isSelf label="You" camOff={!camOn} micOn={micOn} />
        </div>

        {chatOpen && (
          <div className="w-full md:w-80 h-64 md:h-auto shrink-0">
            <Chat messages={messages} onSend={sendMessage} />
          </div>
        )}
      </div>

      <Controls
        micOn={micOn}
        camOn={camOn}
        screenSharing={screenSharing}
        onToggleMic={toggleMic}
        onToggleCam={toggleCam}
        onToggleScreen={toggleScreenShare}
        onLeave={handleLeave}
        onToggleChat={() => setChatOpen((v) => !v)}
        chatOpen={chatOpen}
        code={code}
      />
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center text-center px-6">
      {children}
    </main>
  );
}

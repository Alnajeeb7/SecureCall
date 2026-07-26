"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Lock, Copy, Check, ShieldAlert, Users } from "lucide-react";
import { useSecureCall, shortLabel, MAX_PARTICIPANTS } from "@/lib/peer";
import VideoTile from "@/components/VideoTile";
import Controls from "@/components/Controls";
import Chat from "@/components/Chat";
import GithubBadge, { REPO_URL } from "@/components/GithubBadge";

export default function RoomPage() {
  const { code } = useParams<{ code: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const isHost = search.get("host") === "1";
  const [chatOpen, setChatOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const {
    localStream,
    participants,
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

  if (status === "full") {
    return (
      <Centered>
        <Users size={26} className="text-alert mb-4" />
        <p className="font-display font-semibold text-lg mb-2">This room is full</p>
        <p className="text-muted text-sm mb-6 max-w-xs">
          This build caps calls at {MAX_PARTICIPANTS} people to keep every connection
          direct and encrypted. Need more seats for a bigger call?
        </p>
        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl bg-ink text-void font-semibold px-5 py-3 mb-3"
        >
          Contact the maintainer on GitHub
        </a>
        <button onClick={() => router.push("/")} className="text-muted text-sm hover:text-ink transition">
          Back home
        </button>
      </Centered>
    );
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
          {status === "waiting" ? "Waiting for people to join" : "Setting up your secure line"}
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
          Share this code with up to {MAX_PARTICIPANTS - 1} people. The call starts
          the instant the first one enters it.
        </p>
      </Centered>
    );
  }

  const total = participants.length + 1;
  const gridCols = total <= 2 ? "sm:grid-cols-2" : total <= 4 ? "sm:grid-cols-2" : "sm:grid-cols-3";

  return (
    <main className="min-h-screen flex flex-col p-4 md:p-6 gap-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <GithubBadge />
          <span className="flex items-center gap-2 text-xs text-secure font-mono tracking-widest">
            <Lock size={12} />
            ENCRYPTED · PEER-TO-PEER
          </span>
        </div>
        <span className="flex items-center gap-1.5 text-xs text-muted font-mono">
          <Users size={13} />
          {total}/{MAX_PARTICIPANTS}
        </span>
      </header>

      <div className="flex-1 flex flex-col md:flex-row gap-4 min-h-0">
        <div className={`flex-1 grid grid-cols-1 ${gridCols} gap-4 min-h-0 auto-rows-fr`}>
          {participants.map((p) => (
            <VideoTile
              key={p.id}
              stream={p.stream}
              label={shortLabel(p.id)}
              camOff={!p.camOn}
              micOn={p.micOn}
            />
          ))}
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

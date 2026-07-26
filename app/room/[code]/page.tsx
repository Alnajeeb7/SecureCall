"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Lock, Copy, Check, ShieldAlert, Users, ArrowRight, Video } from "lucide-react";
import { useCallSecure, MAX_PARTICIPANTS } from "@/lib/peer";
import VideoTile from "@/components/VideoTile";
import Controls from "@/components/Controls";
import Chat from "@/components/Chat";
import GithubBadge, { REPO_URL } from "@/components/GithubBadge";

const NAME_KEY = "callsecure:name";

export default function RoomPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const [name, setName] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");

  // Remember the last name used on this device so returning users
  // don't have to retype it every call.
  useEffect(() => {
    const saved = typeof window !== "undefined" ? sessionStorage.getItem(NAME_KEY) : null;
    if (saved) setNameInput(saved);
  }, []);

  if (!name) {
    return (
      <Centered>
        <div className="glass rounded-2xl p-6 w-full max-w-sm">
          <Video size={22} className="text-signal mb-4 mx-auto" />
          <p className="font-display font-semibold text-lg mb-1">Before you join</p>
          <p className="text-muted text-sm mb-5">
            What should the other person call you? Only shown for this call.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const clean = nameInput.trim().slice(0, 24);
              if (!clean) return;
              sessionStorage.setItem(NAME_KEY, clean);
              setName(clean);
            }}
            className="space-y-3"
          >
            <input
              autoFocus
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Your name"
              maxLength={24}
              className="w-full bg-white/5 border border-border rounded-xl px-4 py-3 text-center outline-none focus:border-signal transition"
            />
            <button
              type="submit"
              disabled={!nameInput.trim()}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-ink text-void font-semibold px-5 py-3 hover:opacity-90 transition disabled:opacity-40 disabled:pointer-events-none"
            >
              Join call
              <ArrowRight size={16} />
            </button>
          </form>
          <button onClick={() => router.push("/")} className="text-muted text-xs mt-4 hover:text-ink transition">
            Back home
          </button>
        </div>
      </Centered>
    );
  }

  return <RoomInner code={code} name={name} />;
}

function RoomInner({ code, name }: { code: string; name: string }) {
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
    lowBandwidth,
    messages,
    toggleMic,
    toggleCam,
    toggleScreenShare,
    toggleLowBandwidth,
    sendMessage,
    leave,
  } = useCallSecure(code, isHost, name);

  function handleLeave() {
    leave();
    router.push("/");
  }

  function copyLink() {
    const url = `${window.location.origin}/room/${code}`;
    navigator.clipboard.writeText(url);
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

  if (status === "idle" || status === "connecting" || status === "waiting" || status === "slow") {
    return (
      <Centered>
        <div className="w-3 h-3 rounded-full bg-signal animate-blink mb-5" />
        <p className="font-display font-semibold text-lg mb-1">
          {status === "waiting"
            ? "Waiting for people to join"
            : status === "slow"
            ? "Still connecting…"
            : "Setting up your secure line"}
        </p>
        {status === "slow" && (
          <p className="text-muted text-xs max-w-xs mb-2">
            This can take a little longer across countries or on mobile networks
            while we find the best route. Hang tight.
          </p>
        )}
        {status === "waiting" && (
          <button
            onClick={copyLink}
            className="mt-4 flex items-center gap-2 font-mono text-sm glass rounded-xl px-5 py-3"
          >
            <span className="tracking-[0.2em]">{code}</span>
            <span className="text-muted text-xs font-sans">
              {copied ? "Link copied" : "Copy link"}
            </span>
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
              label={p.name}
              camOff={!p.camOn}
              micOn={p.micOn}
            />
          ))}
          <VideoTile stream={localStream} muted isSelf label={`${name} (You)`} camOff={!camOn} micOn={micOn} />
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
        lowBandwidth={lowBandwidth}
        onToggleMic={toggleMic}
        onToggleCam={toggleCam}
        onToggleScreen={toggleScreenShare}
        onToggleLowBandwidth={toggleLowBandwidth}
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

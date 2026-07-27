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
  const [unreadCount, setUnreadCount] = useState(0);
  const [preview, setPreview] = useState<{ name: string; text: string } | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
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

  // Show a small badge on the chat icon when a message comes in while
  // the panel is closed, instead of it silently piling up unnoticed.
  useEffect(() => {
    if (chatOpen) {
      setUnreadCount(0);
      return;
    }
    if (messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last.from === "me") return;
    setUnreadCount((c) => c + 1);
    setPreview({ name: last.fromLabel, text: last.text });
    const t = setTimeout(() => setPreview(null), 4000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  useEffect(() => {
    if (chatOpen) setUnreadCount(0);
  }, [chatOpen]);

  const [callSeconds, setCallSeconds] = useState(0);
  useEffect(() => {
    if (status !== "connected") return;
    const t = setInterval(() => setCallSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [status]);
  const durationLabel = `${String(Math.floor(callSeconds / 60)).padStart(2, "0")}:${String(callSeconds % 60).padStart(2, "0")}`;

  useEffect(() => {
    if (focusedId && focusedId !== "self" && !participants.some((p) => p.id === focusedId)) {
      setFocusedId(null);
    }
  }, [participants, focusedId]);

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

  // Per-count templates match the "Google Meet / Zoom" spec exactly for the
  // common cases (1 full-bleed, 2 side-by-side, 4 a clean 2x2); 5-8 falls
  // back to an auto-fit wrap grid that keeps tiles from shrinking below a
  // usable size, and anything larger switches to a horizontally scrollable
  // strip (see below) rather than continuing to shrink tiles.
  const gridClass =
    total === 1
      ? "grid-cols-1"
      : total === 2
      ? "grid-cols-1 sm:grid-cols-2"
      : total === 3
      ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
      : total === 4
      ? "grid-cols-2"
      : "grid-cols-[repeat(auto-fit,minmax(180px,1fr))]";

  const useScrollStrip = total > 8;

  type Tile = { id: string; stream: MediaStream | null; label: string; camOff: boolean; micOn: boolean; isSelf?: boolean };
  const tiles: Tile[] = [
    ...participants.map((p) => ({ id: p.id, stream: p.stream, label: p.name, camOff: !p.camOn, micOn: p.micOn })),
    { id: "self", stream: localStream, label: `${name} (You)`, camOff: !camOn, micOn, isSelf: true },
  ];
  const focused = focusedId ? tiles.find((t) => t.id === focusedId) : null;
  const others = focused ? tiles.filter((t) => t.id !== focused.id) : [];

  function toggleFocus(id: string) {
    setFocusedId((current) => (current === id ? null : id));
  }

  return (
    <main className="h-dvh overflow-hidden flex flex-col p-4 md:p-6 gap-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <GithubBadge />
          <span className="flex items-center gap-2 text-xs text-secure font-mono tracking-widest">
            <Lock size={12} />
            ENCRYPTED · PEER-TO-PEER
          </span>
          <span className="hidden sm:inline text-xs text-muted font-mono">{durationLabel}</span>
        </div>
        <span className="flex items-center gap-1.5 text-xs text-muted font-mono">
          <Users size={13} />
          {total}/{MAX_PARTICIPANTS}
        </span>
      </header>

      {error && (
        <div className="flex items-center gap-2 text-xs text-alert bg-alert/10 border border-alert/20 rounded-xl px-4 py-2">
          <ShieldAlert size={14} className="shrink-0" />
          {error}
        </div>
      )}

      <div className="flex-1 flex flex-col md:flex-row gap-4 min-h-0">
        {focused ? (
          // In-app focus mode: the selected tile fills most of the space,
          // everyone else becomes a thumbnail strip. Nothing here calls the
          // Fullscreen API — it's plain layout/CSS, so meeting controls,
          // chat, and the header stay visible and interactive throughout.
          <div className="flex-1 flex flex-col gap-3 min-h-0">
            <div className="flex-1 min-h-0 transition-all duration-300">
              <VideoTile
                stream={focused.stream}
                muted={focused.isSelf}
                isSelf={focused.isSelf}
                label={focused.label}
                camOff={focused.camOff}
                micOn={focused.micOn}
                isFocused
                onToggleFocus={() => toggleFocus(focused.id)}
              />
            </div>
            <div className="h-24 md:h-28 shrink-0 flex gap-2 overflow-x-auto snap-x snap-mandatory pb-1">
              {others.map((t) => (
                <div key={t.id} className="w-32 md:w-40 aspect-video shrink-0 snap-start">
                  <VideoTile
                    stream={t.stream}
                    muted={t.isSelf}
                    isSelf={t.isSelf}
                    label={t.label}
                    camOff={t.camOff}
                    micOn={t.micOn}
                    onToggleFocus={() => toggleFocus(t.id)}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : useScrollStrip ? (
          // Beyond ~8 people, tiles stop shrinking and the row scrolls
          // horizontally instead — keeps every tile at a readable size.
          <div className="flex-1 flex gap-3 overflow-x-auto snap-x snap-mandatory min-h-0 pb-1">
            {tiles.map((t) => (
              <div key={t.id} className="w-64 md:w-72 shrink-0 snap-start">
                <VideoTile
                  stream={t.stream}
                  muted={t.isSelf}
                  isSelf={t.isSelf}
                  label={t.label}
                  camOff={t.camOff}
                  micOn={t.micOn}
                  onToggleFocus={() => toggleFocus(t.id)}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className={`flex-1 grid ${gridClass} gap-4 min-h-0 auto-rows-fr overflow-y-auto`}>
            {tiles.map((t) => (
              <VideoTile
                key={t.id}
                stream={t.stream}
                muted={t.isSelf}
                isSelf={t.isSelf}
                label={t.label}
                camOff={t.camOff}
                micOn={t.micOn}
                onToggleFocus={() => toggleFocus(t.id)}
              />
            ))}
          </div>
        )}

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
        unreadCount={unreadCount}
        preview={preview}
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

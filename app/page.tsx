"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Lock, ShieldCheck, EyeOff, Trash2, ArrowRight, Link2 } from "lucide-react";
import SecureTunnel from "@/components/SecureTunnel";
import GithubBadge from "@/components/GithubBadge";
import { generateRoomCode, formatCode, slugify, isValidSlug } from "@/lib/code";
import { MAX_PARTICIPANTS } from "@/lib/peer";

export default function Home() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [customSlug, setCustomSlug] = useState("");
  const [customError, setCustomError] = useState<string | null>(null);

  function createMeeting() {
    const code = generateRoomCode();
    router.push(`/room/${code}?host=1`);
  }

  function createCustomMeeting(e: React.FormEvent) {
    e.preventDefault();
    const clean = slugify(customSlug);
    if (!isValidSlug(clean)) {
      setCustomError("Use 4-32 letters, numbers, or hyphens — e.g. team-standup.");
      return;
    }
    router.push(`/room/${clean}?host=1&custom=1`);
  }

  function joinMeeting(e: React.FormEvent) {
    e.preventDefault();
    const raw = joinCode.trim();
    // A custom link looks like "team-standup"; a generated code is 6
    // characters. Only force-format (uppercase, strip symbols) when it
    // looks like the latter, so custom links aren't mangled.
    const looksLikeSlug = raw.includes("-") || (isValidSlug(raw.toLowerCase()) && raw.length > 6);
    const clean = looksLikeSlug ? slugify(raw) : formatCode(raw);
    if (!clean || (clean.length < 4)) {
      setJoinError("Enter a 6-character code or a custom link.");
      return;
    }
    router.push(`/room/${clean}`);
  }

  return (
    <main className="min-h-screen flex flex-col">
      <nav className="flex items-center justify-between px-6 md:px-10 py-6">
        <div className="flex items-center gap-3">
          <GithubBadge />
          <div className="flex items-center gap-2">
            <Lock size={16} className="text-signal" />
            <span className="font-display font-bold tracking-tight text-sm">CALLSECURE</span>
          </div>
        </div>
        <span className="hidden sm:block font-mono text-[11px] tracking-[0.15em] text-muted">
          NO ACCOUNTS · NO RECORDINGS
        </span>
      </nav>

      <section className="flex-1 grid md:grid-cols-2 gap-12 items-center px-6 md:px-10 max-w-6xl mx-auto w-full py-10 md:py-0">
        <div className="animate-rise">
          <p className="font-mono text-xs tracking-[0.2em] text-signal mb-5">
            PRIVACY-FIRST VIDEO CALLING
          </p>
          <h1 className="font-display font-bold text-4xl sm:text-5xl leading-[1.05] tracking-tight mb-6">
            One code.
            <br />
            One click.
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-signal to-indigo">
              Instant secure connection.
            </span>
          </h1>
          <p className="text-muted text-base leading-relaxed max-w-md mb-9">
            Start a call and get a 6-character code. Share it however you like.
            The moment your friend enters it, you&rsquo;re connected — directly,
            encrypted, with nothing passing through our servers.
          </p>

          <div className="glass rounded-2xl p-5 max-w-md space-y-4">
            <button
              onClick={createMeeting}
              className="w-full flex items-center justify-between rounded-xl bg-ink text-void font-semibold px-5 py-3.5 hover:opacity-90 transition"
            >
              Create meeting
              <ArrowRight size={18} />
            </button>

            {!customOpen ? (
              <button
                onClick={() => setCustomOpen(true)}
                className="w-full flex items-center justify-center gap-2 text-muted text-xs hover:text-signal transition py-1"
              >
                <Link2 size={13} />
                Use a custom link instead
              </button>
            ) : (
              <form onSubmit={createCustomMeeting} className="space-y-2">
                <div className="flex items-center gap-1 bg-white/5 border border-border rounded-xl px-3 py-2.5 focus-within:border-signal transition">
                  <span className="text-muted text-xs font-mono shrink-0">/room/</span>
                  <input
                    autoFocus
                    value={customSlug}
                    onChange={(e) => {
                      setCustomError(null);
                      setCustomSlug(e.target.value);
                    }}
                    placeholder="team-standup"
                    maxLength={32}
                    className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-muted/50"
                  />
                </div>
                {customError && <p className="text-alert text-xs">{customError}</p>}
                <button
                  type="submit"
                  className="w-full rounded-xl border border-border px-5 py-2.5 text-sm font-semibold hover:border-signal hover:text-signal transition"
                >
                  Create with this link
                </button>
              </form>
            )}

            <div className="flex items-center gap-3 text-muted text-xs">
              <div className="h-px flex-1 bg-border" />
              or join with a code
              <div className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={joinMeeting} className="flex gap-2">
              <input
                value={joinCode}
                onChange={(e) => {
                  setJoinError(null);
                  setJoinCode(e.target.value);
                }}
                placeholder="CODE or custom-link"
                maxLength={32}
                className="flex-1 min-w-0 bg-white/5 border border-border rounded-xl px-4 py-3 font-mono tracking-wide text-center placeholder:text-muted/50 focus:border-signal outline-none transition"
              />
              <button
                type="submit"
                className="rounded-xl border border-border px-5 py-3 font-semibold hover:border-signal hover:text-signal transition"
              >
                Join
              </button>
            </form>
            {joinError && <p className="text-alert text-xs">{joinError}</p>}
            <p className="text-center text-muted text-[11px] font-mono tracking-wide pt-1">
              UP TO {MAX_PARTICIPANTS} PEOPLE PER CALL
            </p>
          </div>
        </div>

        <div className="hidden md:flex flex-col items-center gap-6">
          <SecureTunnel />
          <div className="grid grid-cols-2 gap-3 w-full max-w-md">
            <PrivacyPill icon={<ShieldCheck size={14} />} label="End-to-end encrypted" />
            <PrivacyPill icon={<EyeOff size={14} />} label="No tracking" />
            <PrivacyPill icon={<Lock size={14} />} label="No accounts required" />
            <PrivacyPill icon={<Trash2 size={14} />} label="Room self-destructs" />
          </div>
        </div>
      </section>

      <footer className="px-6 md:px-10 py-6 text-center text-muted text-xs font-mono tracking-wide">
        VIDEO AND AUDIO NEVER TOUCH A SERVER — THEY GO DIRECTLY BETWEEN BROWSERS
      </footer>
    </main>
  );
}

function PrivacyPill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="glass rounded-xl px-3.5 py-2.5 flex items-center gap-2 text-xs text-muted">
      <span className="text-secure">{icon}</span>
      {label}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { MicOff, User, Maximize2, Minimize2, VolumeX } from "lucide-react";

export default function VideoTile({
  stream,
  muted,
  label,
  camOff,
  micOn = true,
  isSelf,
  isFocused,
  onToggleFocus,
}: {
  stream: MediaStream | null;
  muted?: boolean;
  label: string;
  camOff?: boolean;
  micOn?: boolean;
  isSelf?: boolean;
  isFocused?: boolean;
  onToggleFocus?: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [audioBlocked, setAudioBlocked] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = stream;
    if (!stream) return;

    const attempt = el.play();
    if (attempt && typeof attempt.catch === "function") {
      attempt
        .then(() => setAudioBlocked(false))
        .catch(() => setAudioBlocked(true));
    }
  }, [stream]);

  useEffect(() => {
    if (!audioBlocked) return;
    const retry = () => {
      ref.current?.play().then(() => setAudioBlocked(false)).catch(() => {});
    };
    document.addEventListener("pointerdown", retry, { once: true });
    document.addEventListener("keydown", retry, { once: true });
    return () => {
      document.removeEventListener("pointerdown", retry);
      document.removeEventListener("keydown", retry);
    };
  }, [audioBlocked]);

  return (
    <div
      onDoubleClick={onToggleFocus}
      className={`group relative w-full h-full overflow-hidden glass rounded-2xl transition-all duration-300 ${
        isFocused ? "ring-2 ring-signal/60" : ""
      }`}
    >
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={muted}
        className={`w-full h-full object-cover ${isSelf ? "scale-x-[-1]" : ""} ${
          !stream || camOff ? "hidden" : ""
        }`}
      />

      {(!stream || camOff) && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/[0.02]">
          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
            <User size={26} className="text-muted" />
          </div>
        </div>
      )}

      {audioBlocked && !muted && (
        <button
          onClick={() => ref.current?.play().then(() => setAudioBlocked(false)).catch(() => {})}
          className="absolute inset-0 flex items-center justify-center bg-void/50 backdrop-blur-sm"
        >
          <span className="flex items-center gap-2 glass rounded-full px-4 py-2 text-xs font-medium">
            <VolumeX size={14} />
            Tap to enable sound
          </span>
        </button>
      )}

      <div className="absolute bottom-3 left-3 flex items-center gap-2">
        <span className="glass rounded-full px-3 py-1 text-xs font-medium">{label}</span>
        {!micOn && (
          <span className="glass rounded-full p-1.5 text-alert">
            <MicOff size={12} />
          </span>
        )}
      </div>

      {onToggleFocus && (
        <button
          onClick={onToggleFocus}
          title={isFocused ? "Exit focus view" : "Focus this participant (or double-tap the video)"}
          aria-label={isFocused ? "Exit focus view" : "Focus this participant"}
          className="absolute top-3 right-3 glass rounded-full p-1.5 text-muted hover:text-ink opacity-0 group-hover:opacity-100 focus:opacity-100 transition"
        >
          {isFocused ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
        </button>
      )}
    </div>
  );
}

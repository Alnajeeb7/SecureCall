"use client";

import { useEffect, useRef, useState } from "react";
import { MicOff, User, Maximize2, Minimize2 } from "lucide-react";

export default function VideoTile({
  stream,
  muted,
  label,
  camOff,
  micOn = true,
  isSelf,
}: {
  stream: MediaStream | null;
  muted?: boolean;
  label: string;
  camOff?: boolean;
  micOn?: boolean;
  isSelf?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);

  // Double-tap (touch) / double-click toggles this one tile to fullscreen —
  // handy for focusing on whoever's screen-sharing or speaking without
  // hunting for a separate "pin" control.
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  function toggleFullscreen() {
    if (!containerRef.current) return;
    if (document.fullscreenElement === containerRef.current) {
      document.exitFullscreen().catch(() => {});
    } else {
      containerRef.current.requestFullscreen?.().catch(() => {});
    }
  }

  return (
    <div
      ref={containerRef}
      onDoubleClick={toggleFullscreen}
      className={`relative w-full h-full overflow-hidden glass ${
        isFullscreen ? "rounded-none bg-void" : "rounded-2xl"
      }`}
    >
      {stream && !camOff ? (
        <video
          ref={ref}
          autoPlay
          playsInline
          muted={muted}
          className={`w-full h-full ${isFullscreen ? "object-contain" : ""} ${isSelf ? "scale-x-[-1]" : ""}`}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-white/[0.02]">
          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
            <User size={26} className="text-muted" />
          </div>
        </div>
      )}

      <div className="absolute bottom-3 left-3 flex items-center gap-2">
        <span className="glass rounded-full px-3 py-1 text-xs font-medium">{label}</span>
        {!micOn && (
          <span className="glass rounded-full p-1.5 text-alert">
            <MicOff size={12} />
          </span>
        )}
      </div>

      <button
        onClick={toggleFullscreen}
        title={isFullscreen ? "Exit full screen" : "Full screen (or double-tap the video)"}
        aria-label={isFullscreen ? "Exit full screen" : "Full screen"}
        className="absolute top-3 right-3 glass rounded-full p-1.5 text-muted hover:text-ink opacity-0 hover:opacity-100 focus:opacity-100 transition"
      >
        {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
      </button>
    </div>
  );
}

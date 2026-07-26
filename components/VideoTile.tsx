"use client";

import { useEffect, useRef } from "react";
import { MicOff, User } from "lucide-react";

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

  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden glass">
      {stream && !camOff ? (
        <video
          ref={ref}
          autoPlay
          playsInline
          muted={muted}
          className={`w-full h-full ${isSelf ? "scale-x-[-1]" : ""}`}
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
    </div>
  );
}

"use client";

import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  ScreenShare,
  PhoneOff,
  MessageSquare,
  Copy,
  Check,
} from "lucide-react";
import { useState } from "react";

export default function Controls({
  micOn,
  camOn,
  screenSharing,
  onToggleMic,
  onToggleCam,
  onToggleScreen,
  onLeave,
  onToggleChat,
  chatOpen,
  code,
}: {
  micOn: boolean;
  camOn: boolean;
  screenSharing: boolean;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onToggleScreen: () => void;
  onLeave: () => void;
  onToggleChat: () => void;
  chatOpen: boolean;
  code: string;
}) {
  const [copied, setCopied] = useState(false);

  function copyCode() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 glass rounded-2xl">
      <button
        onClick={copyCode}
        className="hidden sm:flex items-center gap-2 font-mono text-sm tracking-[0.2em] px-3 py-2 rounded-xl hover:bg-white/5 transition"
        title="Copy room code"
      >
        {code}
        {copied ? <Check size={14} className="text-secure" /> : <Copy size={14} className="text-muted" />}
      </button>

      <div className="flex items-center gap-2 mx-auto sm:mx-0">
        <IconButton onClick={onToggleMic} active={micOn} label={micOn ? "Mute" : "Unmute"}>
          {micOn ? <Mic size={18} /> : <MicOff size={18} />}
        </IconButton>
        <IconButton onClick={onToggleCam} active={camOn} label={camOn ? "Turn off camera" : "Turn on camera"}>
          {camOn ? <Video size={18} /> : <VideoOff size={18} />}
        </IconButton>
        <IconButton onClick={onToggleScreen} active={screenSharing} label="Share screen">
          <ScreenShare size={18} />
        </IconButton>
        <IconButton onClick={onToggleChat} active={chatOpen} label="Chat">
          <MessageSquare size={18} />
        </IconButton>
        <button
          onClick={onLeave}
          className="flex items-center justify-center w-11 h-11 rounded-full bg-alert text-white hover:opacity-90 transition"
          title="Leave call"
        >
          <PhoneOff size={18} />
        </button>
      </div>

      <div className="hidden sm:block w-[88px]" />
    </div>
  );
}

function IconButton({
  children,
  onClick,
  active,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`flex items-center justify-center w-11 h-11 rounded-full transition ${
        active ? "bg-white/10 text-ink" : "bg-alert/20 text-alert"
      } hover:bg-white/15`}
    >
      {children}
    </button>
  );
}

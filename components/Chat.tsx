"use client";

import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";
import type { ChatMessage } from "@/lib/peer";

export default function Chat({
  messages,
  onSend,
}: {
  messages: ChatMessage[];
  onSend: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    onSend(text);
    setText("");
  }

  return (
    <div className="flex flex-col h-full glass rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border text-sm font-semibold">
        Chat
        <span className="ml-2 text-muted font-normal text-xs">not stored, cleared on leave</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
        {messages.length === 0 && (
          <p className="text-muted text-xs text-center mt-6">
            Messages travel the same encrypted link as your call.
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
            <span
              className={`max-w-[80%] rounded-xl px-3 py-2 text-sm break-words ${
                m.from === "me" ? "bg-signal text-void" : "bg-white/8 text-ink"
              }`}
            >
              {m.text}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={submit} className="p-3 border-t border-border flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message"
          className="flex-1 min-w-0 bg-white/5 border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-signal transition"
        />
        <button
          type="submit"
          className="w-10 h-10 shrink-0 rounded-xl bg-signal text-void flex items-center justify-center hover:opacity-90 transition"
          aria-label="Send"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}

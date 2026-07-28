"use client";

/**
 * Mobile Safari and many Android browsers are stricter than desktop about
 * autoplaying audio: a page-wide click/keydown often isn't enough on its
 * own, especially for <video>/<audio> elements created well after the fact
 * by WebRTC once a remote stream arrives. The reliable fix is to "prime"
 * audio playback at the exact moment of a real, guaranteed user tap —
 * before any call machinery starts — using a near-silent clip. Once one
 * real HTMLMediaElement has successfully played during a genuine user
 * gesture, the browser treats the page as having audio permission for the
 * rest of the session, including elements created later.
 */
export function unlockAudioPlayback() {
  try {
    const el = document.createElement("audio");
    // A ~0.1s silent WAV, inlined so this needs no network request.
    el.src =
      "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
    el.volume = 0.01;
    el.play()
      .catch(() => {
        /* if even this is blocked, the per-tile retry-on-tap fallback still applies */
      })
      .finally(() => el.remove());

    // Some Android browsers gate Web Audio specifically rather than
    // HTMLMediaElement — unlock that path too if it's available.
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctx) {
      const ctx = new Ctx();
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      setTimeout(() => ctx.close().catch(() => {}), 1000);
    }
  } catch {
    /* best-effort only — never block the join flow over this */
  }
}

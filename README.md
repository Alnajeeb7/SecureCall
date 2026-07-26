# SecureCall

Privacy-first, peer-to-peer video calling. Create a meeting, get a 6-character
code, share it, connect — no accounts, no recordings, nothing stored.

## How the privacy actually works

- **Video/audio never touch a server.** WebRTC connects the two browsers
  directly and encrypts every packet with **DTLS-SRTP** (mandatory in the
  WebRTC spec, not optional). Even the app's own developer can't see the
  stream.
- **Chat travels the same direct, encrypted channel** (a WebRTC
  `DataChannel`), not a database. Nothing is logged; refreshing or leaving
  clears it.
- **The "signaling" step is the only thing that touches a third party.**
  Before two browsers can talk directly, they need to swap connection
  metadata (like two people agreeing where to meet). This build uses the
  public PeerJS broker for that handshake only — it sees who's connecting to
  whom, never the call content itself. For real production use, self-host
  your own PeerServer (see below) so you don't depend on a third party even
  for that.
- **Room codes are ephemeral.** A code is just a temporary peer ID. It's not
  saved anywhere, isn't guessable in bulk (33-character alphabet, no
  ambiguous characters), and stops working the moment the host leaves.
- **No accounts, no cookies, no analytics** are wired into this build.

### Current limits — read before treating this as production-grade

- **Two-party calls only.** The MVP connects a host + one guest directly.
  Group calls need either a mesh (each participant connects to every other
  participant) or an SFU (a media relay server); the room-code/join flow
  here is designed to extend to either, but it isn't wired up yet.
  Implementer notes are in `lib/peer.ts`.
- **The public PeerJS broker is a shared, free service.** It's fine for a
  personal project or demo; it is a trust dependency you don't control. For
  anything sensitive, run your own PeerServer (`npm i peer`, a few lines to
  self-host) and point `lib/peer.ts` at it via `PeerJS`'s `host`/`port`
  options.
- **No TURN server is configured.** Some networks (strict corporate
  firewalls, some mobile carriers) block direct peer connections and need a
  TURN relay to establish the call at all. Add TURN credentials (e.g. via
  Twilio, Cloudflare, or `coturn` you host yourself) in the `Peer` config in
  `lib/peer.ts` for reliable connectivity everywhere. Note a TURN relay
  necessarily sees encrypted packets pass through it — it can't read them,
  but it's a design tradeoff worth knowing about.
- **File sharing, live captions, virtual backgrounds, reactions, and
  picture-in-picture** from the original feature wishlist aren't built yet —
  the core call, chat, screen share, and controls are.

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind CSS · PeerJS (WebRTC) ·
lucide-react

## Run it locally

```bash
npm install
npm run dev
```

Open two browser windows (or one normal + one incognito) at
`http://localhost:3000` to test a call with yourself.

> This sandbox couldn't fetch Google Fonts to run a full production build
> (no internet access to fonts.googleapis.com from this environment) —
> that's a limitation of where this was built, not the code. It'll build
> fine anywhere with normal internet access, including Vercel.

## Deploy

This is a standard Next.js app — push it to GitHub and import it on
[Vercel](https://vercel.com/new). No environment variables or backend are
required for the MVP (PeerJS's public broker needs no API key). No database,
no server to provision.

## Project structure

```
app/
  page.tsx                 Home: create/join
  room/[code]/page.tsx      Call screen
  layout.tsx, globals.css
components/
  VideoTile.tsx    Controls.tsx    Chat.tsx    SecureTunnel.tsx
lib/
  peer.ts    WebRTC/PeerJS call logic (media, data channel, screen share)
  code.ts    Room code generation/formatting
```

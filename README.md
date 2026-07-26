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

- **Group calls, capped at 5 people (host included).** The app now runs a
  full mesh: everyone connects directly to everyone else, so video/audio
  never touches a server. Mesh doesn't scale gracefully past a handful of
  people (each extra person adds a connection for every existing member),
  which is why 5 is a deliberate ceiling, not an arbitrary one. Someone
  trying to join a full room sees a "This room is full" screen with a link
  to contact the maintainer on GitHub — swap `REPO_URL` in
  `components/GithubBadge.tsx` if you fork this. Raising the cap for real
  scale would mean moving to an SFU (a media relay server) instead of mesh.
- **If the host leaves, the call ends for everyone.** The room code is the
  host's peer id, so the host is the anchor the room is built around.
  Guests leaving just drop out of the mesh; everyone else continues.
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
  icon.svg                 Favicon (auto-detected by Next.js)
components/
  VideoTile.tsx    Controls.tsx    Chat.tsx    SecureTunnel.tsx
  GithubBadge.tsx  Top-left link to this repo — also the "room full" contact
lib/
  peer.ts    WebRTC/PeerJS mesh call logic (media, data channel, screen share, capacity)
  code.ts    Room code generation/formatting
```

## Before you deploy for real

The repo link in `components/GithubBadge.tsx` (`REPO_URL`) is a placeholder
pointing at `github.com/Alnajeeb7/SecureCall` — update it once you know which
account/URL your fork actually lives at, so the "room full" contact link and
the header GitHub icon point somewhere real.

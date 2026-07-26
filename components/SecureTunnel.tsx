export default function SecureTunnel() {
  return (
    <svg
      viewBox="0 0 480 280"
      className="w-full max-w-md mx-auto"
      role="img"
      aria-label="Diagram of two devices connected by an encrypted peer-to-peer tunnel"
    >
      <defs>
        <linearGradient id="tunnelGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#4CE0D2" />
          <stop offset="100%" stopColor="#5B6EF5" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* nodes */}
      <g>
        <rect x="30" y="105" width="70" height="70" rx="16" className="fill-white/5 stroke-white/10" strokeWidth="1" />
        <rect x="41" y="122" width="48" height="36" rx="4" fill="none" stroke="#8891A0" strokeWidth="1.5" />
        <circle cx="65" cy="140" r="6" fill="none" stroke="#8891A0" strokeWidth="1.5" />
      </g>
      <g>
        <rect x="380" y="105" width="70" height="70" rx="16" className="fill-white/5 stroke-white/10" strokeWidth="1" />
        <rect x="391" y="122" width="48" height="36" rx="4" fill="none" stroke="#8891A0" strokeWidth="1.5" />
        <circle cx="415" cy="140" r="6" fill="none" stroke="#8891A0" strokeWidth="1.5" />
      </g>

      {/* tunnel line */}
      <line
        x1="100"
        y1="140"
        x2="380"
        y2="140"
        stroke="url(#tunnelGrad)"
        strokeWidth="2"
        strokeDasharray="6 6"
        className="animate-pulseline"
        filter="url(#glow)"
      />

      {/* lock badge, centered */}
      <g transform="translate(240,140)" filter="url(#glow)">
        <circle r="26" className="fill-void" stroke="#4CE0D2" strokeWidth="1.5" />
        <g transform="translate(-9,-11)" stroke="#4CE0D2" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <rect x="0" y="8" width="18" height="13" rx="2.5" />
          <path d="M4 8V5a5 5 0 0 1 10 0v3" />
        </g>
      </g>

      {/* status label */}
      <text
        x="240"
        y="205"
        textAnchor="middle"
        className="fill-muted"
        style={{ fontFamily: "var(--font-mono)", fontSize: "11px", letterSpacing: "0.12em" }}
      >
        DTLS-SRTP · DIRECT · NO SERVER RELAY
      </text>
    </svg>
  );
}

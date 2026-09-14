'use client'

const MESSAGE = '🕐 New policy in effect — Members can only log time entries within the last 36 hours. Entries older than 36 hours cannot be added or edited.'

const COPIES = 4

export default function AnnouncementTicker() {
  return (
    <>
      <style>{`
        @keyframes ticker-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-25%); }
        }
        .ticker-track {
          display: flex;
          width: max-content;
          animation: ticker-scroll 28s linear infinite;
          will-change: transform;
        }
        .ticker-track:hover {
          animation-play-state: paused;
        }
      `}</style>
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 999,
          background: 'linear-gradient(90deg, #4c1d95, #6d28d9, #7c3aed, #6d28d9, #4c1d95)',
          overflow: 'hidden',
          height: '32px',
          display: 'flex',
          alignItems: 'center',
          borderBottom: '1px solid rgba(167,139,250,0.3)',
        }}
      >
        <div className="ticker-track">
          {Array.from({ length: COPIES }).map((_, i) => (
            <span
              key={i}
              style={{
                whiteSpace: 'nowrap',
                fontSize: '0.72rem',
                fontWeight: 600,
                color: '#e9d5ff',
                letterSpacing: '0.02em',
                padding: '0 4rem',
              }}
            >
              {MESSAGE}
            </span>
          ))}
        </div>
      </div>
    </>
  )
}

import type { CatchTier } from "@/lib/game/types";

/** Simple inline-SVG pokéball icons — offline-safe, sharp at any size.
 *  Colours differ per tier so the manual-catch button reads at a glance. */
const TOP: Record<CatchTier, string> = {
  pokeball: "#ef4444", // red
  greatball: "#3b82f6", // blue
  ultraball: "#facc15", // gold
  timerball: "#f8fafc", // white
};

export function BallIcon({ ball, className }: { ball: CatchTier; className?: string }) {
  const top = TOP[ball];
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <clipPath id={`ball-clip-${ball}`}>
        <circle cx="12" cy="12" r="10" />
      </clipPath>
      <g clipPath={`url(#ball-clip-${ball})`}>
        <rect x="0" y="0" width="24" height="12" fill={top} />
        <rect x="0" y="12" width="24" height="12" fill="#f8fafc" />
        {ball === "greatball" && (
          <>
            <path d="M4 12 L9 -1 L12 -1 L7 12 Z" fill="#ef4444" />
            <path d="M20 12 L15 -1 L12 -1 L17 12 Z" fill="#ef4444" />
          </>
        )}
        {ball === "ultraball" && (
          <>
            <rect x="6.5" y="0" width="2.2" height="12" fill="#0f172a" />
            <rect x="15.3" y="0" width="2.2" height="12" fill="#0f172a" />
          </>
        )}
        {ball === "timerball" && (
          <>
            <rect x="7" y="0" width="1.6" height="12" fill="#ef4444" />
            <rect x="11.2" y="0" width="1.6" height="12" fill="#ef4444" />
            <rect x="15.4" y="0" width="1.6" height="12" fill="#ef4444" />
          </>
        )}
      </g>
      <circle cx="12" cy="12" r="10" fill="none" stroke="#0f172a" strokeWidth="2" />
      <line x1="2" y1="12" x2="22" y2="12" stroke="#0f172a" strokeWidth="2" />
      <circle cx="12" cy="12" r="3.2" fill="#f8fafc" stroke="#0f172a" strokeWidth="2" />
    </svg>
  );
}

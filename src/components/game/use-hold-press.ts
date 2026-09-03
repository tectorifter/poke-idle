import { useRef } from "react";

/** Pointer handlers for a "tap vs hold" control: a quick press fires `onTap`, a
 *  long press (default 350 ms) fires `onHold` instead. When `onHold` is omitted
 *  the control is a plain tap button (no hold timer). Spread the result onto the
 *  element: `<button {...useHoldPress({ onTap, onHold })} />`. */
export function useHoldPress(opts: { onTap?: () => void; onHold?: () => void; delayMs?: number }) {
  const timer = useRef<number | undefined>(undefined);
  const held = useRef(false);

  return {
    onPointerDown: () => {
      held.current = false;
      if (opts.onHold) {
        timer.current = window.setTimeout(() => {
          held.current = true;
          opts.onHold!();
        }, opts.delayMs ?? 350);
      }
    },
    onPointerUp: () => {
      window.clearTimeout(timer.current);
      if (!held.current) opts.onTap?.();
    },
    onPointerLeave: () => window.clearTimeout(timer.current),
  };
}

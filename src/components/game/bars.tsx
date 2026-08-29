import { cn } from "@/lib/utils";

export function Meter({
  value,
  max,
  tone,
  className,
}: {
  value: number;
  max: number;
  tone: "hp" | "xp" | "catch";
  className?: string;
}) {
  const pct = max <= 0 ? 0 : Math.max(0, Math.min(100, (value / max) * 100));
  const fill =
    tone === "hp"
      ? pct > 50
        ? "bg-hp"
        : pct > 20
          ? "bg-warn"
          : "bg-danger"
      : tone === "xp"
        ? "bg-xp"
        : "bg-accent";
  return (
    <div className={cn("h-2 overflow-hidden rounded-full bg-surface-2", className)}>
      <div
        className={cn("h-full rounded-full transition-[width] duration-150 ease-out", fill)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

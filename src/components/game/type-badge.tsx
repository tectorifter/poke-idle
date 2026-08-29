import { TYPE_COLOR } from "@/lib/game/type-chart";
import { cn } from "@/lib/utils";

export function TypeBadge({ type, className }: { type: string; className?: string }) {
  const bg = TYPE_COLOR[type] ?? "#8b8f9a";
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-full px-2 text-[10px] font-semibold uppercase tracking-wide text-white",
        className,
      )}
      style={{ background: bg }}
    >
      {type}
    </span>
  );
}

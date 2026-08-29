import { useState } from "react";
import { spriteUrl } from "@/lib/game/dex";
import { cn } from "@/lib/utils";

export function Sprite({
  name,
  shiny,
  animated,
  size = 96,
  className,
  facing = "front",
}: {
  name: string;
  shiny?: boolean;
  animated?: boolean;
  size?: number;
  className?: string;
  facing?: "front" | "back";
}) {
  const [failed, setFailed] = useState(false);
  const src = spriteUrl(name, !!shiny, !!animated);

  if (failed) {
    return (
      <div
        className={cn(
          "grid place-items-center rounded-full bg-surface-2 text-sm font-semibold text-muted",
          className,
        )}
        style={{ width: size, height: size }}
        aria-hidden
      >
        {name.slice(0, 1)}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      width={size}
      height={size}
      className={cn(
        "object-contain pixelated drop-shadow-[0_8px_16px_rgba(0,0,0,0.45)]",
        facing === "back" && "scale-x-[-1]",
        shiny && "brightness-110 contrast-110",
        className,
      )}
      style={{ width: size, height: size, imageRendering: "pixelated" }}
      onError={() => setFailed(true)}
      draggable={false}
    />
  );
}

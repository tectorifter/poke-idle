import { useState, type CSSProperties } from "react";
import { spriteUrl, isTeraSpriteName } from "@/lib/game/dex";
import { cn } from "@/lib/utils";

export function Sprite({
  name,
  shiny = false,
  animated = true,
  size = 96,
  className,
  facing = "front",
}: {
  name?: string;
  shiny?: boolean;
  animated?: boolean;
  size?: number;
  className?: string;
  facing?: "front" | "back";
}) {
  const [failed, setFailed] = useState(false);

  // Return fallback block early if name is undefined or image load failed
  if (!name || failed) {
    return (
      <div
        className={cn(
          "grid place-items-center rounded-full bg-surface-2 text-sm font-semibold text-muted",
          className,
        )}
        style={{ width: size, height: size }}
        aria-hidden
      >
        {name ? name.slice(0, 1) : "?"}
      </div>
    );
  }

  const isBack = facing === "back";
  const src = spriteUrl(name, shiny, animated, isBack);
  const isTera = isTeraSpriteName(name);

  const imgEl = (
    <img
      src={src}
      alt={name}
      width={size}
      height={size}
      className={cn(
        "object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.45)]",
        shiny && "brightness-110 contrast-110",
        isTera && "brightness-110 saturate-50 hue-rotate-180",
        !isTera && className,
      )}
      style={{ width: size, height: size, imageRendering: "pixelated" }}
      onError={() => setFailed(true)}
      draggable={false}
    />
  );

  if (!isTera) return imgEl;

  const maskStyle: CSSProperties = {
    WebkitMaskImage: `url("${src}")`,
    maskImage: `url("${src}")`,
    WebkitMaskSize: "contain",
    maskSize: "contain",
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskPosition: "center",
    maskPosition: "center",
  };

  return (
    <div
      className={cn("relative shrink-0 inline-flex", className)}
      style={{ width: size, height: size }}
      aria-label={name}
    >
      {imgEl}

      <img
        src="/tera-crystal.jpg"
        alt=""
        aria-hidden
        draggable={false}
        className="absolute inset-0 rounded-sm pointer-events-none"
        style={{
          width: size,
          height: size,
          objectFit: "cover",
          mixBlendMode: "overlay",
          opacity: 0.55,
          imageRendering: "pixelated",
          ...maskStyle,
        }}
      />

      <div
        aria-hidden
        className="absolute inset-0 rounded-sm pointer-events-none"
        style={{
          width: size,
          height: size,
          background:
            "radial-gradient(ellipse at 30% 25%, rgba(180,220,255,0.28) 0%, rgba(120,180,255,0.12) 40%, transparent 70%)",
          mixBlendMode: "screen",
          ...maskStyle,
        }}
      />
    </div>
  );
}
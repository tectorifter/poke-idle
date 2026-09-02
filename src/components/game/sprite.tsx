import { useState, useEffect } from "react";
import { spriteUrl, staticSpriteUrl, ultimateFallbackUrl } from "@/lib/game/dex";
import { cn } from "@/lib/utils";

interface SpriteProps {
  name: string;
  shiny?: boolean;
  animated?: boolean;
  isBack?: boolean;
  size?: number;
  className?: string;
}

export function Sprite({
  name,
  shiny = false,
  animated = true,
  isBack = false,
  size = 64,
  className,
}: SpriteProps) {
  const primaryUrl = spriteUrl(name, shiny, animated, isBack);
  const fallbackUrl = staticSpriteUrl(name, shiny, isBack);
  const lastResortUrl = ultimateFallbackUrl(name);

  // Default to the primary URL (GIF if animated=true)
  const [imgSrc, setImgSrc] = useState(primaryUrl);

  // Reset image source if name or props change
  useEffect(() => {
    setImgSrc(spriteUrl(name, shiny, animated, isBack));
  }, [name, shiny, animated, isBack]);

  // Two-step fallback: animated/static Showdown fails -> try Showdown's static
  // PNG -> if that ALSO fails (a handful of species, e.g. Ogerpon/Terapagos,
  // have had trouble loading from Showdown specifically) -> a fully independent
  // host (GitHub-hosted PokeAPI artwork) as a last resort.
  const handleError = () => {
    if (imgSrc === primaryUrl && imgSrc !== fallbackUrl) {
      setImgSrc(fallbackUrl);
      return;
    }
    if (lastResortUrl && imgSrc !== lastResortUrl) {
      setImgSrc(lastResortUrl);
    }
  };

  return (
    <img
      src={imgSrc}
      alt={name}
      width={size}
      height={size}
      onError={handleError}
      className={cn(
        "object-contain select-none", 
        isBack && "-scale-x-100", 
        className
      )}
      style={{ width: `${size}px`, height: `${size}px` }}
      loading="lazy"
    />
  );
}

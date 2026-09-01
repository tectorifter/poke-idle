import { useState, useEffect } from "react";
import { spriteUrl, staticSpriteUrl } from "@/lib/game/dex";
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

  // Default to the primary URL (GIF if animated=true)
  const [imgSrc, setImgSrc] = useState(primaryUrl);

  // Reset image source if name or props change
  useEffect(() => {
    setImgSrc(spriteUrl(name, shiny, animated, isBack));
  }, [name, shiny, animated, isBack]);

  // When the browser hits a 404 on the GIF, fallback to static PNG
  const handleError = () => {
    if (imgSrc !== fallbackUrl) {
      setImgSrc(fallbackUrl);
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
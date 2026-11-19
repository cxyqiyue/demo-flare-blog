import { ClientOnly } from "@tanstack/react-router";
import { useState } from "react";
import { ImageLightbox } from "@/components/content/image-lightbox";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

interface ZoomableContentImageProps {
  src: string;
  alt: string;
  className?: string;
}

export function ZoomableContentImage({
  src,
  alt,
  className,
}: ZoomableContentImageProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label={m.common_view_full_image()}
        onClick={() => setIsOpen(true)}
        className="m-0 block max-w-full cursor-zoom-in border-0 bg-transparent p-0 text-left"
      >
        <img
          src={src}
          alt={alt}
          loading="lazy"
          draggable={false}
          className={cn("max-w-full", className)}
        />
      </button>
      <ClientOnly>
        <ImageLightbox
          src={src}
          alt={alt}
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
        />
      </ClientOnly>
    </>
  );
}

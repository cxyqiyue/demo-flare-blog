import { X } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { m } from "@/paraglide/messages";

interface ImageLightboxProps {
  src: string;
  alt: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ImageLightbox({
  src,
  alt,
  isOpen,
  onClose,
}: ImageLightboxProps) {
  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !src) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt || m.common_image_preview()}
      className="fixed inset-0 z-[10000] flex items-center justify-center"
      onContextMenu={(event) => event.preventDefault()}
    >
      <button
        type="button"
        aria-label={m.common_close()}
        className="absolute inset-0 cursor-zoom-out bg-black/95 backdrop-blur-sm"
        onClick={onClose}
      />

      <img
        src={src}
        alt={alt}
        draggable={false}
        onContextMenu={(event) => event.preventDefault()}
        className="pointer-events-none relative z-10 max-h-[calc(100vh-5rem)] max-w-[calc(100vw-2rem)] select-none object-contain sm:max-h-[calc(100vh-6rem)] sm:max-w-[calc(100vw-4rem)]"
      />

      <button
        type="button"
        aria-label={m.common_close()}
        title={m.common_close()}
        onClick={onClose}
        className="absolute right-4 top-4 z-20 inline-flex size-12 items-center justify-center rounded-full border-2 border-white bg-white text-black shadow-[0_4px_24px_rgba(0,0,0,0.65)] ring-4 ring-black/40 transition-transform hover:scale-105 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/70 sm:right-6 sm:top-6"
      >
        <X size={24} strokeWidth={2.75} aria-hidden="true" />
      </button>
    </div>,
    document.body,
  );
}

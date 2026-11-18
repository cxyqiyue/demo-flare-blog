import { useState } from "react";

export function PostCover({
  src,
  title,
  className,
}: {
  src?: string | null;
  title: string;
  className: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string>();
  const showImage = src && src !== failedSrc;
  return (
    <span className={className} aria-hidden="true">
      {showImage ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 size-full object-cover"
          onError={() => setFailedSrc(src)}
        />
      ) : (
        Array.from(title.trim()).find((character) =>
          /[\p{L}\p{N}]/u.test(character),
        )
      )}
    </span>
  );
}

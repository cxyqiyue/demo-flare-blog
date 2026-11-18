import { ArrowUp } from "lucide-react";
import { useEffect, useState } from "react";
import { m } from "@/paraglide/messages";

export function BackToTop() {
  const [visible, setVisible] = useState(false);
  const [reading, setReading] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    const update = () => {
      const y = window.scrollY;
      setVisible(y > window.innerHeight * 0.35);
      if (Math.abs(y - lastY) > 8) {
        setReading(y > lastY);
        lastY = y;
      }
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  return (
    <div
      className="flare-floating-lane"
      data-visible={visible}
      data-reading={reading}
    >
      <button
        type="button"
        tabIndex={visible ? 0 : -1}
        aria-hidden={!visible}
        aria-label={m.post_back_to_top()}
        className="flare-surface flare-back-to-top flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-primary"
        onClick={() =>
          window.scrollTo({
            top: 0,
            behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
              .matches
              ? "instant"
              : "smooth",
          })
        }
      >
        <ArrowUp size={19} />
      </button>
    </div>
  );
}

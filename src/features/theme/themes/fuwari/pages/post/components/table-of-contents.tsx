import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TableOfContentsItem } from "@/features/posts/utils/toc";
import { cn } from "@/lib/utils";

export default function TableOfContents({
  headers,
  forceVisible = false,
  tocHeightClass,
  onNavigate,
  card = false,
}: {
  headers: Array<TableOfContentsItem>;
  /** 抽屉等环境：强制始终可见，不随滚动状态淡入淡出 */
  forceVisible?: boolean;
  /** 覆盖滚动区域高度类（默认 h-[calc(100vh-20rem)]） */
  tocHeightClass?: string;
  /** 点击条目跳到锚点后触发（抽屉用它收起面板） */
  onNavigate?: () => void;
  /** fuwari 白底卡片样式（右侧悬挂目录用） */
  card?: boolean;
}) {
  const [activeIndices, setActiveIndices] = useState<Array<number>>([]);
  const [isReady, setIsReady] = useState(false);

  const [isVisible, setIsVisible] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const tocRootRef = useRef<HTMLDivElement>(null);
  const linksContainerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // For the active indicator backdrop
  const [indicatorStyle, setIndicatorStyle] = useState<{
    top: number;
    height: number;
    opacity: number;
  }>({ top: 0, height: 0, opacity: 0 });

  // Calculate min depth
  const minDepth = useMemo(() => {
    if (headers.length === 0) return 10;
    let min = 10;
    for (const heading of headers) {
      if (heading.level < min) min = heading.level;
    }
    return min;
  }, [headers]);

  // Max depth visible in TOC from config
  const maxLevel = 3;

  const removeTailingHash = (text: string) => {
    const lastIndexOfHash = text.lastIndexOf("#");
    if (lastIndexOfHash !== -1 && lastIndexOfHash === text.length - 1) {
      return text.substring(0, lastIndexOfHash);
    }
    return text;
  };

  // Scroll visibility logic: Show TOC after scrolling past banner area
  useEffect(() => {
    const handleScrollVisibility = () => {
      const scrollY = window.scrollY;
      // Show when scrolled > 350px (approx banner height)
      setIsVisible(scrollY > 350);
    };

    window.addEventListener("scroll", handleScrollVisibility, {
      passive: true,
    });
    handleScrollVisibility(); // Initial check
    return () => window.removeEventListener("scroll", handleScrollVisibility);
  }, []);

  // Active heading detection: find the single section currently in view
  const computeActiveHeadings = useCallback(() => {
    if (headers.length === 0) return;

    // Reference point: scroll position + header offset (matches click scroll target)
    const HEADER_OFFSET = 80;
    const refTop = window.scrollY + HEADER_OFFSET + 1;

    let candidate = -1;
    for (let i = 0; i < headers.length; i++) {
      const heading = document.getElementById(headers[i].id);
      if (!heading) continue;
      const headingTop = heading.getBoundingClientRect().top + window.scrollY;
      if (headingTop <= refTop) {
        candidate = i;
      } else {
        break;
      }
    }

    const next: Array<number> = candidate === -1 ? [] : [candidate];
    setActiveIndices((prev) =>
      JSON.stringify(prev) === JSON.stringify(next) ? prev : next,
    );
  }, [headers]);

  // Initial and reactive computation
  useEffect(() => {
    computeActiveHeadings();

    // Reset active indices and suppress visibility briefly when headers change
    setActiveIndices([]);
    setIsReady(false);
    const timer = setTimeout(() => {
      setIsReady(true);
      computeActiveHeadings();
    }, 600);

    window.addEventListener("scroll", computeActiveHeadings, { passive: true });
    window.addEventListener("resize", computeActiveHeadings);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", computeActiveHeadings);
      window.removeEventListener("resize", computeActiveHeadings);
    };
  }, [headers, computeActiveHeadings]);

  // Update indicator style based on the range of active indices
  useEffect(() => {
    if (activeIndices.length > 0 && linksContainerRef.current) {
      const firstIdx = activeIndices[0];
      const lastIdx = activeIndices[activeIndices.length - 1];

      if (!headers[firstIdx] || !headers[lastIdx]) {
        setIndicatorStyle((prev) => ({ ...prev, opacity: 0 }));
        return;
      }

      const firstId = headers[firstIdx].id;
      const lastId = headers[lastIdx].id;

      const firstLink = linksContainerRef.current.querySelector<HTMLElement>(
        `a[href="#${firstId}"]`,
      );
      const lastLink = linksContainerRef.current.querySelector<HTMLElement>(
        `a[href="#${lastId}"]`,
      );

      if (firstLink && lastLink) {
        const top = firstLink.offsetTop;
        const height =
          lastLink.offsetHeight + lastLink.offsetTop - firstLink.offsetTop;

        setIndicatorStyle({
          top,
          height,
          opacity: 1,
        });

        // Auto-scroll TOC container
        if (tocRootRef.current) {
          const tocHeight = tocRootRef.current.clientHeight;
          const scrollTarget =
            height < 0.9 * tocHeight
              ? top - 32
              : lastLink.offsetTop + lastLink.offsetHeight - tocHeight * 0.8;

          tocRootRef.current.scrollTo({
            top: scrollTarget,
            behavior: "smooth",
          });
        }
      }
    } else {
      setIndicatorStyle((prev) => ({ ...prev, opacity: 0 }));
    }
  }, [activeIndices, headers]);

  if (headers.length === 0) return null;

  let h1Count = 1;

  return (
    <nav
      ref={navRef}
      className={cn(
        "sticky top-14 self-start block w-full transition-all duration-500",
        card && "fuwari-card-base p-4",
        forceVisible || (isVisible && isReady)
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-4 pointer-events-none",
      )}
    >
      <div
        ref={tocRootRef}
        className={cn(
          "relative toc-root overflow-y-scroll overflow-x-hidden fuwari-toc-scrollbar",
          tocHeightClass ?? "h-[calc(100vh-20rem)]",
        )}
        style={{
          scrollBehavior: "smooth",
          maskImage:
            "linear-gradient(to bottom, transparent 0%, black 2rem, black calc(100% - 2rem), transparent 100%)",
        }}
      >
        <div className="h-8 w-full" />
        <div
          ref={linksContainerRef}
          className="group relative flex flex-col w-full"
        >
          {headers
            .filter((heading) => heading.level < minDepth + maxLevel)
            .map((heading, index) => {
              const text = removeTailingHash(heading.text);
              const isH1 = heading.level === minDepth;
              const isH2 = heading.level === minDepth + 1;
              const isH3 = heading.level === minDepth + 2;
              const isActive = activeIndices.includes(index);

              return (
                <a
                  key={heading.id}
                  href={`#${heading.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    const element = document.getElementById(heading.id);
                    if (element) {
                      const top =
                        element.getBoundingClientRect().top +
                        window.scrollY -
                        80;
                      window.scrollTo({ top, behavior: "smooth" });
                      navigate({
                        hash: heading.id,
                        replace: true,
                      });
                      onNavigate?.();
                    }
                  }}
                  className={cn(
                    "px-2 flex gap-2 relative transition w-full min-h-9 rounded-xl py-2 z-10",
                    "hover:bg-(--fuwari-toc-btn-hover) active:bg-(--fuwari-toc-btn-active)",
                  )}
                >
                  <div
                    className={cn(
                      "transition w-5 h-5 shrink-0 rounded-lg text-xs flex items-center justify-center font-bold",
                      {
                        "bg-[oklch(0.89_0.050_var(--fuwari-hue))] dark:bg-(--fuwari-btn-regular-bg) text-(--fuwari-btn-content)":
                          isH1,
                        "ml-4": isH2,
                        "ml-8": isH3,
                      },
                    )}
                  >
                    {isH1 && h1Count++}
                    {isH2 && (
                      <div className="transition w-2 h-2 rounded-[0.1875rem] bg-[oklch(0.89_0.050_var(--fuwari-hue))] dark:bg-(--fuwari-btn-regular-bg)"></div>
                    )}
                    {isH3 && (
                      <div className="transition w-1.5 h-1.5 rounded-sm bg-black/5 dark:bg-white/10"></div>
                    )}
                  </div>

                  <div
                    className={cn("transition text-sm", {
                      "fuwari-text-75 font-semibold": isActive,
                      "fuwari-text-50": !isActive && (isH1 || isH2),
                      "fuwari-text-30": !isActive && isH3,
                    })}
                  >
                    {text}
                  </div>
                </a>
              );
            })}

          {/* Active Indicator Backdrop */}
          {headers.length > 0 && (
            <div
              className={cn(
                "absolute left-0 right-0 rounded-xl transition-all duration-300 ease-out -z-10 border-2 border-dashed pointer-events-none",
                "bg-(--fuwari-toc-btn-hover) border-(--fuwari-toc-btn-hover) group-hover:bg-transparent group-hover:border-(--fuwari-toc-btn-active)",
              )}
              style={{
                top: `${indicatorStyle.top}px`,
                height: `${indicatorStyle.height}px`,
                opacity: indicatorStyle.opacity,
              }}
            />
          )}
        </div>
        <div className="h-8 w-full" />
      </div>
    </nav>
  );
}

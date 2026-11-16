import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { TableOfContentsItem } from "@/features/posts/utils/toc";
import { useActiveTOC } from "@/hooks/use-active-toc";
import { scrollToHeadingWithRetry } from "@/features/posts/utils/scroll-to-heading";
import { cn } from "@/lib/utils";

export default function TableOfContents({
  headers,
  className,
  onNavigate,
}: {
  headers: Array<TableOfContentsItem>;
  /** 覆盖导航容器样式（抽屉等场景需要去掉 sticky / 改宽度与高度） */
  className?: string;
  /** 点击条目跳到锚点后触发（抽屉用它收起面板） */
  onNavigate?: () => void;
}) {
  const activeId = useActiveTOC(headers);
  const [, setIndicatorTop] = useState<number>(0);
  const navRef = useRef<HTMLElement>(null);
  const navigate = useNavigate();

  // Update visual indicator position and scroll TOC
  useEffect(() => {
    if (activeId && navRef.current) {
      const container = navRef.current;
      const activeLink = container.querySelector(
        `a[href="#${CSS.escape(activeId)}"]`,
      );

      if (activeLink instanceof HTMLElement) {
        const listRect = container
          .querySelector(".toc-root")
          ?.getBoundingClientRect();
        const linkRect = activeLink.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        if (listRect) {
          setIndicatorTop(linkRect.top - listRect.top);
        }

        // Auto-scroll TOC container
        const linkTop =
          container.scrollTop + (linkRect.top - containerRect.top);
        const linkBottom = linkTop + linkRect.height;
        const padding = 40; // Minimum distance from container top/bottom

        if (linkBottom > container.scrollTop + containerRect.height - padding) {
          container.scrollTo({
            top: linkBottom - containerRect.height + padding,
            behavior: "smooth",
          });
        } else if (linkTop < container.scrollTop + padding) {
          container.scrollTo({
            top: Math.max(0, linkTop - padding),
            behavior: "smooth",
          });
        }
      }
    }
  }, [activeId]);

  if (headers.length === 0) return null;

  return (
    <nav
      ref={navRef}
      className={cn(
        "sticky top-28 self-start block w-60 animate-in fade-in duration-500 max-h-[calc(100vh-8rem)] overflow-y-auto overflow-x-hidden custom-scrollbar rounded-xl border border-border/50 bg-card/70 backdrop-blur-sm p-3",
        className,
      )}
    >
      <div className="mb-2 px-1 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground/60">
        TOC
      </div>
      <div className="relative toc-root">
        <ul className="space-y-1.5 list-none m-0 p-0">
          {headers.map((node) => (
            <li key={node.id}>
              <a
                href={`#${node.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  const element = document.getElementById(node.id);
                  if (element) {
                    scrollToHeadingWithRetry(element, 0);
                    navigate({
                      hash: node.id,
                      replace: true,
                      hashScrollIntoView: false,
                    });
                    onNavigate?.();
                  }
                }}
                className={cn(
                  "block rounded-md px-2 py-1 text-[12px] leading-relaxed transition-colors border-l-2",
                  activeId === node.id
                    ? "text-foreground border-foreground/60 bg-muted/50 font-medium"
                    : "text-muted-foreground/70 border-transparent hover:text-foreground hover:bg-muted/30 hover:border-border/60",
                )}
                style={{ marginLeft: `${Math.max(0, node.level - 2) * 0.5}rem` }}
              >
                {node.text}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

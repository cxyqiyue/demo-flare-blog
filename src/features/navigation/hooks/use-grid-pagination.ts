import { useEffect, useRef, useState } from "react";

/** 卡片固定尺寸（px）：宽度 = 网站图标 + 最多 6 个中文字符名 */
export const NAV_CARD_WIDTH = 144;
export const NAV_CARD_GAP = 8;

/** 各档位每页行数：手机 / 平板 / 桌面 */
const ROWS_BY_TIER = [
  { maxWidth: 640, rows: 3 },
  { maxWidth: 1024, rows: 4 },
] as const;

/**
 * 按容器宽度计算卡片列数（纯函数，便于单测）。
 * cols = floor((width + gap) / (cardWidth + gap))，至少 1 列。
 */
export function resolveColumnCount(
  containerWidth: number,
  cardWidth: number = NAV_CARD_WIDTH,
  gap: number = NAV_CARD_GAP,
): number {
  if (containerWidth <= 0) return 1;
  return Math.max(1, Math.floor((containerWidth + gap) / (cardWidth + gap)));
}

/** 按视口宽度档位返回每页行数（纯函数，便于单测） */
export function resolveRowsPerPage(viewportWidth: number): number {
  for (const tier of ROWS_BY_TIER) {
    if (viewportWidth < tier.maxWidth) return tier.rows;
  }
  return 5;
}

function measure(): number {
  return typeof window === "undefined" ? 1024 : window.innerWidth;
}

/**
 * 卡片网格自适应分页度量：
 * - 列数由容器实际宽度实时推导（ResizeObserver）；
 * - 行数按设备档位固定（手机 3 / 平板 4 / 桌面 5）；
 * - pageSize = 列数 × 行数，随屏幕变化自动增减。
 */
export function useGridPagination(
  cardWidth: number = NAV_CARD_WIDTH,
  gap: number = NAV_CARD_GAP,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(4);
  const [rows, setRows] = useState(() => resolveRowsPerPage(measure()));

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      setColumns(resolveColumnCount(el.clientWidth, cardWidth, gap));
      setRows(resolveRowsPerPage(window.innerWidth));
    };
    update();

    const observer = new ResizeObserver(update);
    observer.observe(el);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [cardWidth, gap]);

  return { containerRef, columns, rows, pageSize: columns * rows };
}

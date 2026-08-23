import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * 卡片名称文字：单行溢出时尾部虚化淡出（而非生硬省略号）。
 * 完整名称通过外层 title 提示。
 */
export function MaskedName({
  children,
  className,
  title,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  const mask = "linear-gradient(to right, black calc(100% - 16px), transparent)";
  return (
    <span
      title={title}
      className={cn(
        "min-w-0 flex-1 overflow-hidden whitespace-nowrap",
        className,
      )}
      style={{
        WebkitMaskImage: mask,
        maskImage: mask,
      }}
    >
      {children}
    </span>
  );
}

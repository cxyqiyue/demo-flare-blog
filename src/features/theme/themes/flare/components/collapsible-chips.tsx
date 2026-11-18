import { ChevronDown, ChevronUp } from "lucide-react";
import {
  Children,
  isValidElement,
  type ReactNode,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { m } from "@/paraglide/messages";

export function CollapsibleChips({ children }: { children: ReactNode }) {
  const items = Children.toArray(children);
  const id = useId();
  const row = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const more = useRef<HTMLButtonElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [visible, setVisible] = useState(0);
  const [measured, setMeasured] = useState(false);

  useLayoutEffect(() => {
    if (!row.current || !list.current || !more.current) return;
    const container = row.current;
    const chips = list.current;
    const button = more.current;
    const measure = () => {
      const gap = Number.parseFloat(getComputedStyle(chips).columnGap) || 0;
      const itemGap =
        Number.parseFloat(getComputedStyle(container).columnGap) || 0;
      // The inner span keeps its natural width even when its chip is clipped.
      const widths = Array.from(
        chips.children,
        (child) => child.firstElementChild?.getBoundingClientRect().width ?? 0,
      );
      const width = container.getBoundingClientRect().width;
      const all = widths.reduce((sum, value) => sum + value + gap, -gap);
      if (all <= width) {
        setVisible(widths.length);
        setMeasured(true);
        return;
      }
      const available =
        width - button.getBoundingClientRect().width - itemGap - gap;
      let used = 0;
      let count = 0;
      for (const chip of widths) {
        if (used + chip > available) break;
        used += chip + gap;
        count += 1;
      }
      setVisible(count);
      setMeasured(true);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    for (const chip of chips.children) {
      if (chip.firstElementChild) observer.observe(chip.firstElementChild);
    }
    measure();
    return () => observer.disconnect();
  }, [children]);

  const hasMore = visible < items.length;
  const showAll = expanded && hasMore;

  return (
    <div ref={row} className="flare-chip-row" data-expanded={showAll}>
      <ul
        ref={list}
        id={id}
        className="flare-chip-list"
        data-measured={measured}
      >
        {items.map((item, index) => (
          <li
            key={isValidElement(item) ? (item.key ?? index) : index}
            data-clipped={!showAll && index >= visible}
            inert={!showAll && index >= visible}
          >
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <button
        ref={more}
        type="button"
        className="flare-chip-toggle"
        data-unused={!hasMore}
        aria-expanded={showAll}
        aria-controls={id}
        onClick={() => setExpanded(!showAll)}
      >
        {showAll ? m.tags_collapse() : m.flare_chips_more()}
        {showAll ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
    </div>
  );
}

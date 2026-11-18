import * as React from "react";
import { isFlare, isFuwari } from "@/lib/theme-mode";
import { cn } from "@/lib/utils";

const TabsContext = React.createContext<{
  value: string;
  onChange: (value: string) => void;
  id: string;
} | null>(null);

const Tabs = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    defaultValue?: string;
    value?: string;
    onValueChange?: (value: string) => void;
  }
>(
  (
    {
      className,
      defaultValue,
      value: controlledValue,
      onValueChange,
      ...props
    },
    ref,
  ) => {
    const id = React.useId();
    const [uncontrolledValue, setUncontrolledValue] =
      React.useState(defaultValue);
    const isControlled = controlledValue !== undefined;
    const value = isControlled ? controlledValue : uncontrolledValue;

    const onChange = React.useCallback(
      (newValue: string) => {
        if (!isControlled) {
          setUncontrolledValue(newValue);
        }
        onValueChange?.(newValue);
      },
      [isControlled, onValueChange],
    );

    return (
      <TabsContext.Provider value={{ value: value || "", onChange, id }}>
        <div ref={ref} className={cn("", className)} {...props} />
      </TabsContext.Provider>
    );
  },
);
Tabs.displayName = "Tabs";

const TabsList = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    role={isFlare ? "tablist" : undefined}
    onKeyDown={
      isFlare
        ? (event) => {
            if (
              ![
                "ArrowLeft",
                "ArrowRight",
                "ArrowUp",
                "ArrowDown",
                "Home",
                "End",
              ].includes(event.key)
            )
              return;
            const tabs = Array.from(
              event.currentTarget.querySelectorAll<HTMLButtonElement>(
                '[role="tab"]:not(:disabled)',
              ),
            );
            const index = tabs.indexOf(
              document.activeElement as HTMLButtonElement,
            );
            if (index < 0 || !tabs.length) return;
            event.preventDefault();
            const next =
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? tabs.length - 1
                  : (index +
                      (["ArrowLeft", "ArrowUp"].includes(event.key) ? -1 : 1) +
                      tabs.length) %
                    tabs.length;
            tabs[next]?.focus();
            tabs[next]?.click();
          }
        : undefined
    }
    className={cn(
      isFlare
        ? "inline-flex max-w-full items-center gap-1 overflow-x-auto overscroll-x-contain rounded-xl border border-border bg-muted/50 p-1"
        : isFuwari
          ? "inline-flex max-w-full items-center gap-1 rounded-xl bg-(--fuwari-btn-regular-bg) p-1 overscroll-x-contain"
          : "inline-flex max-w-full items-center gap-4 border-b border-border/30 overflow-x-auto overscroll-x-contain",
      className,
    )}
    {...props}
  />
));
TabsList.displayName = "TabsList";

const TabsTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }
>(({ className, value, onClick, ...props }, ref) => {
  const context = React.useContext(TabsContext);
  if (!context) throw new Error("TabsTrigger must be used within Tabs");

  const isActive = context.value === value;

  return (
    <button
      ref={ref}
      type="button"
      role="tab"
      aria-selected={isActive}
      id={isFlare ? `${context.id}-tab-${value}` : undefined}
      aria-controls={isFlare ? `${context.id}-panel-${value}` : undefined}
      tabIndex={isFlare ? (isActive ? 0 : -1) : undefined}
      data-state={isActive ? "active" : "inactive"}
      className={cn(
        isFlare
          ? "min-h-11 shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-40 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm hover:bg-card/70"
          : isFuwari
            ? "shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40 active:scale-[0.97] data-[state=active]:bg-(--fuwari-card-bg) data-[state=active]:text-(--fuwari-primary) data-[state=active]:shadow-sm fuwari-text-50 hover:text-(--fuwari-primary)"
            : "pb-3 shrink-0 whitespace-nowrap text-[10px] font-mono uppercase tracking-widest transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40 border-b-2 -mb-px",
        isFlare
          ? "text-muted-foreground"
          : isActive && !isFuwari
            ? "text-foreground border-foreground"
            : "text-muted-foreground/50 border-transparent hover:text-foreground",
        className,
      )}
      onClick={(e) => {
        context.onChange(value);
        onClick?.(e);
      }}
      {...props}
    />
  );
});
TabsTrigger.displayName = "TabsTrigger";

const TabsContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { value: string }
>(({ className, value, ...props }, ref) => {
  const context = React.useContext(TabsContext);
  if (!context) throw new Error("TabsContent must be used within Tabs");

  if (context.value !== value) return null;

  return (
    <div
      ref={ref}
      role="tabpanel"
      id={isFlare ? `${context.id}-panel-${value}` : undefined}
      aria-labelledby={isFlare ? `${context.id}-tab-${value}` : undefined}
      data-state="active"
      className={cn(
        "mt-4 focus-visible:outline-none animate-in fade-in duration-200",
        className,
      )}
      {...props}
    />
  );
});
TabsContent.displayName = "TabsContent";

export { Tabs, TabsList, TabsTrigger, TabsContent };

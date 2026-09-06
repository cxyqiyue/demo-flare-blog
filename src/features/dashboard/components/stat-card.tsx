import { isFuwari } from "@/lib/theme-mode";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon,
  trend,
  className,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  trend?: string;
  className?: string;
}) {
  if (isFuwari) {
    return (
      <FuwariStatCard
        label={label}
        value={value}
        icon={icon}
        trend={trend}
        className={className}
      />
    );
  }

  return (
    <div
      className={cn(
        "border border-border/30 bg-background p-6 flex flex-col justify-between h-32 transition-all hover:border-border/60",
        className,
      )}
    >
      <div className="flex justify-between items-start">
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/70 flex items-center gap-2">
          {icon}
          {label}
        </div>
        {trend && (
          <div className="text-[10px] font-mono text-muted-foreground">
            {trend}
          </div>
        )}
      </div>
      <div className="text-4xl font-serif font-medium tracking-tight text-foreground mt-auto">
        {value}
      </div>
    </div>
  );
}

function FuwariStatCard({
  label,
  value,
  icon,
  trend,
  className,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  trend?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "fuwari-card-base h-32 p-4 sm:p-5 flex flex-col justify-between transition-all active:scale-[0.98]",
        className,
      )}
    >
      <div className="flex justify-between items-start gap-2">
        <div className="flex items-center gap-2.5 text-sm font-bold fuwari-text-75 min-w-0">
          <span className="h-9 w-9 shrink-0 rounded-xl bg-(--fuwari-btn-regular-bg) text-(--fuwari-btn-content) flex items-center justify-center">
            {icon}
          </span>
          <span className="truncate">{label}</span>
        </div>
        {trend && (
          <div className="text-xs fuwari-text-50 shrink-0 pt-1">{trend}</div>
        )}
      </div>
      <div className="text-xl sm:text-2xl font-bold fuwari-text-90 mt-auto">
        {value}
      </div>
    </div>
  );
}

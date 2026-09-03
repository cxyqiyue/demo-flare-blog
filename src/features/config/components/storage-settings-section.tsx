import { Database, HardDrive, Loader2, RefreshCw } from "lucide-react";
import { useFormContext } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { getStorageStatusFn } from "@/features/config/api/storage.api";
import type { SystemConfig } from "@/features/config/config.schema";
import { m } from "@/paraglide/messages";
import { cn } from "@/lib/utils";

type StorageStatus = {
  kv: {
    limit: number;
    count: number;
    autoDisabled: boolean;
    userDisabled: boolean;
    enabled: boolean;
  };
};

export function StorageSettingsSection() {
  const { watch, setValue } = useFormContext<SystemConfig>();
  const kvEnabled = watch("storage.kvEnabled") ?? true;

  const { data: status, refetch, isFetching } = useQuery<StorageStatus>({
    queryKey: ["storage-status"],
    queryFn: () => getStorageStatusFn(),
    enabled: true,
  });

  const toggleKv = (value: boolean) => {
    setValue("storage.kvEnabled", value, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  };

  const kv = status?.kv;
  const kvCount = kv?.count ?? 0;
  const kvLimit = kv?.limit ?? 900;
  const kvPct = kvLimit > 0 ? Math.min((kvCount / kvLimit) * 100, 100) : 0;

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-700">
      {/* KV 状态与控制 */}
      <section className="border border-border/30 bg-background/50 p-8">
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="rounded-sm bg-muted/40 p-2">
              <HardDrive size={16} className="text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <h5 className="text-sm font-medium text-foreground">
                {m.settings_storage_section_kv_title()}
              </h5>
              <p className="text-xs text-muted-foreground">
                {m.settings_storage_section_kv_desc()}
              </p>
            </div>
          </div>

          {/* KV 开关 */}
          <div className="flex items-center justify-between gap-4 border border-border/20 bg-muted/10 p-5">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                {m.settings_storage_enable_kv()}
              </p>
              <p className="text-xs text-muted-foreground">
                {m.settings_storage_enable_kv_desc()}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={kvEnabled}
              onClick={() => toggleKv(!kvEnabled)}
              className={cn(
                "relative h-6 w-11 shrink-0 rounded-full border transition-colors",
                kvEnabled
                  ? "bg-foreground border-foreground"
                  : "bg-muted/40 border-border/40",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition-all",
                  kvEnabled ? "left-[calc(100%-1.375rem)]" : "left-0.5",
                )}
              />
            </button>
          </div>

          {/* KV 状态展示 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {m.settings_storage_current_status()}
              </p>
              <button
                type="button"
                onClick={() => refetch()}
                className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                {isFetching ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <RefreshCw size={12} />
                )}
                {m.settings_storage_refresh()}
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="border border-border/20 bg-muted/10 p-4">
                <p className="text-xs text-muted-foreground">
                  {m.settings_storage_status_label()}
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {status === undefined && !isFetching
                    ? m.settings_storage_status_loading()
                    : kv?.enabled
                      ? m.settings_storage_status_normal()
                      : kv?.autoDisabled
                        ? m.settings_storage_status_auto_disabled()
                        : kv?.userDisabled
                          ? m.settings_storage_status_user_disabled()
                          : m.settings_storage_status_fallback()}
                </p>
              </div>
              <div className="border border-border/20 bg-muted/10 p-4">
                <p className="text-xs text-muted-foreground">
                  {m.settings_storage_count_today()}
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {kvCount} / {kvLimit}
                </p>
                <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted/40">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      kvPct >= 90
                        ? "bg-red-500"
                        : kvPct >= 60
                          ? "bg-amber-500"
                          : "bg-emerald-500",
                    )}
                    style={{ width: `${kvPct}%` }}
                  />
                </div>
              </div>
              <div className="border border-border/20 bg-muted/10 p-4">
                <p className="text-xs text-muted-foreground">
                  {m.settings_storage_auto_recovery()}
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {kv?.autoDisabled
                    ? m.settings_storage_auto_recovery_on()
                    : m.settings_storage_auto_recovery_off()}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* D1 状态 */}
      <section className="border border-border/30 bg-background/50 p-8">
        <div className="flex items-start gap-4">
          <div className="rounded-sm bg-emerald-500/10 p-2">
            <Database size={16} className="text-emerald-500/70" />
          </div>
          <div className="space-y-2">
            <h5 className="text-sm font-medium text-foreground">
              {m.settings_storage_d1_title()}
            </h5>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {m.settings_storage_d1_desc()}
            </p>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-xs text-muted-foreground">
                {m.settings_storage_d1_online()}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 降级说明 */}
      <section className="border border-border/30 bg-background/50 p-8">
        <div className="space-y-3">
          <h5 className="text-sm font-medium text-foreground">
            {m.settings_storage_fallback_title()}
          </h5>
          <ul className="space-y-2 text-sm text-muted-foreground leading-relaxed">
            <li>{m.settings_storage_fallback_1()}</li>
            <li>{m.settings_storage_fallback_2()}</li>
            <li>{m.settings_storage_fallback_3()}</li>
            <li>{m.settings_storage_fallback_4()}</li>
          </ul>
        </div>
      </section>
    </div>
  );
}

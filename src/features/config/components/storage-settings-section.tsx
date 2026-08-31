import { Database, HardDrive, Loader2, RefreshCw } from "lucide-react";
import { useFormContext } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { getStorageStatusFn } from "@/features/config/api/storage.api";
import type { SystemConfig } from "@/features/config/config.schema";
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
                KV 存储（缓存 / 搜索索引）
              </h5>
              <p className="text-xs text-muted-foreground">
                Cloudflare KV 免费额度限制为每天 1000 次写入。开启时优先使用 KV
                提升性能，达到安全阈值后自动降级到 D1。
              </p>
            </div>
          </div>

          {/* KV 开关 */}
          <div className="flex items-center justify-between gap-4 border border-border/20 bg-muted/10 p-5">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                启用 KV 写入
              </p>
              <p className="text-xs text-muted-foreground">
                关闭后，所有依赖 KV 的功能（缓存、搜索索引、防重放等）自动切换到
                D1 运行，博客功能保持正常。
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
                当前状态
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
                刷新
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="border border-border/20 bg-muted/10 p-4">
                <p className="text-xs text-muted-foreground">状态</p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {status === undefined && !isFetching
                    ? "加载中…"
                    : kv?.enabled
                      ? "正常使用 KV"
                      : kv?.autoDisabled
                        ? "已达额度，自动降级到 D1"
                        : kv?.userDisabled
                          ? "已手动关闭，降级到 D1"
                          : "降级到 D1"}
                </p>
              </div>
              <div className="border border-border/20 bg-muted/10 p-4">
                <p className="text-xs text-muted-foreground">今日 KV 写入</p>
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
                <p className="text-xs text-muted-foreground">自动恢复</p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {kv?.autoDisabled ? "次日 0 点自动恢复" : "关闭时不自动恢复"}
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
              D1 数据库（始终开启，无法关闭）
            </h5>
            <p className="text-sm text-muted-foreground leading-relaxed">
              D1 是博客的系统数据库，承载文章、评论、浏览统计、导入导出进度等全部核心数据。
              它没有写入配额限制，是 KV 降级时的永久兜底后端，始终保持开启状态。
            </p>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-xs text-muted-foreground">D1 在线</span>
            </div>
          </div>
        </div>
      </section>

      {/* 降级说明 */}
      <section className="border border-border/30 bg-background/50 p-8">
        <div className="space-y-3">
          <h5 className="text-sm font-medium text-foreground">降级行为说明</h5>
          <ul className="space-y-2 text-sm text-muted-foreground leading-relaxed">
            <li>
              · 达到 KV 写入安全阈值（{kvLimit} 次/日）或手动关闭后，系统自动将
              KV 写入切换到 D1，博客所有功能保持正常。
            </li>
            <li>
              · 缓存代际指针不再写入 KV，公开数据按 Cache API 的 TTL 自然过期后回源
              D1，功能不受影响，仅缓存刷新略有延迟。
            </li>
            <li>
              · 搜索索引、人机验证防重放、导入导出进度、用量告警去重、自动快照节流
              等均切换到 D1 表存储。
            </li>
            <li>
              · 恢复策略：因达到限额自动降级后，次日 0 点自动恢复 KV；若为手动关闭，
              需在此页面重新开启。
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { Button } from "@/components/ui/button";
import {
  CF_USAGE_KEYS,
  cloudflareUsageQuery,
  cloudflareAlertQuery,
} from "@/features/cloudflare-usage/queries";
import { refreshCloudflareUsageFn } from "@/features/cloudflare-usage/api/cloudflare-usage.api";
import {
  formatBytes,
  formatNumber,
} from "@/features/cloudflare-usage/service/cloudflare-usage.service";
import { cn } from "@/lib/utils";

function getPercentageColor(pct: number) {
  if (pct >= 90) return "text-red-500";
  if (pct >= 70) return "text-amber-500";
  return "text-muted-foreground";
}

function getBarColor(pct: number) {
  if (pct >= 90) return "bg-red-500";
  if (pct >= 70) return "bg-amber-500";
  return "bg-foreground";
}

function formatValue(used: number, unit: string) {
  if (unit.includes("bytes")) return formatBytes(used);
  return formatNumber(used);
}

function formatLimit(limit: number, unit: string) {
  if (unit.includes("bytes")) return formatBytes(limit);
  return formatNumber(limit);
}

function UsageBar({
  percentage,
  className,
}: {
  percentage: number;
  className?: string;
}) {
  return (
    <div className={cn("h-1.5 w-full bg-muted/30 overflow-hidden", className)}>
      <div
        className={cn(
          "h-full transition-all duration-500",
          getBarColor(percentage),
        )}
        style={{ width: `${Math.min(percentage, 100)}%` }}
      />
    </div>
  );
}

function ServiceCard({
  service,
}: {
  service: {
    service: string;
    displayName: string;
    used: number;
    limit: number;
    unit: string;
    percentage: number;
    billingMetric?: string;
    error?: string;
  };
}) {
  if (service.error) {
    return (
      <div
        className="space-y-3 p-4 border border-red-500/30 bg-red-500/5"
        title={service.error}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            {service.displayName}
          </span>
          <AlertTriangle size={12} className="text-red-500" />
        </div>
        <div className="text-sm font-serif text-red-500">数据获取失败</div>
        <p className="text-[10px] text-muted-foreground line-clamp-2 break-all">
          {service.error}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4 border border-border/20 bg-muted/10">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          {service.displayName}
        </span>
        <span
          className={cn(
            "text-xs font-mono",
            getPercentageColor(service.percentage),
          )}
        >
          {service.percentage.toFixed(1)}%
        </span>
      </div>

      <UsageBar percentage={service.percentage} />

      <div className="flex items-baseline justify-between">
        <span className="text-sm font-serif text-foreground">
          {formatValue(service.used, service.unit)}
        </span>
        <span className="text-[10px] text-muted-foreground">
          / {formatLimit(service.limit, service.unit)}
        </span>
      </div>
    </div>
  );
}

export function CloudflareUsageDashboard() {
  const queryClient = useQueryClient();
  const { data, isLoading, isFetching } = useQuery(cloudflareUsageQuery);
  const { data: alertData } = useQuery(cloudflareAlertQuery);

  // 强制刷新：删除服务端 KV 缓存后重新拉取 Cloudflare Analytics
  const refreshMutation = useMutation({
    mutationFn: () => refreshCloudflareUsageFn(),
    onSuccess: (fresh) => {
      queryClient.setQueryData(CF_USAGE_KEYS.usage, fresh);
      void queryClient.invalidateQueries({ queryKey: CF_USAGE_KEYS.all });
    },
  });

  const isRefreshing = refreshMutation.isPending || isFetching;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="h-32 border border-border/20 bg-muted/10 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  const services = data?.services ?? [];

  if (services.length === 0) {
    return (
      <div className="flex items-center justify-center p-12 border border-border/20 bg-muted/10">
        <div className="text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            Cloudflare Analytics API 未配置或无数据
          </p>
          <p className="text-xs text-muted-foreground">
            请在设置页面配置 Account ID 和 API Token
          </p>
        </div>
      </div>
    );
  }

  const alertsCount = alertData?.alerts?.length ?? 0;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-serif font-medium text-foreground">
            Cloudflare 用量概览
          </h3>
          <p className="text-xs text-muted-foreground">
            数据周期：今日（与 Cloudflare 告警邮件同口径，分析数据有数分钟延迟） ·
            更新时间：
            {data?.fetchedAt
              ? new Date(data.fetchedAt).toLocaleString("zh-CN")
              : "未知"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {alertsCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 border border-amber-500/30 bg-amber-500/10">
              <AlertTriangle size={12} className="text-amber-500" />
              <span className="text-xs text-amber-500 font-mono">
                {alertsCount} 项超阈值
              </span>
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => refreshMutation.mutate()}
            disabled={isRefreshing}
            className="rounded-none border-border/30 text-xs font-mono uppercase tracking-wider"
          >
            <RefreshCw
              size={12}
              className={cn("mr-2", isRefreshing && "animate-spin")}
            />
            刷新
          </Button>
        </div>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {services.map((svc) => (
          <ServiceCard key={svc.service} service={svc} />
        ))}
      </div>

      {/* Chart */}
      {services.length > 0 && (
        <div className="border border-border/20 bg-muted/10 p-6">
          <h4 className="text-sm font-medium text-foreground mb-4">
            用量百分比对比
          </h4>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={services.map((s) => ({
                  name: s.displayName,
                  value: s.percentage,
                }))}
              >
                <defs>
                  <linearGradient
                    id="usageGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor="hsl(var(--foreground))"
                      stopOpacity={0.1}
                    />
                    <stop
                      offset="100%"
                      stopColor="hsl(var(--foreground))"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" hide />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload?.length) {
                      const point = payload[0].payload;
                      return (
                        <div className="bg-background border border-border/50 p-3 text-xs shadow-none">
                          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">
                            {point.name}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-serif font-medium text-foreground">
                              {point.value.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                  cursor={{
                    stroke: "hsl(var(--border))",
                    strokeWidth: 1,
                    strokeDasharray: "4 4",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(var(--foreground))"
                  strokeWidth={1.5}
                  fillOpacity={1}
                  fill="url(#usageGradient)"
                  isAnimationActive={true}
                  animationDuration={1000}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

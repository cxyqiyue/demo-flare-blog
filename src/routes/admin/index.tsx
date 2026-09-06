import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Activity,
  Database,
  Eye,
  FileText,
  MessageSquare,
  RefreshCw,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CloudflareUsageDashboard } from "@/features/cloudflare-usage/components/cloudflare-usage-dashboard";
import { refreshDashboardCacheFn } from "@/features/dashboard/api/dashboard.api";
import { DashboardSkeleton } from "@/features/dashboard/components/dashboard-skeleton";
import { MetricItem } from "@/features/dashboard/components/metric-item";
import { StatCard } from "@/features/dashboard/components/stat-card";
import { TrafficChart } from "@/features/dashboard/components/traffic-chart";
import type {
  ActivityLogItem,
  DashboardRange,
  DashboardResponse,
} from "@/features/dashboard/dashboard.schema";
import { dashboardStatsQuery } from "@/features/dashboard/queries";
import { useVersionCheck } from "@/features/version/hooks/use-version-check";
import { isFuwari } from "@/lib/theme-mode";
import { formatBytes, formatTime, formatTimeAgo } from "@/lib/utils";
import { m } from "@/paraglide/messages";

const SearchSchema = z.object({
  range: z.enum(["24h", "7d", "30d", "90d"]).default("24h").optional(),
});

export const Route = createFileRoute("/admin/")({
  ssr: "data-only",
  component: DashboardOverview,
  pendingComponent: DashboardSkeleton,
  validateSearch: SearchSchema,
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(dashboardStatsQuery);
    return { title: m.admin_overview_title() };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData?.title,
      },
    ],
  }),
});

function DashboardOverview() {
  const { range = "24h" }: { range?: DashboardRange } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const queryClient = useQueryClient();
  const { data, isFetching } = useSuspenseQuery(dashboardStatsQuery);
  const { stats, activities, trafficByRange } = data;

  // 检查版本更新
  useVersionCheck();

  const refreshDashboardCacheMutation = useMutation({
    mutationFn: refreshDashboardCacheFn,
    onSuccess: () => {
      queryClient.invalidateQueries(dashboardStatsQuery);
      toast.success(m.admin_overview_refresh_success());
    },
  });

  const currentRangeData = trafficByRange?.[range];
  const traffic = currentRangeData?.traffic;
  const overview = currentRangeData?.overview;
  const topPages = currentRangeData?.topPages;
  const lastUpdated = currentRangeData?.lastUpdated;

  const lastUpdatedTime = lastUpdated ? formatTime(lastUpdated) : "";

  const rangeLabel = {
    "24h": m.admin_overview_range_24h(),
    "7d": m.admin_overview_range_7d(),
    "30d": m.admin_overview_range_30d(),
    "90d": m.admin_overview_range_90d(),
  };

  if (isFuwari) {
    return (
      <FuwariDashboardOverview
        range={range}
        stats={stats}
        activities={activities}
        currentRangeData={currentRangeData}
        rangeLabel={rangeLabel}
        lastUpdatedTime={lastUpdatedTime}
        isRefreshing={isFetching}
        onRefresh={() => refreshDashboardCacheMutation.mutate({})}
        onRangeChange={(val) =>
          navigate({
            search: (prev: ReturnType<typeof Route.useSearch>) => ({
              ...prev,
              range: val as DashboardRange,
            }),
          })
        }
      />
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-300 mx-auto">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between md:items-end gap-4 border-b border-border/30 pb-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-serif font-medium tracking-tight text-foreground">
            {m.admin_overview_heading()}
          </h1>
          <div className="flex items-center gap-2">
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
              {m.admin_overview_status()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 md:gap-6 self-start md:self-auto">
          <Tabs
            value={range}
            onValueChange={(val) =>
              navigate({
                search: (prev: ReturnType<typeof Route.useSearch>) => ({
                  ...prev,
                  range: val as DashboardRange,
                }),
              })
            }
          >
            <TabsList className="bg-transparent border-none p-0 gap-4 md:gap-6">
              {Object.entries(rangeLabel).map(([key, label]) => (
                <TabsTrigger
                  key={key}
                  value={key}
                  className="px-0 py-2 h-auto rounded-none text-[10px] font-mono text-muted-foreground data-[state=active]:text-foreground data-[state=active]:shadow-none bg-transparent hover:text-foreground/80 transition-colors"
                >
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => refreshDashboardCacheMutation.mutate({})}
                  disabled={isFetching}
                  className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 p-2 hover:bg-muted/30 rounded-sm"
                >
                  <RefreshCw
                    size={14}
                    className={isFetching ? "animate-spin" : ""}
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{m.admin_overview_refresh()}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link to="/admin/comments" search={{ status: "pending" }}>
          <StatCard
            label={m.admin_overview_stat_pending_comments()}
            value={stats.pendingComments.toString()}
            icon={<MessageSquare size={14} />}
            trend={
              stats.pendingComments > 0
                ? m.admin_overview_trend_action_required()
                : m.admin_overview_trend_all_good()
            }
          />
        </Link>
        <Link to="/admin/posts" search={{ status: "PUBLISHED" }}>
          <StatCard
            label={m.admin_overview_stat_published_posts()}
            value={stats.publishedPosts.toString()}
            icon={<FileText size={14} />}
            trend={m.admin_overview_trend_active_content()}
          />
        </Link>
        <StatCard
          label={m.admin_overview_stat_media_storage()}
          value={formatBytes(stats.mediaSize)}
          icon={<Database size={14} />}
          trend={m.admin_overview_trend_storage_usage()}
        />
        <Link to="/admin/posts" search={{ status: "DRAFT" }}>
          <StatCard
            label={m.admin_overview_stat_drafts()}
            value={stats.drafts.toString()}
            icon={<Activity size={14} />}
            trend={m.admin_overview_trend_in_progress()}
          />
        </Link>
      </div>

      {/* Cloudflare Usage */}
      <CloudflareUsageDashboard />

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Traffic Analysis */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground">
              {m.admin_overview_traffic_title()}
            </h2>
          </div>

          {/* Metrics Row */}
          {overview && (
            <div className="grid grid-cols-2 gap-4">
              <MetricItem
                label={m.admin_overview_metric_page_views()}
                value={overview.pageViews.value}
                prev={overview.pageViews.prev}
                icon={<Eye size={12} />}
              />
              <MetricItem
                label={m.admin_overview_metric_visitors()}
                value={overview.visitors.value}
                prev={overview.visitors.prev}
                icon={<Users size={12} />}
              />
            </div>
          )}

          {/* Chart Area */}
          <div className="h-75 w-full border border-border/30 bg-background p-6">
            {traffic && traffic.length > 0 ? (
              <TrafficChart data={traffic} />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
                <Activity className="opacity-20" size={32} />
                <p className="text-[10px] font-mono uppercase tracking-widest">
                  {m.admin_overview_no_traffic()}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Activity & Content */}
        <div className="space-y-8">
          {/* Top Pages */}
          <div className="space-y-4">
            <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground">
              {m.admin_overview_top_pages_title()}
            </h2>
            <div className="border border-border/30 bg-background p-4 space-y-4">
              {topPages && topPages.length > 0 ? (
                topPages.slice(0, 5).map((page, i) => (
                  <div key={i} className="group">
                    <div className="flex justify-between items-baseline mb-1">
                      <div className="text-xs text-foreground/80 font-medium truncate max-w-45 group-hover:text-foreground transition-colors">
                        {page.title}
                      </div>
                      <div className="text-[10px] font-mono text-muted-foreground">
                        {page.views}
                      </div>
                    </div>
                    <div className="w-full bg-muted/20 h-0.5 rounded-full overflow-hidden">
                      <div
                        className="bg-foreground/40 h-full"
                        style={{
                          width: `${(page.views / Math.max(...topPages.map((p) => p.views), 1)) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-[10px] font-mono text-muted-foreground">
                  {m.admin_overview_no_top_pages()}
                </div>
              )}
            </div>
          </div>

          {/* Activity Log */}
          <div className="space-y-4">
            <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground">
              {m.admin_overview_activity_title()}
            </h2>
            <div className="border border-border/30 bg-background p-4 min-h-50">
              <div className="space-y-4">
                {activities.length > 0 ? (
                  activities.map((log: ActivityLogItem, i: number) => {
                    const Content = () => (
                      <div className="flex gap-3 group/item">
                        <div className="text-[9px] font-mono text-muted-foreground/50 w-16 pt-0.5 shrink-0">
                          {formatTimeAgo(log.time)}
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] text-muted-foreground group-hover/item:text-foreground transition-colors leading-relaxed">
                            {log.text}
                          </p>
                        </div>
                      </div>
                    );

                    if (log.link) {
                      return (
                        <Link key={i} to={log.link} className="block">
                          <Content />
                        </Link>
                      );
                    }
                    return <Content key={i} />;
                  })
                ) : (
                  <div className="text-[10px] font-mono text-muted-foreground">
                    {m.admin_overview_no_activity()}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {lastUpdated && (
        <div className="text-[9px] font-mono text-muted-foreground/30 text-center pt-8 uppercase tracking-widest">
          {m.admin_overview_last_updated({ time: lastUpdatedTime })}
        </div>
      )}
    </div>
  );
}

type CurrentRangeData = NonNullable<
  DashboardResponse["trafficByRange"]
>[DashboardRange];

function FuwariDashboardOverview({
  range,
  stats,
  activities,
  currentRangeData,
  rangeLabel,
  lastUpdatedTime,
  isRefreshing,
  onRefresh,
  onRangeChange,
}: {
  range: DashboardRange;
  stats: DashboardResponse["stats"];
  activities: DashboardResponse["activities"];
  currentRangeData: CurrentRangeData | undefined;
  rangeLabel: Record<string, string>;
  lastUpdatedTime: string;
  isRefreshing: boolean;
  onRefresh: () => void;
  onRangeChange: (value: string) => void;
}) {
  const traffic = currentRangeData?.traffic;
  const overview = currentRangeData?.overview;
  const topPages = currentRangeData?.topPages;

  return (
    <div className="flex flex-col gap-4">
      {/* Header card */}
      <div
        className="fuwari-card-base p-4 sm:p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 fuwari-onload-animation"
        style={{ animationDelay: "100ms" }}
      >
        <div>
          <h1 className="text-lg sm:text-xl font-bold fuwari-text-90">
            {m.admin_overview_heading()}
          </h1>
          <p className="text-sm fuwari-text-50 mt-0.5">
            {m.admin_overview_status()}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Tabs value={range} onValueChange={onRangeChange}>
            <TabsList className="bg-(--fuwari-btn-regular-bg) p-1">
              {Object.entries(rangeLabel).map(([key, label]) => (
                <TabsTrigger
                  key={key}
                  value={key}
                  className="px-3 py-2 text-sm font-bold"
                >
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <Button
            variant="ghost"
            size="icon"
            onClick={onRefresh}
            disabled={isRefreshing}
            title={m.admin_overview_refresh()}
            aria-label={m.admin_overview_refresh()}
            className="h-10 w-10 shrink-0"
          >
            <RefreshCw
              size={16}
              strokeWidth={1.5}
              className={isRefreshing ? "animate-spin" : ""}
            />
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 fuwari-onload-animation"
        style={{ animationDelay: "150ms" }}
      >
        <Link
          to="/admin/comments"
          search={{ status: "pending" }}
          className="block"
        >
          <StatCard
            label={m.admin_overview_stat_pending_comments()}
            value={stats.pendingComments.toString()}
            icon={<MessageSquare size={16} strokeWidth={1.5} />}
            trend={
              stats.pendingComments > 0
                ? m.admin_overview_trend_action_required()
                : m.admin_overview_trend_all_good()
            }
          />
        </Link>
        <Link
          to="/admin/posts"
          search={{ status: "PUBLISHED" }}
          className="block"
        >
          <StatCard
            label={m.admin_overview_stat_published_posts()}
            value={stats.publishedPosts.toString()}
            icon={<FileText size={16} strokeWidth={1.5} />}
            trend={m.admin_overview_trend_active_content()}
          />
        </Link>
        <StatCard
          label={m.admin_overview_stat_media_storage()}
          value={formatBytes(stats.mediaSize)}
          icon={<Database size={16} strokeWidth={1.5} />}
          trend={m.admin_overview_trend_storage_usage()}
        />
        <Link to="/admin/posts" search={{ status: "DRAFT" }} className="block">
          <StatCard
            label={m.admin_overview_stat_drafts()}
            value={stats.drafts.toString()}
            icon={<Activity size={16} strokeWidth={1.5} />}
            trend={m.admin_overview_trend_in_progress()}
          />
        </Link>
      </div>

      {/* Cloudflare Usage */}
      <CloudflareUsageDashboard />

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-6">
        {/* Left: Traffic Analysis */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div
            className="fuwari-card-base p-4 sm:p-5 md:p-6 fuwari-onload-animation"
            style={{ animationDelay: "300ms" }}
          >
            <h2 className="text-lg sm:text-xl font-bold fuwari-text-90 mb-4">
              {m.admin_overview_traffic_title()}
            </h2>
            {overview && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <MetricItem
                  label={m.admin_overview_metric_page_views()}
                  value={overview.pageViews.value}
                  prev={overview.pageViews.prev}
                  icon={<Eye size={16} strokeWidth={1.5} />}
                />
                <MetricItem
                  label={m.admin_overview_metric_visitors()}
                  value={overview.visitors.value}
                  prev={overview.visitors.prev}
                  icon={<Users size={16} strokeWidth={1.5} />}
                />
              </div>
            )}
          </div>

          {traffic && traffic.length > 0 ? (
            <TrafficChart data={traffic} />
          ) : (
            <div
              className="fuwari-card-base h-72 p-4 sm:p-5 md:p-6 flex flex-col items-center justify-center gap-2 fuwari-text-50 fuwari-onload-animation"
              style={{ animationDelay: "350ms" }}
            >
              <Activity size={32} strokeWidth={1.5} className="opacity-30" />
              <p className="text-sm sm:text-base font-medium">
                {m.admin_overview_no_traffic()}
              </p>
            </div>
          )}
        </div>

        {/* Right: Top Pages & Activity */}
        <div className="flex flex-col gap-4">
          <div
            className="fuwari-card-base p-4 sm:p-5 md:p-6 fuwari-onload-animation"
            style={{ animationDelay: "450ms" }}
          >
            <h2 className="text-lg sm:text-xl font-bold fuwari-text-90 mb-4">
              {m.admin_overview_top_pages_title()}
            </h2>
            {topPages && topPages.length > 0 ? (
              <div className="flex flex-col gap-5 lg:gap-6">
                {topPages.slice(0, 5).map((page, i) => (
                  <div key={i} className="group">
                    <div className="flex justify-between items-baseline mb-1.5 gap-2">
                      <span className="text-sm fuwari-text-75 font-medium truncate max-w-45">
                        {page.title}
                      </span>
                      <span className="text-xs sm:text-sm fuwari-text-50 shrink-0">
                        {page.views}
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full overflow-hidden bg-(--fuwari-btn-regular-bg)">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${
                            (page.views /
                              Math.max(...topPages.map((p) => p.views), 1)) *
                            100
                          }%`,
                          backgroundColor: "var(--fuwari-primary)",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm fuwari-text-50">
                {m.admin_overview_no_top_pages()}
              </p>
            )}
          </div>

          <div
            className="fuwari-card-base p-4 sm:p-5 md:p-6 fuwari-onload-animation"
            style={{ animationDelay: "550ms" }}
          >
            <h2 className="text-lg sm:text-xl font-bold fuwari-text-90 mb-4">
              {m.admin_overview_activity_title()}
            </h2>
            {activities.length > 0 ? (
              <div className="flex flex-col gap-3">
                {activities.map((log: ActivityLogItem, i: number) => {
                  const content = (
                    <div className="flex gap-3 items-baseline">
                      <span className="text-xs sm:text-sm fuwari-text-30 w-16 shrink-0">
                        {formatTimeAgo(log.time)}
                      </span>
                      <p className="text-sm fuwari-text-75 leading-relaxed">
                        {log.text}
                      </p>
                    </div>
                  );

                  if (log.link) {
                    return (
                      <Link
                        key={i}
                        to={log.link}
                        className="block -mx-2 px-2 py-1 rounded-lg hover:bg-(--fuwari-btn-plain-bg-hover) transition-colors"
                      >
                        {content}
                      </Link>
                    );
                  }
                  return <div key={i}>{content}</div>;
                })}
              </div>
            ) : (
              <p className="text-sm fuwari-text-50">
                {m.admin_overview_no_activity()}
              </p>
            )}
          </div>
        </div>
      </div>

      {lastUpdatedTime && (
        <p className="text-xs sm:text-sm fuwari-text-30 text-center pt-2">
          {m.admin_overview_last_updated({ time: lastUpdatedTime })}
        </p>
      )}
    </div>
  );
}

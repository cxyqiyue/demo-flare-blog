import { useMutation } from "@tanstack/react-query";
import {
  CheckCircle2,
  ExternalLink,
  KeyRound,
  Loader2,
  Mail,
  Send,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  testCloudflareConnectionFn,
  testCloudflareAlertEmailFn,
  testCloudflareAlertWebhookFn,
} from "@/features/cloudflare-usage/api/cloudflare-usage.api";
import type { SystemConfig } from "@/features/config/config.schema";

type ConnectionStatus = "idle" | "testing" | "success" | "error";

export function CloudflareAnalyticsSettingsSection() {
  const { register, watch } = useFormContext<SystemConfig>();
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("idle");
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const apiToken = watch("cloudflareAnalytics.apiToken") ?? "";

  const emailHost = watch("email.host") ?? "";
  const emailPort = watch("email.port");
  const emailUsername = watch("email.username") ?? "";
  const emailPassword = watch("email.password") ?? "";
  const emailSender = watch("email.senderAddress") ?? "";
  const isEmailConfigured = !!(
    emailHost.trim() &&
    emailPort &&
    emailUsername.trim() &&
    emailPassword.trim() &&
    emailSender.trim()
  );

  const webhooks = watch("notification.webhooks") ?? [];
  const hasEnabledWebhook = webhooks.some(
    (w: { enabled?: boolean }) => w.enabled,
  );

  const isConfigured = apiToken.length > 0;

  const testMutation = useMutation({
    mutationFn: () =>
      testCloudflareConnectionFn({
        data: { apiToken },
      }),
    onMutate: () => {
      setConnectionStatus("testing");
      setConnectionError(null);
    },
    onSuccess: (result: { error?: string }) => {
      if (result.error) {
        setConnectionStatus("error");
        setConnectionError(result.error);
      } else {
        setConnectionStatus("success");
        toast.success("Cloudflare Analytics API 连接成功");
      }
    },
    onError: (error: unknown) => {
      setConnectionStatus("error");
      setConnectionError(
        error instanceof Error ? error.message : String(error),
      );
    },
  });

  const testEmailMutation = useMutation({
    mutationFn: () => testCloudflareAlertEmailFn({ data: undefined }),
    onSuccess: (result: { success: boolean; error?: string }) => {
      if (result.success) {
        toast.success("测试邮件已发送，请检查收件箱");
      } else {
        toast.error("邮件发送失败", { description: result.error });
      }
    },
    onError: (error: unknown) => {
      toast.error("邮件发送失败", {
        description: error instanceof Error ? error.message : String(error),
      });
    },
  });

  const testWebhookMutation = useMutation({
    mutationFn: () => testCloudflareAlertWebhookFn({ data: undefined }),
    onSuccess: (result: {
      success: boolean;
      error?: string;
      results?: Array<{ name: string; success: boolean; error?: string }>;
    }) => {
      if (result.success) {
        toast.success("Webhook 测试消息已发送");
      } else if (result.results) {
        const failed = result.results.filter((r) => !r.success);
        if (failed.length > 0) {
          toast.error(
            `${failed.length} 个 Webhook 发送失败`,
            {
              description: failed.map((r) => `${r.name}: ${r.error}`).join("\n"),
            },
          );
        } else {
          toast.success("Webhook 测试消息已发送");
        }
      } else {
        toast.error("Webhook 测试失败", { description: result.error });
      }
    },
    onError: (error: unknown) => {
      toast.error("Webhook 测试失败", {
        description: error instanceof Error ? error.message : String(error),
      });
    },
  });

  const handleTest = () => {
    if (!isConfigured) return;
    testMutation.mutate();
  };

  const inputClassName =
    "w-full rounded-none border border-border/30 bg-muted/10 px-4 py-6 text-sm text-foreground transition-all focus-visible:border-border/60 focus-visible:ring-1 focus-visible:ring-foreground/10";

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-700">
      {/* General Settings */}
      <div className="space-y-6 p-8">
        <div className="flex items-center gap-4">
          <div className="rounded-sm bg-muted/40 p-2">
            <ExternalLink size={16} className="text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <h5 className="text-sm font-medium text-foreground">
              Cloudflare Analytics API 配置
            </h5>
            <p className="text-xs text-muted-foreground">
              用于查询 Cloudflare 账户用量数据，需要 Account Analytics 读取权限
            </p>
          </div>
        </div>

        <div className="space-y-2 rounded-none border border-border/20 bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">
            Account ID 已从 GitHub Secrets 的{" "}
            <code className="font-mono text-foreground/80">
              CLOUDFLARE_ACCOUNT_ID
            </code>{" "}
            自动读取，无需在此重复填写
          </p>
        </div>

        <div className="space-y-4">
          <label
            htmlFor="cf-analytics-api-token"
            className="text-sm text-muted-foreground"
          >
            API Token
          </label>
          <div className="relative group/input">
            <Input
              id="cf-analytics-api-token"
              type="password"
              placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              {...register("cloudflareAnalytics.apiToken")}
              className={inputClassName}
            />
            <KeyRound
              size={14}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/30"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            需要 Account → Account Analytics → Read 权限
          </p>
        </div>

        {/* Test Connection */}
        <div className="flex items-center gap-4 pt-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!isConfigured || connectionStatus === "testing"}
            onClick={handleTest}
            className="rounded-none border-border/30 text-xs font-mono uppercase tracking-wider"
          >
            {connectionStatus === "testing" ? (
              <>
                <Loader2 size={12} className="animate-spin mr-2" />
                测试中...
              </>
            ) : (
              "测试连接"
            )}
          </Button>

          {connectionStatus === "success" && (
            <div className="flex items-center gap-2 text-xs text-green-600">
              <CheckCircle2 size={12} />
              连接成功
            </div>
          )}
          {connectionStatus === "error" && (
            <div className="flex items-center gap-2 text-xs text-red-500">
              <XCircle size={12} />
              {connectionError ?? "连接失败"}
            </div>
          )}
        </div>
      </div>

      {/* Alert Settings */}
      <div className="space-y-6 p-8 border-t border-border/20">
        <div className="flex items-center gap-4">
          <div className="rounded-sm bg-muted/40 p-2">
            <CheckCircle2 size={16} className="text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <h5 className="text-sm font-medium text-foreground">告警通知</h5>
            <p className="text-xs text-muted-foreground">
              当用量超过阈值时发送邮件和 Webhook 通知
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              {...register("cloudflareAnalytics.alert.enabled")}
              className="rounded-none border-border/30"
            />
            <span className="text-sm text-foreground">启用用量告警</span>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Email Notification */}
          <div className="space-y-3">
            <label
              className={`flex items-center gap-3 ${isEmailConfigured ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}
            >
              <input
                type="checkbox"
                {...register("cloudflareAnalytics.alert.emailEnabled")}
                disabled={!isEmailConfigured}
                className="rounded-none border-border/30"
              />
              <span className="text-sm text-muted-foreground">邮件通知</span>
            </label>
            {!isEmailConfigured && (
              <p className="text-[10px] text-muted-foreground pl-6">
                需先在「邮件服务」中配置 SMTP
              </p>
            )}
            <div className="pl-6">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!isEmailConfigured || testEmailMutation.isPending}
                onClick={() => testEmailMutation.mutate()}
                className="rounded-none border-border/30 text-[10px] font-mono uppercase tracking-wider"
              >
                {testEmailMutation.isPending ? (
                  <Loader2 size={10} className="animate-spin mr-1" />
                ) : (
                  <Mail size={10} className="mr-1" />
                )}
                发送测试邮件
              </Button>
            </div>
          </div>

          {/* Webhook Notification */}
          <div className="space-y-3">
            <label
              className={`flex items-center gap-3 ${hasEnabledWebhook ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}
            >
              <input
                type="checkbox"
                {...register("cloudflareAnalytics.alert.webhookEnabled")}
                disabled={!hasEnabledWebhook}
                className="rounded-none border-border/30"
              />
              <span className="text-sm text-muted-foreground">
                Webhook 通知
              </span>
            </label>
            {!hasEnabledWebhook && (
              <p className="text-[10px] text-muted-foreground pl-6">
                需先在「通知」中配置 Webhook 端点
              </p>
            )}
            <div className="pl-6">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!hasEnabledWebhook || testWebhookMutation.isPending}
                onClick={() => testWebhookMutation.mutate()}
                className="rounded-none border-border/30 text-[10px] font-mono uppercase tracking-wider"
              >
                {testWebhookMutation.isPending ? (
                  <Loader2 size={10} className="animate-spin mr-1" />
                ) : (
                  <Send size={10} className="mr-1" />
                )}
                测试 Webhook
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Doc Panel */}
      <div className="space-y-3 p-8">
        <div className="flex items-center gap-3">
          <h5 className="text-sm font-medium text-foreground">配置说明</h5>
          <ExternalLink size={12} className="text-muted-foreground" />
        </div>
        <div className="text-sm text-muted-foreground leading-relaxed space-y-2">
          <p>
            1. 前往{" "}
            <a
              href="https://dash.cloudflare.com/profile/api-tokens"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              Cloudflare API Tokens
            </a>{" "}
            创建 Token
          </p>
          <p>
            2. 选择{" "}
            <strong className="text-foreground/80">Custom token</strong>
            ，权限设置为 Account → Account Analytics → Read（注意是
            "Account Analytics" 不是 "Analytics"）
          </p>
          <p>
            3. Account ID 已由{" "}
            <code className="font-mono text-foreground/80">
              CLOUDFLARE_ACCOUNT_ID
            </code>{" "}
            环境变量提供，无需额外配置
          </p>
          <p>4. 数据有 10-30 分钟延迟，每小时缓存一次</p>
        </div>
      </div>
    </div>
  );
}

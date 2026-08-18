import {
  Database,
  KeyRound,
  PlugZap,
  Plus,
  Server,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { SystemConfig } from "@/features/config/config.schema";
import {
  S3_DEFAULT_REGIONS,
  S3_PRESET_ENDPOINT_BUILDER,
  S3_PROVIDERS,
  type ApiKeyProvider,
  type ApiKeyProviderType,
  type S3Provider,
  type TestImageHostingConnectionInput,
} from "@/features/image-hosting/image-hosting.schema";
import type { Result } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

type ConnectionStatus = "IDLE" | "TESTING" | "SUCCESS" | "ERROR";

interface ImageHostingSettingsSectionProps {
  testImageHostingConnection: (options: {
    data: TestImageHostingConnectionInput;
  }) => Promise<
    Result<
      { success: true; url: string },
      { reason: "IMAGE_HOSTING_TEST_FAILED"; message: string }
    >
  >;
}

const API_PROVIDER_LABELS: Record<ApiKeyProviderType, string> = {
  imgbb: "ImgBB",
  ffsky: "Ffsky",
};

const API_PROVIDER_DESCS: Record<ApiKeyProviderType, () => string> = {
  imgbb: () => m.settings_image_hosting_api_provider_desc_imgbb(),
  ffsky: () => m.settings_image_hosting_api_provider_desc_ffsky(),
};

const S3_PROVIDER_LABELS: Record<S3Provider, string> = {
  aws: "AWS S3",
  "cloudflare-r2": "Cloudflare R2",
  "aliyun-oss": m.settings_image_hosting_s3_provider_aliyun_oss(),
  "tencent-cos": m.settings_image_hosting_s3_provider_tencent_cos(),
  custom: m.settings_image_hosting_s3_provider_custom(),
};

function generateId(): string {
  try {
    return crypto.randomUUID().slice(0, 8);
  } catch {
    return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }
}

interface EchoBlockProps {
  url: string;
}

function EchoBlock({ url }: EchoBlockProps) {
  return (
    <div className="border border-emerald-500/20 bg-emerald-500/5 p-6">
      <p className="text-xs font-mono uppercase tracking-widest text-emerald-600">
        {m.settings_image_hosting_test_echo()}
      </p>
      <p className="mt-2 break-all font-serif text-sm text-foreground/80">
        {url}
      </p>
    </div>
  );
}

export function ImageHostingSettingsSection({
  testImageHostingConnection,
}: ImageHostingSettingsSectionProps) {
  const { setValue, watch } = useFormContext<SystemConfig>();
  const [editingId, setEditingId] = useState<string | null>(null);

  // ── R2 Native ──
  const r2CommentEnabled =
    watch("imageHosting.r2Native.commentEnabled") ?? false;
  const r2Enabled = r2CommentEnabled;

  // ── S3 ──
  const s3CommentEnabled =
    watch("imageHosting.s3.commentEnabled") ?? false;
  const s3ArticleEnabled =
    watch("imageHosting.s3.articleEnabled") ?? false;
  const s3Enabled = s3CommentEnabled || s3ArticleEnabled;
  const s3Provider = watch("imageHosting.s3.provider") ?? "cloudflare-r2";
  const s3Endpoint = watch("imageHosting.s3.endpoint") ?? "";
  const s3Bucket = watch("imageHosting.s3.bucket") ?? "";
  const s3Region = watch("imageHosting.s3.region") ?? "";
  const s3AccessKeyId = watch("imageHosting.s3.accessKeyId") ?? "";
  const s3SecretAccessKey =
    watch("imageHosting.s3.secretAccessKey") ?? "";
  const s3PathPrefix = watch("imageHosting.s3.pathPrefix") ?? "";
  const s3PublicUrl = watch("imageHosting.s3.publicUrl") ?? "";

  // ── API Key Providers ──
  const apiProviders: ApiKeyProvider[] =
    watch("imageHosting.apiProviders") ?? [];

  // ── Connection Status ──
  const [s3Status, setS3Status] = useState<ConnectionStatus>("IDLE");
  const [s3Echo, setS3Echo] = useState("");
  const [apiStatusMap, setApiStatusMap] = useState<
    Record<string, ConnectionStatus>
  >({});
  const [apiEchoMap, setApiEchoMap] = useState<Record<string, string>>({});

  const setApiStatus = (id: string, status: ConnectionStatus) => {
    setApiStatusMap((prev) => ({ ...prev, [id]: status }));
  };

  const setApiEcho = (id: string, url: string) => {
    setApiEchoMap((prev) => ({ ...prev, [id]: url }));
  };

  // ── S3 Preset ──
  const applyS3Preset = (provider: S3Provider) => {
    setValue("imageHosting.s3.provider", provider, {
      shouldDirty: true,
      shouldTouch: true,
    });
    setValue("imageHosting.s3.region", S3_DEFAULT_REGIONS[provider], {
      shouldDirty: true,
      shouldTouch: true,
    });
    const builder = S3_PRESET_ENDPOINT_BUILDER[provider];
    if (builder) {
      setValue(
        "imageHosting.s3.endpoint",
        builder(S3_DEFAULT_REGIONS[provider]),
        {
          shouldDirty: true,
          shouldTouch: true,
        },
      );
    }
    setS3Status("IDLE");
  };

  // ── Test S3 ──
  const handleTestS3 = async () => {
    setS3Status("TESTING");
    setS3Echo("");
    try {
      const result = await testImageHostingConnection({
        data: {
          category: "s3",
          s3: {
            provider: s3Provider as S3Provider,
            endpoint: s3Endpoint,
            bucket: s3Bucket,
            region: s3Region,
            accessKeyId: s3AccessKeyId,
            secretAccessKey: s3SecretAccessKey,
            pathPrefix: s3PathPrefix,
            publicUrl: s3PublicUrl,
          },
        },
      });
      if (!result.error) {
        setS3Status("SUCCESS");
        setS3Echo(result.data.url);
      } else {
        setS3Status("ERROR");
        toast.error(m.settings_image_hosting_test_error(), {
          description: result.error.message,
        });
      }
    } catch (error) {
      setS3Status("ERROR");
      toast.error(m.settings_image_hosting_test_error(), {
        description:
          error instanceof Error
            ? error.message
            : m.settings_image_hosting_unknown_error(),
      });
    }
  };

  const canTestS3 =
    !!s3AccessKeyId.trim() &&
    !!s3SecretAccessKey.trim() &&
    !!s3Endpoint.trim() &&
    !!s3Bucket.trim();

  // ── Test API Provider ──
  const handleTestApi = async (provider: ApiKeyProvider) => {
    setApiStatus(provider.id, "TESTING");
    setApiEcho(provider.id, "");
    try {
      const result = await testImageHostingConnection({
        data: {
          category: "api-key",
          apiKeyProviderType: provider.type,
          apiKey: provider.apiKey,
          apiEndpoint: provider.apiEndpoint,
        },
      });
      if (!result.error) {
        setApiStatus(provider.id, "SUCCESS");
        setApiEcho(provider.id, result.data.url);
      } else {
        setApiStatus(provider.id, "ERROR");
        toast.error(m.settings_image_hosting_test_error(), {
          description: result.error.message,
        });
      }
    } catch (error) {
      setApiStatus(provider.id, "ERROR");
      toast.error(m.settings_image_hosting_test_error(), {
        description:
          error instanceof Error
            ? error.message
            : m.settings_image_hosting_unknown_error(),
      });
    }
  };

  // ── Add API Provider ──
  const handleAddApiProvider = (type: ApiKeyProviderType) => {
    const newProvider: ApiKeyProvider = {
      id: generateId(),
      name: API_PROVIDER_LABELS[type],
      type,
      apiKey: "",
      apiEndpoint: type === "ffsky" ? "https://api.ffsky.top/api/upload" : "",
      articleEnabled: false,
    };
    const updated = [...apiProviders, newProvider];
    setValue("imageHosting.apiProviders", updated, { shouldDirty: true });
    setEditingId(newProvider.id);
  };

  // ── Delete API Provider ──
  const handleDeleteApiProvider = (id: string) => {
    const updated = apiProviders.filter((p) => p.id !== id);
    setValue("imageHosting.apiProviders", updated, { shouldDirty: true });
    if (editingId === id) setEditingId(null);
  };

  // ── Update API Provider ──
  const updateApiProvider = (
    id: string,
    field: keyof ApiKeyProvider,
    value: string | boolean,
  ) => {
    const updated = apiProviders.map((p) =>
      p.id === id ? { ...p, [field]: value } : p,
    );
    setValue("imageHosting.apiProviders", updated, { shouldDirty: true });
  };

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-700">
      <div className="border border-border/30 bg-background/50 overflow-hidden divide-y divide-border/20">
        {/* ── R2 原生存储 ── */}
        <div className="space-y-6 p-4 md:p-8">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 md:gap-4 min-w-0">
              <div className="rounded-sm bg-muted/40 p-2 shrink-0">
                <Database size={16} className="text-muted-foreground" />
              </div>
              <div className="space-y-1 min-w-0">
                <h5 className="text-sm font-medium text-foreground truncate">
                  {m.settings_image_hosting_r2_native_title()}
                </h5>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {m.settings_image_hosting_r2_native_desc()}
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={r2Enabled}
              onClick={() => {
                const newEnabled = !r2Enabled;
                setValue("imageHosting.r2Native.commentEnabled", newEnabled, {
                  shouldDirty: true,
                });
                setValue("imageHosting.r2Native.articleEnabled", newEnabled, {
                  shouldDirty: true,
                });
              }}
              className={cn(
                "inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                r2Enabled ? "bg-foreground" : "bg-muted/50",
              )}
            >
              <span
                className={cn(
                  "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform",
                  r2Enabled ? "translate-x-5" : "translate-x-0",
                )}
              />
            </button>
          </div>

          {r2Enabled && (
            <div className="space-y-4 pl-0 md:pl-12">
              <p className="text-xs text-muted-foreground">
                {m.settings_image_hosting_r2_native_desc_full()}
              </p>
              <label className="flex cursor-pointer items-center gap-3 md:gap-4 border border-border/20 bg-muted/10 p-3 md:p-4 transition-colors hover:bg-muted/20">
                <Checkbox
                  checked={r2CommentEnabled}
                  onCheckedChange={(checked) =>
                    setValue(
                      "imageHosting.r2Native.commentEnabled",
                      !!checked,
                      { shouldDirty: true },
                    )
                  }
                />
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    {m.settings_image_hosting_field_comment_enabled()}
                  </p>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    {m.settings_image_hosting_r2_native_comment_desc()}
                  </p>
                </div>
              </label>
            </div>
          )}
        </div>

        {/* ── S3 兼容存储 ── */}
        <div className="space-y-6 md:space-y-8 p-4 md:p-8">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 md:gap-4 min-w-0">
              <div className="rounded-sm bg-muted/40 p-2 shrink-0">
                <Server size={16} className="text-muted-foreground" />
              </div>
              <div className="space-y-1 min-w-0">
                <h5 className="text-sm font-medium text-foreground truncate">
                  S3 Compatible Storage
                </h5>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {m.settings_image_hosting_s3_desc_short()}
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={s3Enabled}
              onClick={() => {
                const newEnabled = !s3Enabled;
                setValue("imageHosting.s3.commentEnabled", newEnabled, {
                  shouldDirty: true,
                });
                setValue("imageHosting.s3.articleEnabled", newEnabled, {
                  shouldDirty: true,
                });
              }}
              className={cn(
                "inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                s3Enabled ? "bg-foreground" : "bg-muted/50",
              )}
            >
              <span
                className={cn(
                  "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform",
                  s3Enabled ? "translate-x-5" : "translate-x-0",
                )}
              />
            </button>
          </div>

          {s3Enabled && (
            <div className="space-y-6 pl-0 md:pl-12">
              {/* S3 Provider Presets */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  Provider:
                </span>
                {(S3_PROVIDERS as readonly S3Provider[]).map((provider) => (
                  <button
                    key={provider}
                    type="button"
                    onClick={() => applyS3Preset(provider)}
                    className={cn(
                      "rounded-none border px-3 py-1.5 text-xs transition-colors",
                      s3Provider === provider
                        ? "border-foreground/40 bg-foreground text-background"
                        : "border-border/30 bg-muted/10 text-muted-foreground hover:bg-muted/20",
                    )}
                  >
                    {S3_PROVIDER_LABELS[provider]}
                  </button>
                ))}
              </div>

              {/* Comment / Article Toggles */}
              <div className="grid gap-4 xl:grid-cols-2">
                <label className="flex cursor-pointer items-center gap-4 border border-border/20 bg-muted/10 p-4 transition-colors hover:bg-muted/20">
                  <Checkbox
                    checked={s3CommentEnabled}
                    onCheckedChange={(checked) =>
                      setValue("imageHosting.s3.commentEnabled", !!checked, {
                        shouldDirty: true,
                      })
                    }
                  />
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      {m.settings_image_hosting_field_comment_enabled()}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {m.settings_image_hosting_field_comment_enabled_desc()}
                    </p>
                  </div>
                </label>
              </div>

              {/* S3 Config Fields */}
              <div className="grid grid-cols-1 gap-x-6 gap-y-6 md:gap-x-16 md:gap-y-10 px-0 md:px-2 xl:grid-cols-2">
                <div className="space-y-4">
                  <label className="text-sm text-muted-foreground">
                    Endpoint
                  </label>
                  <Input
                    placeholder="https://..."
                    value={s3Endpoint}
                    onChange={(e) => {
                      setValue("imageHosting.s3.endpoint", e.target.value, {
                        shouldDirty: true,
                      });
                      setS3Status("IDLE");
                    }}
                    className="w-full rounded-none border border-border/30 bg-muted/10 px-4 py-6 text-sm text-foreground transition-all focus-visible:border-border/60 focus-visible:ring-1 focus-visible:ring-foreground/10"
                  />
                </div>

                <div className="space-y-4">
                  <label className="text-sm text-muted-foreground">
                    Bucket
                  </label>
                  <Input
                    placeholder="my-bucket"
                    value={s3Bucket}
                    onChange={(e) => {
                      setValue("imageHosting.s3.bucket", e.target.value, {
                        shouldDirty: true,
                      });
                      setS3Status("IDLE");
                    }}
                    className="w-full rounded-none border border-border/30 bg-muted/10 px-4 py-6 text-sm text-foreground transition-all focus-visible:border-border/60 focus-visible:ring-1 focus-visible:ring-foreground/10"
                  />
                </div>

                <div className="space-y-4">
                  <label className="text-sm text-muted-foreground">
                    Region
                  </label>
                  <Input
                    placeholder="auto"
                    value={s3Region}
                    onChange={(e) => {
                      setValue("imageHosting.s3.region", e.target.value, {
                        shouldDirty: true,
                      });
                      setS3Status("IDLE");
                    }}
                    className="w-full rounded-none border border-border/30 bg-muted/10 px-4 py-6 text-sm text-foreground transition-all focus-visible:border-border/60 focus-visible:ring-1 focus-visible:ring-foreground/10"
                  />
                </div>

                <div className="space-y-4">
                  <label className="text-sm text-muted-foreground">
                    Path Prefix
                  </label>
                  <Input
                    placeholder="images/"
                    value={s3PathPrefix}
                    onChange={(e) => {
                      setValue("imageHosting.s3.pathPrefix", e.target.value, {
                        shouldDirty: true,
                      });
                      setS3Status("IDLE");
                    }}
                    className="w-full rounded-none border border-border/30 bg-muted/10 px-4 py-6 text-sm text-foreground transition-all focus-visible:border-border/60 focus-visible:ring-1 focus-visible:ring-foreground/10"
                  />
                </div>

                <div className="space-y-4">
                  <label className="text-sm text-muted-foreground">
                    Access Key ID
                  </label>
                  <div className="relative">
                    <Input
                      type="password"
                      placeholder="AKIA..."
                      value={s3AccessKeyId}
                      onChange={(e) => {
                        setValue(
                          "imageHosting.s3.accessKeyId",
                          e.target.value,
                          { shouldDirty: true },
                        );
                        setS3Status("IDLE");
                      }}
                      className="w-full rounded-none border border-border/30 bg-muted/10 px-4 py-6 text-sm text-foreground transition-all focus-visible:border-border/60 focus-visible:ring-1 focus-visible:ring-foreground/10 pr-10"
                    />
                    <KeyRound
                      size={14}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/30"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-sm text-muted-foreground">
                    Secret Access Key
                  </label>
                  <div className="relative">
                    <Input
                      type="password"
                      value={s3SecretAccessKey}
                      onChange={(e) => {
                        setValue(
                          "imageHosting.s3.secretAccessKey",
                          e.target.value,
                          { shouldDirty: true },
                        );
                        setS3Status("IDLE");
                      }}
                      className="w-full rounded-none border border-border/30 bg-muted/10 px-4 py-6 text-sm text-foreground transition-all focus-visible:border-border/60 focus-visible:ring-1 focus-visible:ring-foreground/10 pr-10"
                    />
                    <KeyRound
                      size={14}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/30"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-sm text-muted-foreground">
                    Public URL
                  </label>
                  <Input
                    placeholder="https://cdn.example.com"
                    value={s3PublicUrl}
                    onChange={(e) => {
                      setValue("imageHosting.s3.publicUrl", e.target.value, {
                        shouldDirty: true,
                      });
                      setS3Status("IDLE");
                    }}
                    className="w-full rounded-none border border-border/30 bg-muted/10 px-4 py-6 text-sm text-foreground transition-all focus-visible:border-border/60 focus-visible:ring-1 focus-visible:ring-foreground/10"
                  />
                </div>
              </div>

              {/* S3 Test Toolbar */}
              <div className="flex flex-col items-center justify-between gap-4 bg-muted/10 p-4 sm:p-6 sm:px-10 sm:flex-row">
                <div className="flex items-center gap-4 md:gap-6">
                  <div className="flex items-center gap-2 md:gap-3">
                    <div
                      className={cn(
                        "h-2.5 w-2.5 rounded-full transition-all duration-700",
                        s3Status === "SUCCESS"
                          ? "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]"
                          : s3Status === "ERROR"
                            ? "bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.5)]"
                            : s3Status === "TESTING"
                              ? "animate-pulse bg-amber-500"
                              : "bg-muted-foreground/20",
                      )}
                    />
                    <span className="text-xs md:text-sm font-serif font-medium text-foreground">
                      {s3Status === "SUCCESS"
                        ? m.settings_image_hosting_test_success()
                        : s3Status === "ERROR"
                          ? m.settings_image_hosting_test_error()
                          : s3Status === "TESTING"
                            ? m.settings_image_hosting_test_testing()
                            : m.settings_image_hosting_test_idle()}
                    </span>
                  </div>
                  <span className="hidden h-4 w-px bg-border/30 md:block" />
                  <p className="hidden text-xs text-muted-foreground md:block">
                    {s3Status === "IDLE"
                      ? m.settings_image_hosting_test_hint_idle()
                      : m.settings_image_hosting_test_hint_current()}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTestS3}
                  disabled={s3Status === "TESTING" || !canTestS3}
                  className={cn(
                    "h-9 md:h-10 rounded-none border-border/50 px-6 md:px-8 text-[10px] font-mono uppercase tracking-[0.2em] transition-all hover:bg-background",
                    !canTestS3
                      ? "cursor-not-allowed opacity-30"
                      : "text-foreground",
                  )}
                >
                  {s3Status === "TESTING" ? (
                    <span className="mr-3 h-3 w-3 animate-spin rounded-full border border-foreground/20 border-t-foreground" />
                  ) : (
                    <PlugZap size={12} className="mr-3" />
                  )}
                  {s3Status === "TESTING"
                    ? m.settings_image_hosting_test_btn_testing()
                    : m.settings_image_hosting_test_btn_send()}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* ── API Key 图床 ── */}
        <div className="space-y-6 p-4 md:p-8">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="rounded-sm bg-muted/40 p-2 shrink-0">
              <KeyRound size={16} className="text-muted-foreground" />
            </div>
            <div className="space-y-1 min-w-0">
              <h5 className="text-sm font-medium text-foreground truncate">
                {m.settings_image_hosting_api_providers_title()}
              </h5>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {m.settings_image_hosting_api_providers_desc()}
              </p>
            </div>
          </div>

          {/* 已添加的 API Key Providers */}
          {apiProviders.length > 0 && (
            <div className="space-y-3">
              {apiProviders.map((p) => {
                const isExpanded = editingId === p.id;
                const status = apiStatusMap[p.id] ?? "IDLE";
                const echo = apiEchoMap[p.id] ?? "";
                return (
                  <div key={p.id} className="border border-border/30">
                    {/* Provider Header */}
                    <div className="flex items-center gap-2 md:gap-3 p-3 md:p-4">
                      <button
                        type="button"
                        onClick={() =>
                          setEditingId(isExpanded ? null : p.id)
                        }
                        className="flex items-center gap-2 md:gap-3 flex-1 min-w-0 text-left"
                      >
                        <div
                          className={cn(
                            "h-3 w-3 shrink-0 rounded-full border",
                            p.articleEnabled
                              ? "border-foreground bg-foreground"
                              : "border-border/60",
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">
                            {p.name || API_PROVIDER_LABELS[p.type]}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {API_PROVIDER_DESCS[p.type]()}
                          </p>
                        </div>
                      </button>
                      <span className="hidden sm:inline text-[10px] font-mono px-2 py-0.5 rounded bg-muted/50 text-muted-foreground shrink-0">
                        {API_PROVIDER_LABELS[p.type]}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setEditingId(isExpanded ? null : p.id)
                        }
                        className="shrink-0 p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <svg
                          className={cn(
                            "w-4 h-4 transition-transform",
                            isExpanded && "rotate-180",
                          )}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteApiProvider(p.id)}
                        className="shrink-0 p-1.5 text-muted-foreground hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {/* Expanded Config */}
                    {isExpanded && (
                      <div className="border-t border-border/20 p-3 md:p-4 space-y-4 bg-muted/5">
                        <div className="space-y-4">
                          <label className="text-xs text-muted-foreground">
                            {m.settings_image_hosting_provider_name_label()}
                          </label>
                          <Input
                            value={p.name}
                            onChange={(e) =>
                              updateApiProvider(p.id, "name", e.target.value)
                            }
                            className="w-full rounded-none border border-border/30 bg-muted/10 px-4 py-5 text-sm text-foreground"
                          />
                        </div>

                        <label className="flex cursor-pointer items-center gap-4 border border-border/20 bg-muted/10 p-4 transition-colors hover:bg-muted/20">
                          <Checkbox
                            checked={p.articleEnabled}
                            onCheckedChange={(checked) =>
                              updateApiProvider(
                                p.id,
                                "articleEnabled",
                                !!checked,
                              )
                            }
                          />
                          <div className="min-w-0 space-y-1">
                            <p className="text-sm font-medium text-foreground">
                              {m.settings_image_hosting_field_article_enabled()}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {m.settings_image_hosting_field_article_enabled_desc()}
                            </p>
                          </div>
                        </label>

                        {p.type === "ffsky" && (
                          <div className="space-y-4">
                            <label className="text-xs text-muted-foreground">
                              API Endpoint
                            </label>
                            <Input
                              value={p.apiEndpoint ?? ""}
                              onChange={(e) =>
                                updateApiProvider(
                                  p.id,
                                  "apiEndpoint",
                                  e.target.value,
                                )
                              }
                              placeholder="https://api.ffsky.top/api/upload"
                              className="w-full rounded-none border border-border/30 bg-muted/10 px-4 py-5 text-sm text-foreground"
                            />
                          </div>
                        )}

                        <div className="space-y-4">
                          <label className="text-xs text-muted-foreground">
                            API Key
                          </label>
                          <div className="relative">
                            <Input
                              type="password"
                              value={p.apiKey ?? ""}
                              onChange={(e) =>
                                updateApiProvider(
                                  p.id,
                                  "apiKey",
                                  e.target.value,
                                )
                              }
                              className="w-full rounded-none border border-border/30 bg-muted/10 px-4 py-5 text-sm text-foreground pr-10"
                            />
                            <KeyRound
                              size={14}
                              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/30"
                            />
                          </div>
                        </div>

                        {/* Test Toolbar */}
                        <div className="flex flex-col items-center justify-between gap-3 bg-muted/10 p-3 sm:p-4 sm:flex-row">
                          <div className="flex items-center gap-2 md:gap-3">
                            <div
                              className={cn(
                                "h-2 w-2 rounded-full transition-all duration-700",
                                status === "SUCCESS"
                                  ? "bg-emerald-500"
                                  : status === "ERROR"
                                    ? "bg-red-500"
                                    : status === "TESTING"
                                      ? "animate-pulse bg-amber-500"
                                      : "bg-muted-foreground/20",
                              )}
                            />
                            <span className="text-xs font-serif text-foreground">
                              {status === "SUCCESS"
                                ? m.settings_image_hosting_provider_status_success()
                                : status === "ERROR"
                                  ? m.settings_image_hosting_provider_status_error()
                                  : status === "TESTING"
                                    ? m.settings_image_hosting_provider_status_testing()
                                    : m.settings_image_hosting_provider_status_idle()}
                            </span>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleTestApi(p)}
                            disabled={status === "TESTING" || !p.apiKey?.trim()}
                            className={cn(
                              "h-8 md:h-9 rounded-none border-border/50 px-5 md:px-6 text-[10px] font-mono uppercase tracking-[0.2em] transition-all hover:bg-background",
                              !p.apiKey?.trim()
                                ? "cursor-not-allowed opacity-30"
                                : "text-foreground",
                            )}
                          >
                            {status === "TESTING" ? (
                              <span className="mr-2 h-3 w-3 animate-spin rounded-full border border-foreground/20 border-t-foreground" />
                            ) : (
                              <PlugZap size={11} className="mr-2" />
                            )}
                            {status === "TESTING" ? "Testing..." : "Test"}
                          </Button>
                        </div>

                        {status === "SUCCESS" && echo && <EchoBlock url={echo} />}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Add API Provider Buttons */}
          <div className="flex flex-wrap gap-2">
            {(
              ["imgbb", "ffsky"] as readonly ApiKeyProviderType[]
            ).map((type) => (
              <Button
                key={type}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleAddApiProvider(type)}
                className="rounded-none border-border/30 text-xs font-mono"
              >
                <Plus size={12} className="mr-2" />
                {API_PROVIDER_LABELS[type]}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* S3 Echo */}
      {s3Status === "SUCCESS" && s3Echo && <EchoBlock url={s3Echo} />}
    </div>
  );
}

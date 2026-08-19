import {
  Brain,
  Circle,
  CircleDot,
  Database,
  Globe,
  KeyRound,
  MessageSquare,
  PlugZap,
  Plus,
  Server,
  Send,
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
  type ActiveImageHostingProvider,
  type ApiKeyProvider,
  type ApiKeyProviderType,
  type S3Provider,
  type TestImageHostingConnectionInput,
} from "@/features/image-hosting/image-hosting.schema";
import type { Result } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

type ConnectionStatus = "IDLE" | "TESTING" | "SUCCESS" | "ERROR";

type ProviderId = ActiveImageHostingProvider;

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

const PROVIDER_DEFS: {
  id: ProviderId;
  label: string;
  desc: string;
  icon: typeof Database;
}[] = [
  {
    id: "r2-native",
    label: "R2 Native Storage",
    desc: m.settings_image_hosting_r2_native_desc(),
    icon: Database,
  },
  {
    id: "s3",
    label: "S3 Compatible Storage",
    desc: m.settings_image_hosting_s3_desc_short(),
    icon: Server,
  },
  {
    id: "api-key",
    label: m.settings_image_hosting_api_providers_title(),
    desc: m.settings_image_hosting_api_providers_desc(),
    icon: KeyRound,
  },
  {
    id: "telegram",
    label: m.settings_image_hosting_telegram_title(),
    desc: m.settings_image_hosting_telegram_desc(),
    icon: Send,
  },
  {
    id: "discord",
    label: m.settings_image_hosting_discord_title(),
    desc: m.settings_image_hosting_discord_desc(),
    icon: MessageSquare,
  },
  {
    id: "huggingface",
    label: m.settings_image_hosting_huggingface_title(),
    desc: m.settings_image_hosting_huggingface_desc(),
    icon: Brain,
  },
  {
    id: "webdav",
    label: m.settings_image_hosting_webdav_title(),
    desc: m.settings_image_hosting_webdav_desc(),
    icon: Globe,
  },
];

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

const INPUT_CLASS =
  "w-full rounded-none border border-border/30 bg-muted/10 px-4 py-5 text-sm text-foreground transition-all focus-visible:border-border/60 focus-visible:ring-1 focus-visible:ring-foreground/10";

function StatusDot({ status }: { status: ConnectionStatus }) {
  return (
    <div
      className={cn(
        "h-2.5 w-2.5 rounded-full transition-all duration-700",
        status === "SUCCESS"
          ? "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]"
          : status === "ERROR"
            ? "bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.5)]"
            : status === "TESTING"
              ? "animate-pulse bg-amber-500"
              : "bg-muted-foreground/20",
      )}
    />
  );
}

function StatusLabel({ status }: { status: ConnectionStatus }) {
  const text =
    status === "SUCCESS"
      ? m.settings_image_hosting_test_success()
      : status === "ERROR"
        ? m.settings_image_hosting_test_error()
        : status === "TESTING"
          ? m.settings_image_hosting_test_testing()
          : m.settings_image_hosting_test_idle();
  return (
    <span className="text-xs md:text-sm font-serif font-medium text-foreground">
      {text}
    </span>
  );
}

function TestToolbar({
  status,
  onTest,
  canTest,
  hintOverride,
}: {
  status: ConnectionStatus;
  onTest: () => void;
  canTest: boolean;
  hintOverride?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-between gap-3 bg-muted/10 p-3 sm:p-4 sm:flex-row">
      <div className="flex items-center gap-2 md:gap-3">
        <StatusDot status={status} />
        <StatusLabel status={status} />
        <span className="hidden h-4 w-px bg-border/30 md:block" />
        <p className="hidden text-xs text-muted-foreground md:block">
          {hintOverride ??
            (status === "IDLE"
              ? m.settings_image_hosting_test_hint_idle()
              : m.settings_image_hosting_test_hint_current())}
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={onTest}
        disabled={status === "TESTING" || !canTest}
        className={cn(
          "h-8 md:h-9 rounded-none border-border/50 px-5 md:px-6 text-[10px] font-mono uppercase tracking-[0.2em] transition-all hover:bg-background",
          !canTest ? "cursor-not-allowed opacity-30" : "text-foreground",
        )}
      >
        {status === "TESTING" ? (
          <span className="mr-2 h-3 w-3 animate-spin rounded-full border border-foreground/20 border-t-foreground" />
        ) : (
          <PlugZap size={11} className="mr-2" />
        )}
        {status === "TESTING"
          ? m.settings_image_hosting_test_btn_testing()
          : m.settings_image_hosting_test_btn_send()}
      </Button>
    </div>
  );
}

function EchoBlock({ url }: { url: string }) {
  return (
    <div className="border border-emerald-500/20 bg-emerald-500/5 p-4 md:p-6">
      <p className="text-xs font-mono uppercase tracking-widest text-emerald-600">
        {m.settings_image_hosting_test_echo()}
      </p>
      <p className="mt-2 break-all font-serif text-sm text-foreground/80">{url}</p>
    </div>
  );
}

export function ImageHostingSettingsSection({
  testImageHostingConnection,
}: ImageHostingSettingsSectionProps) {
  const { setValue, watch } = useFormContext<SystemConfig>();

  const activeProvider = watch("imageHosting.activeProvider") ?? null;

  // ── S3 fields ──
  const s3Provider = watch("imageHosting.s3.provider") ?? "cloudflare-r2";
  const s3Endpoint = watch("imageHosting.s3.endpoint") ?? "";
  const s3Bucket = watch("imageHosting.s3.bucket") ?? "";
  const s3Region = watch("imageHosting.s3.region") ?? "";
  const s3AccessKeyId = watch("imageHosting.s3.accessKeyId") ?? "";
  const s3SecretAccessKey = watch("imageHosting.s3.secretAccessKey") ?? "";
  const s3PathPrefix = watch("imageHosting.s3.pathPrefix") ?? "";
  const s3PublicUrl = watch("imageHosting.s3.publicUrl") ?? "";
  const s3PathStyle = watch("imageHosting.s3.pathStyle") ?? true;

  // ── API Key Providers ──
  const apiProviders: ApiKeyProvider[] = watch("imageHosting.apiProviders") ?? [];

  // ── Telegram ──
  const tgBotToken = watch("imageHosting.telegram.botToken") ?? "";
  const tgChatId = watch("imageHosting.telegram.chatId") ?? "";
  const tgProxyUrl = watch("imageHosting.telegram.proxyUrl") ?? "";

  // ── Discord ──
  const dcBotToken = watch("imageHosting.discord.botToken") ?? "";
  const dcChannelId = watch("imageHosting.discord.channelId") ?? "";
  const dcProxyUrl = watch("imageHosting.discord.proxyUrl") ?? "";
  const dcIsNitro = watch("imageHosting.discord.isNitro") ?? false;

  // ── HuggingFace ──
  const hfToken = watch("imageHosting.huggingface.token") ?? "";
  const hfRepo = watch("imageHosting.huggingface.repo") ?? "";
  const hfIsPrivate = watch("imageHosting.huggingface.isPrivate") ?? false;

  // ── WebDAV ──
  const wdBaseUrl = watch("imageHosting.webdav.baseUrl") ?? "";
  const wdUsername = watch("imageHosting.webdav.username") ?? "";
  const wdPassword = watch("imageHosting.webdav.password") ?? "";
  const wdPublicUrl = watch("imageHosting.webdav.publicUrl") ?? "";
  const wdCreateDir = watch("imageHosting.webdav.createDirectory") ?? true;

  // ── Connection Status ──
  const [s3Status, setS3Status] = useState<ConnectionStatus>("IDLE");
  const [s3Echo, setS3Echo] = useState("");
  const [apiStatusMap, setApiStatusMap] = useState<Record<string, ConnectionStatus>>({});
  const [apiEchoMap, setApiEchoMap] = useState<Record<string, string>>({});
  const [telegramStatus, setTelegramStatus] = useState<ConnectionStatus>("IDLE");
  const [telegramEcho, setTelegramEcho] = useState("");
  const [discordStatus, setDiscordStatus] = useState<ConnectionStatus>("IDLE");
  const [discordEcho, setDiscordEcho] = useState("");
  const [hfStatus, setHfStatus] = useState<ConnectionStatus>("IDLE");
  const [hfEcho, setHfEcho] = useState("");
  const [wdStatus, setWdStatus] = useState<ConnectionStatus>("IDLE");
  const [wdEcho, setWdEcho] = useState("");

  const [editingApiId, setEditingApiId] = useState<string | null>(null);

  // ── Select Provider ──
  const selectProvider = (id: ProviderId | null) => {
    setValue("imageHosting.activeProvider", id, { shouldDirty: true });
    // Clear old enabled flags for backward compatibility
    setValue("imageHosting.r2Native.articleEnabled", false, { shouldDirty: true });
    setValue("imageHosting.r2Native.commentEnabled", false, { shouldDirty: true });
    setValue("imageHosting.s3.articleEnabled", false, { shouldDirty: true });
    setValue("imageHosting.s3.commentEnabled", false, { shouldDirty: true });
    if (apiProviders.length > 0) {
      setValue(
        "imageHosting.apiProviders",
        apiProviders.map((p) => ({
          ...p,
          articleEnabled: false,
          commentEnabled: false,
        })),
        { shouldDirty: true },
      );
    }
    // Reset statuses
    setS3Status("IDLE");
    setS3Echo("");
    setTelegramStatus("IDLE");
    setTelegramEcho("");
    setDiscordStatus("IDLE");
    setDiscordEcho("");
    setHfStatus("IDLE");
    setHfEcho("");
    setWdStatus("IDLE");
    setWdEcho("");
  };

  // ── S3 Preset ──
  const applyS3Preset = (provider: S3Provider) => {
    setValue("imageHosting.s3.provider", provider, { shouldDirty: true, shouldTouch: true });
    setValue("imageHosting.s3.region", S3_DEFAULT_REGIONS[provider], {
      shouldDirty: true,
      shouldTouch: true,
    });
    const builder = S3_PRESET_ENDPOINT_BUILDER[provider];
    if (builder) {
      setValue("imageHosting.s3.endpoint", builder(S3_DEFAULT_REGIONS[provider]), {
        shouldDirty: true,
        shouldTouch: true,
      });
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
            pathStyle: s3PathStyle,
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
          error instanceof Error ? error.message : m.settings_image_hosting_unknown_error(),
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
    setApiStatus((p) => ({ ...p, [provider.id]: "TESTING" }));
    setApiEcho((p) => ({ ...p, [provider.id]: "" }));
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
        setApiStatus((p) => ({ ...p, [provider.id]: "SUCCESS" }));
        setApiEcho((p) => ({ ...p, [provider.id]: result.data.url }));
      } else {
        setApiStatus((p) => ({ ...p, [provider.id]: "ERROR" }));
        toast.error(m.settings_image_hosting_test_error(), {
          description: result.error.message,
        });
      }
    } catch (error) {
      setApiStatus((p) => ({ ...p, [provider.id]: "ERROR" }));
      toast.error(m.settings_image_hosting_test_error(), {
        description:
          error instanceof Error ? error.message : m.settings_image_hosting_unknown_error(),
      });
    }
  };

  const setApiStatus = (updater: (prev: Record<string, ConnectionStatus>) => Record<string, ConnectionStatus>) => {
    setApiStatusMap(updater);
  };

  const setApiEcho = (updater: (prev: Record<string, string>) => Record<string, string>) => {
    setApiEchoMap(updater);
  };

  // ── Test Telegram ──
  const handleTestTelegram = async () => {
    setTelegramStatus("TESTING");
    setTelegramEcho("");
    try {
      const result = await testImageHostingConnection({
        data: {
          category: "telegram",
          telegram: { botToken: tgBotToken, chatId: tgChatId, proxyUrl: tgProxyUrl },
        },
      });
      if (!result.error) {
        setTelegramStatus("SUCCESS");
        setTelegramEcho(result.data.url);
      } else {
        setTelegramStatus("ERROR");
        toast.error(m.settings_image_hosting_test_error(), {
          description: result.error.message,
        });
      }
    } catch (error) {
      setTelegramStatus("ERROR");
      toast.error(m.settings_image_hosting_test_error(), {
        description:
          error instanceof Error ? error.message : m.settings_image_hosting_unknown_error(),
      });
    }
  };

  const canTestTelegram = !!tgBotToken.trim() && !!tgChatId.trim();

  // ── Test Discord ──
  const handleTestDiscord = async () => {
    setDiscordStatus("TESTING");
    setDiscordEcho("");
    try {
      const result = await testImageHostingConnection({
        data: {
          category: "discord",
          discord: {
            botToken: dcBotToken,
            channelId: dcChannelId,
            proxyUrl: dcProxyUrl,
            isNitro: dcIsNitro,
          },
        },
      });
      if (!result.error) {
        setDiscordStatus("SUCCESS");
        setDiscordEcho(result.data.url);
      } else {
        setDiscordStatus("ERROR");
        toast.error(m.settings_image_hosting_test_error(), {
          description: result.error.message,
        });
      }
    } catch (error) {
      setDiscordStatus("ERROR");
      toast.error(m.settings_image_hosting_test_error(), {
        description:
          error instanceof Error ? error.message : m.settings_image_hosting_unknown_error(),
      });
    }
  };

  const canTestDiscord = !!dcBotToken.trim() && !!dcChannelId.trim();

  // ── Test HuggingFace ──
  const handleTestHuggingFace = async () => {
    setHfStatus("TESTING");
    setHfEcho("");
    try {
      const result = await testImageHostingConnection({
        data: {
          category: "huggingface",
          huggingface: { token: hfToken, repo: hfRepo, isPrivate: hfIsPrivate },
        },
      });
      if (!result.error) {
        setHfStatus("SUCCESS");
        setHfEcho(result.data.url);
      } else {
        setHfStatus("ERROR");
        toast.error(m.settings_image_hosting_test_error(), {
          description: result.error.message,
        });
      }
    } catch (error) {
      setHfStatus("ERROR");
      toast.error(m.settings_image_hosting_test_error(), {
        description:
          error instanceof Error ? error.message : m.settings_image_hosting_unknown_error(),
      });
    }
  };

  const canTestHf = !!hfToken.trim() && !!hfRepo.trim();

  // ── Test WebDAV ──
  const handleTestWebDAV = async () => {
    setWdStatus("TESTING");
    setWdEcho("");
    try {
      const result = await testImageHostingConnection({
        data: {
          category: "webdav",
          webdav: {
            baseUrl: wdBaseUrl,
            username: wdUsername,
            password: wdPassword,
            publicUrl: wdPublicUrl,
            createDirectory: wdCreateDir,
          },
        },
      });
      if (!result.error) {
        setWdStatus("SUCCESS");
        setWdEcho(result.data.url);
      } else {
        setWdStatus("ERROR");
        toast.error(m.settings_image_hosting_test_error(), {
          description: result.error.message,
        });
      }
    } catch (error) {
      setWdStatus("ERROR");
      toast.error(m.settings_image_hosting_test_error(), {
        description:
          error instanceof Error ? error.message : m.settings_image_hosting_unknown_error(),
      });
    }
  };

  const canTestWebDAV = !!wdBaseUrl.trim() && !!wdUsername.trim();

  // ── API Key helpers ──
  const addApiProvider = (type: ApiKeyProviderType) => {
    const newProvider: ApiKeyProvider = {
      id: generateId(),
      name: API_PROVIDER_LABELS[type],
      type,
      apiKey: "",
      apiEndpoint: type === "ffsky" ? "https://api.ffsky.top/api/upload" : "",
      articleEnabled: true,
      commentEnabled: true,
    };
    const updated = [...apiProviders, newProvider];
    setValue("imageHosting.apiProviders", updated, { shouldDirty: true });
    setEditingApiId(newProvider.id);
  };

  const deleteApiProvider = (id: string) => {
    const updated = apiProviders.filter((p) => p.id !== id);
    setValue("imageHosting.apiProviders", updated, { shouldDirty: true });
    if (editingApiId === id) setEditingApiId(null);
  };

  const updateApiProvider = (id: string, field: keyof ApiKeyProvider, value: string | boolean) => {
    const updated = apiProviders.map((p) => (p.id === id ? { ...p, [field]: value } : p));
    setValue("imageHosting.apiProviders", updated, { shouldDirty: true });
  };

  // ════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-700">
      <div className="border border-border/30 bg-background/50 overflow-hidden divide-y divide-border/20">
        {PROVIDER_DEFS.map((def) => {
          const isActive = activeProvider === def.id;
          const Icon = def.icon;
          return (
            <div key={def.id} className="space-y-0">
              {/* ── Radio Row ── */}
              <button
                type="button"
                onClick={() => selectProvider(isActive ? null : def.id)}
                className="flex w-full items-center gap-3 md:gap-4 p-4 md:p-8 text-left transition-colors hover:bg-muted/10"
              >
                <div className="shrink-0 text-muted-foreground">
                  {isActive ? <CircleDot size={18} /> : <Circle size={18} />}
                </div>
                <div className="rounded-sm bg-muted/40 p-2 shrink-0">
                  <Icon size={16} className="text-muted-foreground" />
                </div>
                <div className="space-y-1 min-w-0 flex-1">
                  <h5 className="text-sm font-medium text-foreground truncate">{def.label}</h5>
                  <p className="text-xs text-muted-foreground line-clamp-2">{def.desc}</p>
                </div>
              </button>

              {/* ── Expanded Config ── */}
              {isActive && (
                <div className="border-t border-border/20 p-4 md:p-8 md:pl-20 space-y-6 bg-muted/5 animate-in fade-in slide-in-from-top-1 duration-300">

                  {/* ── R2 Native Config ── */}
                  {def.id === "r2-native" && (
                    <div className="space-y-4">
                      <p className="text-xs text-muted-foreground">
                        {m.settings_image_hosting_r2_native_desc_full()}
                      </p>
                    </div>
                  )}

                  {/* ── S3 Config ── */}
                  {def.id === "s3" && (
                    <div className="space-y-6">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-muted-foreground">Provider:</span>
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

                      <div className="grid grid-cols-1 gap-x-6 gap-y-6 md:gap-x-16 md:gap-y-10 lg:grid-cols-2">
                        <div className="space-y-4">
                          <label className="text-sm text-muted-foreground">Endpoint</label>
                          <Input
                            placeholder="https://..."
                            value={s3Endpoint}
                            onChange={(e) => {
                              setValue("imageHosting.s3.endpoint", e.target.value, { shouldDirty: true });
                              setS3Status("IDLE");
                            }}
                            className={INPUT_CLASS}
                          />
                        </div>

                        <div className="space-y-4">
                          <label className="text-sm text-muted-foreground">Bucket</label>
                          <Input
                            placeholder="my-bucket"
                            value={s3Bucket}
                            onChange={(e) => {
                              setValue("imageHosting.s3.bucket", e.target.value, { shouldDirty: true });
                              setS3Status("IDLE");
                            }}
                            className={INPUT_CLASS}
                          />
                        </div>

                        <div className="space-y-4">
                          <label className="text-sm text-muted-foreground">Region</label>
                          <Input
                            placeholder="auto"
                            value={s3Region}
                            onChange={(e) => {
                              setValue("imageHosting.s3.region", e.target.value, { shouldDirty: true });
                              setS3Status("IDLE");
                            }}
                            className={INPUT_CLASS}
                          />
                        </div>

                        <div className="space-y-4">
                          <label className="text-sm text-muted-foreground">Path Prefix</label>
                          <Input
                            placeholder="images/"
                            value={s3PathPrefix}
                            onChange={(e) => {
                              setValue("imageHosting.s3.pathPrefix", e.target.value, { shouldDirty: true });
                              setS3Status("IDLE");
                            }}
                            className={INPUT_CLASS}
                          />
                        </div>

                        <div className="space-y-4">
                          <label className="text-sm text-muted-foreground">Access Key ID</label>
                          <div className="relative">
                            <Input
                              type="password"
                              placeholder="AKIA..."
                              value={s3AccessKeyId}
                              onChange={(e) => {
                                setValue("imageHosting.s3.accessKeyId", e.target.value, { shouldDirty: true });
                                setS3Status("IDLE");
                              }}
                              className={cn(INPUT_CLASS, "pr-10")}
                            />
                            <KeyRound
                              size={14}
                              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/30"
                            />
                          </div>
                        </div>

                        <div className="space-y-4">
                          <label className="text-sm text-muted-foreground">Secret Access Key</label>
                          <div className="relative">
                            <Input
                              type="password"
                              value={s3SecretAccessKey}
                              onChange={(e) => {
                                setValue("imageHosting.s3.secretAccessKey", e.target.value, { shouldDirty: true });
                                setS3Status("IDLE");
                              }}
                              className={cn(INPUT_CLASS, "pr-10")}
                            />
                            <KeyRound
                              size={14}
                              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/30"
                            />
                          </div>
                        </div>

                        <div className="space-y-4">
                          <label className="text-sm text-muted-foreground">Public URL</label>
                          <Input
                            placeholder="https://cdn.example.com"
                            value={s3PublicUrl}
                            onChange={(e) => {
                              setValue("imageHosting.s3.publicUrl", e.target.value, { shouldDirty: true });
                              setS3Status("IDLE");
                            }}
                            className={INPUT_CLASS}
                          />
                        </div>

                        {/* Path Style Toggle */}
                        <div className="space-y-4">
                          <label className="text-sm text-muted-foreground">
                            {m.settings_image_hosting_field_path_style_label()}
                          </label>
                          <div className="flex items-center gap-3 py-1">
                            <Checkbox
                              checked={s3PathStyle}
                              onCheckedChange={(checked) => {
                                setValue("imageHosting.s3.pathStyle", checked, { shouldDirty: true });
                                setS3Status("IDLE");
                              }}
                            />
                            <span className="text-xs text-muted-foreground">
                              {s3PathStyle ? "endpoint/bucket/key" : "bucket.endpoint/key"}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground/70">
                            {s3PathStyle
                              ? m.settings_image_hosting_field_path_style_desc_path()
                              : m.settings_image_hosting_field_path_style_desc_virtual()}
                          </p>
                        </div>
                      </div>

                      <TestToolbar
                        status={s3Status}
                        onTest={handleTestS3}
                        canTest={canTestS3}
                        hintOverride={
                          canTestS3
                            ? undefined
                            : m.settings_image_hosting_test_missing_s3_config()
                        }
                      />
                      {s3Status === "SUCCESS" && s3Echo && <EchoBlock url={s3Echo} />}
                    </div>
                  )}

                  {/* ── API Key Config ── */}
                  {def.id === "api-key" && (
                    <div className="space-y-4">
                      {apiProviders.length > 0 && (
                        <div className="space-y-3">
                          {apiProviders.map((p) => {
                            const isExpanded = editingApiId === p.id;
                            const status = apiStatusMap[p.id] ?? "IDLE";
                            const echo = apiEchoMap[p.id] ?? "";
                            return (
                              <div key={p.id} className="border border-border/30">
                                <div className="flex items-center gap-2 md:gap-3 p-3 md:p-4">
                                  <button
                                    type="button"
                                    onClick={() => setEditingApiId(isExpanded ? null : p.id)}
                                    className="flex items-center gap-2 md:gap-3 flex-1 min-w-0 text-left"
                                  >
                                    <div
                                      className={cn(
                                        "h-3 w-3 shrink-0 rounded-full border",
                                        p.articleEnabled ? "border-foreground bg-foreground" : "border-border/60",
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
                                    onClick={() => setEditingApiId(isExpanded ? null : p.id)}
                                    className="shrink-0 p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                                  >
                                    <svg
                                      className={cn("w-4 h-4 transition-transform", isExpanded && "rotate-180")}
                                      fill="none"
                                      viewBox="0 0 24 24"
                                      stroke="currentColor"
                                      strokeWidth={2}
                                    >
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                    </svg>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => deleteApiProvider(p.id)}
                                    className="shrink-0 p-1.5 text-muted-foreground hover:text-red-500 transition-colors"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>

                                {isExpanded && (
                                  <div className="border-t border-border/20 p-3 md:p-4 space-y-4 bg-muted/5">
                                    <div className="space-y-4">
                                      <label className="text-xs text-muted-foreground">
                                        {m.settings_image_hosting_provider_name_label()}
                                      </label>
                                      <Input
                                        value={p.name}
                                        onChange={(e) => updateApiProvider(p.id, "name", e.target.value)}
                                        className="w-full rounded-none border border-border/30 bg-muted/10 px-4 py-5 text-sm text-foreground"
                                      />
                                    </div>

                                    {p.type === "ffsky" && (
                                      <div className="space-y-4">
                                        <label className="text-xs text-muted-foreground">API Endpoint</label>
                                        <Input
                                          value={p.apiEndpoint ?? ""}
                                          onChange={(e) => updateApiProvider(p.id, "apiEndpoint", e.target.value)}
                                          placeholder="https://api.ffsky.top/api/upload"
                                          className="w-full rounded-none border border-border/30 bg-muted/10 px-4 py-5 text-sm text-foreground"
                                        />
                                      </div>
                                    )}

                                    <div className="space-y-4">
                                      <label className="text-xs text-muted-foreground">API Key</label>
                                      <div className="relative">
                                        <Input
                                          type="password"
                                          value={p.apiKey ?? ""}
                                          onChange={(e) => updateApiProvider(p.id, "apiKey", e.target.value)}
                                          className="w-full rounded-none border border-border/30 bg-muted/10 px-4 py-5 text-sm text-foreground pr-10"
                                        />
                                        <KeyRound
                                          size={14}
                                          className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/30"
                                        />
                                      </div>
                                    </div>

                                    <TestToolbar
                                      status={status}
                                      onTest={() => handleTestApi(p)}
                                      canTest={!!p.apiKey?.trim()}
                                    />
                                    {status === "SUCCESS" && echo && <EchoBlock url={echo} />}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2">
                        {(["imgbb", "ffsky"] as readonly ApiKeyProviderType[]).map((type) => (
                          <Button
                            key={type}
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => addApiProvider(type)}
                            className="rounded-none border-border/30 text-xs font-mono"
                          >
                            <Plus size={12} className="mr-2" />
                            {API_PROVIDER_LABELS[type]}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Telegram Config ── */}
                  {def.id === "telegram" && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 gap-x-6 gap-y-6 md:gap-x-16 md:gap-y-10 lg:grid-cols-2">
                        <div className="space-y-4">
                          <label className="text-sm text-muted-foreground">
                            {m.settings_image_hosting_field_bot_token_label()}
                          </label>
                          <div className="relative">
                            <Input
                              type="password"
                              placeholder="123456:ABC-..."
                              value={tgBotToken}
                              onChange={(e) => {
                                setValue("imageHosting.telegram.botToken", e.target.value, { shouldDirty: true });
                                setTelegramStatus("IDLE");
                              }}
                              className={cn(INPUT_CLASS, "pr-10")}
                            />
                            <KeyRound
                              size={14}
                              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/30"
                            />
                          </div>
                        </div>

                        <div className="space-y-4">
                          <label className="text-sm text-muted-foreground">
                            {m.settings_image_hosting_field_chat_id_label()}
                          </label>
                          <Input
                            placeholder="-100..."
                            value={tgChatId}
                            onChange={(e) => {
                              setValue("imageHosting.telegram.chatId", e.target.value, { shouldDirty: true });
                              setTelegramStatus("IDLE");
                            }}
                            className={INPUT_CLASS}
                          />
                        </div>

                        <div className="space-y-4 lg:col-span-2">
                          <label className="text-sm text-muted-foreground">
                            {m.settings_image_hosting_field_proxy_url_label()}
                          </label>
                          <Input
                            placeholder="https://..."
                            value={tgProxyUrl}
                            onChange={(e) => {
                              setValue("imageHosting.telegram.proxyUrl", e.target.value, { shouldDirty: true });
                              setTelegramStatus("IDLE");
                            }}
                            className={INPUT_CLASS}
                          />
                        </div>
                      </div>

                      <TestToolbar status={telegramStatus} onTest={handleTestTelegram} canTest={canTestTelegram} />
                      {telegramStatus === "SUCCESS" && telegramEcho && <EchoBlock url={telegramEcho} />}
                    </div>
                  )}

                  {/* ── Discord Config ── */}
                  {def.id === "discord" && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 gap-x-6 gap-y-6 md:gap-x-16 md:gap-y-10 lg:grid-cols-2">
                        <div className="space-y-4">
                          <label className="text-sm text-muted-foreground">
                            {m.settings_image_hosting_field_bot_token_label()}
                          </label>
                          <div className="relative">
                            <Input
                              type="password"
                              placeholder="MT..."
                              value={dcBotToken}
                              onChange={(e) => {
                                setValue("imageHosting.discord.botToken", e.target.value, { shouldDirty: true });
                                setDiscordStatus("IDLE");
                              }}
                              className={cn(INPUT_CLASS, "pr-10")}
                            />
                            <KeyRound
                              size={14}
                              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/30"
                            />
                          </div>
                        </div>

                        <div className="space-y-4">
                          <label className="text-sm text-muted-foreground">
                            {m.settings_image_hosting_field_channel_id_label()}
                          </label>
                          <Input
                            placeholder="123456789"
                            value={dcChannelId}
                            onChange={(e) => {
                              setValue("imageHosting.discord.channelId", e.target.value, { shouldDirty: true });
                              setDiscordStatus("IDLE");
                            }}
                            className={INPUT_CLASS}
                          />
                        </div>

                        <div className="space-y-4 lg:col-span-2">
                          <label className="text-sm text-muted-foreground">
                            {m.settings_image_hosting_field_proxy_url_label()}
                          </label>
                          <Input
                            placeholder="https://..."
                            value={dcProxyUrl}
                            onChange={(e) => {
                              setValue("imageHosting.discord.proxyUrl", e.target.value, { shouldDirty: true });
                              setDiscordStatus("IDLE");
                            }}
                            className={INPUT_CLASS}
                          />
                        </div>

                        <div className="space-y-4 lg:col-span-2">
                          <label className="text-sm text-muted-foreground">
                            {m.settings_image_hosting_field_nitro_boost_label()}
                          </label>
                          <div className="flex items-center gap-3 py-1">
                            <Checkbox
                              checked={dcIsNitro}
                              onCheckedChange={(checked) => {
                                setValue("imageHosting.discord.isNitro", checked, { shouldDirty: true });
                                setDiscordStatus("IDLE");
                              }}
                            />
                            <span className="text-xs text-muted-foreground">
                              {m.settings_image_hosting_field_nitro_boost_desc()}
                            </span>
                          </div>
                        </div>
                      </div>

                      <TestToolbar
                        status={discordStatus}
                        onTest={handleTestDiscord}
                        canTest={canTestDiscord}
                      />
                      {discordStatus === "SUCCESS" && discordEcho && <EchoBlock url={discordEcho} />}
                    </div>
                  )}

                  {/* ── HuggingFace Config ── */}
                  {def.id === "huggingface" && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 gap-x-6 gap-y-6 md:gap-x-16 md:gap-y-10 lg:grid-cols-2">
                        <div className="space-y-4">
                          <label className="text-sm text-muted-foreground">
                            {m.settings_image_hosting_field_hf_token_label()}
                          </label>
                          <div className="relative">
                            <Input
                              type="password"
                              placeholder="hf_..."
                              value={hfToken}
                              onChange={(e) => {
                                setValue("imageHosting.huggingface.token", e.target.value, { shouldDirty: true });
                                setHfStatus("IDLE");
                              }}
                              className={cn(INPUT_CLASS, "pr-10")}
                            />
                            <KeyRound
                              size={14}
                              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/30"
                            />
                          </div>
                        </div>

                        <div className="space-y-4">
                          <label className="text-sm text-muted-foreground">
                            {m.settings_image_hosting_field_hf_repo_label()}
                          </label>
                          <Input
                            placeholder="username/repo-name"
                            value={hfRepo}
                            onChange={(e) => {
                              setValue("imageHosting.huggingface.repo", e.target.value, { shouldDirty: true });
                              setHfStatus("IDLE");
                            }}
                            className={INPUT_CLASS}
                          />
                        </div>

                        <div className="space-y-4 lg:col-span-2">
                          <label className="text-sm text-muted-foreground">
                            {m.settings_image_hosting_field_hf_private_label()}
                          </label>
                          <div className="flex items-center gap-3 py-1">
                            <Checkbox
                              checked={hfIsPrivate}
                              onCheckedChange={(checked) => {
                                setValue("imageHosting.huggingface.isPrivate", checked, { shouldDirty: true });
                                setHfStatus("IDLE");
                              }}
                            />
                            <span className="text-xs text-muted-foreground">
                              {m.settings_image_hosting_field_hf_private_desc()}
                            </span>
                          </div>
                        </div>
                      </div>

                      <TestToolbar
                        status={hfStatus}
                        onTest={handleTestHuggingFace}
                        canTest={canTestHf}
                      />
                      {hfStatus === "SUCCESS" && hfEcho && <EchoBlock url={hfEcho} />}
                    </div>
                  )}

                  {/* ── WebDAV Config ── */}
                  {def.id === "webdav" && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 gap-x-6 gap-y-6 md:gap-x-16 md:gap-y-10 lg:grid-cols-2">
                        <div className="space-y-4">
                          <label className="text-sm text-muted-foreground">
                            {m.settings_image_hosting_field_webdav_base_url_label()}
                          </label>
                          <Input
                            placeholder="https://dav.example.com"
                            value={wdBaseUrl}
                            onChange={(e) => {
                              setValue("imageHosting.webdav.baseUrl", e.target.value, { shouldDirty: true });
                              setWdStatus("IDLE");
                            }}
                            className={INPUT_CLASS}
                          />
                        </div>

                        <div className="space-y-4">
                          <label className="text-sm text-muted-foreground">
                            {m.settings_image_hosting_field_webdav_username_label()}
                          </label>
                          <Input
                            value={wdUsername}
                            onChange={(e) => {
                              setValue("imageHosting.webdav.username", e.target.value, { shouldDirty: true });
                              setWdStatus("IDLE");
                            }}
                            className={INPUT_CLASS}
                          />
                        </div>

                        <div className="space-y-4">
                          <label className="text-sm text-muted-foreground">
                            {m.settings_image_hosting_field_webdav_password_label()}
                          </label>
                          <div className="relative">
                            <Input
                              type="password"
                              value={wdPassword}
                              onChange={(e) => {
                                setValue("imageHosting.webdav.password", e.target.value, { shouldDirty: true });
                                setWdStatus("IDLE");
                              }}
                              className={cn(INPUT_CLASS, "pr-10")}
                            />
                            <KeyRound
                              size={14}
                              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/30"
                            />
                          </div>
                        </div>

                        <div className="space-y-4">
                          <label className="text-sm text-muted-foreground">
                            {m.settings_image_hosting_field_webdav_public_url_label()}
                          </label>
                          <Input
                            placeholder="https://cdn.example.com/images"
                            value={wdPublicUrl}
                            onChange={(e) => {
                              setValue("imageHosting.webdav.publicUrl", e.target.value, { shouldDirty: true });
                              setWdStatus("IDLE");
                            }}
                            className={INPUT_CLASS}
                          />
                        </div>

                        <div className="space-y-4 lg:col-span-2">
                          <label className="text-sm text-muted-foreground">
                            {m.settings_image_hosting_field_webdav_create_dir_label()}
                          </label>
                          <div className="flex items-center gap-3 py-1">
                            <Checkbox
                              checked={wdCreateDir}
                              onCheckedChange={(checked) => {
                                setValue("imageHosting.webdav.createDirectory", checked, { shouldDirty: true });
                                setWdStatus("IDLE");
                              }}
                            />
                            <span className="text-xs text-muted-foreground">
                              {m.settings_image_hosting_field_webdav_create_dir_desc()}
                            </span>
                          </div>
                        </div>
                      </div>

                      <TestToolbar
                        status={wdStatus}
                        onTest={handleTestWebDAV}
                        canTest={canTestWebDAV}
                      />
                      {wdStatus === "SUCCESS" && wdEcho && <EchoBlock url={wdEcho} />}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

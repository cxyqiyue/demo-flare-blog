import {
  CloudUpload,
  Image as ImageIcon,
  KeyRound,
  PlugZap,
  Server,
} from "lucide-react";
import { type Dispatch, type SetStateAction, useState } from "react";
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
  type S3Provider,
  type TestImageHostingConnectionInput,
} from "@/features/image-hosting/image-hosting.schema";
import type { Result } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

type ConnectionStatus = "IDLE" | "TESTING" | "SUCCESS" | "ERROR";
type Provider = "imgbb" | "ffsky" | "s3";

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

interface TestToolbarProps {
  status: ConnectionStatus;
  onTest: () => void;
  canTest: boolean;
}

function TestToolbar({ status, onTest, canTest }: TestToolbarProps) {
  return (
    <div className="flex flex-col items-center justify-between gap-6 bg-muted/10 p-6 px-10 sm:flex-row">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
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
          <span className="text-sm font-serif font-medium text-foreground">
            {status === "SUCCESS"
              ? m.settings_image_hosting_test_success()
              : status === "ERROR"
                ? m.settings_image_hosting_test_error()
                : status === "TESTING"
                  ? m.settings_image_hosting_test_testing()
                  : m.settings_image_hosting_test_idle()}
          </span>
        </div>

        <span className="hidden h-4 w-px bg-border/30 md:block" />

        <p className="hidden text-xs text-muted-foreground md:block">
          {status === "IDLE"
            ? m.settings_image_hosting_test_hint_idle()
            : m.settings_image_hosting_test_hint_current()}
        </p>
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={onTest}
        disabled={status === "TESTING" || !canTest}
        className={cn(
          "h-10 rounded-none border-border/50 px-8 text-[10px] font-mono uppercase tracking-[0.2em] transition-all hover:bg-background",
          !canTest ? "cursor-not-allowed opacity-30" : "text-foreground",
        )}
      >
        {status === "TESTING" ? (
          <span className="mr-3 h-3 w-3 animate-spin rounded-full border border-foreground/20 border-t-foreground" />
        ) : (
          <PlugZap size={12} className="mr-3" />
        )}
        {status === "TESTING"
          ? m.settings_image_hosting_test_btn_testing()
          : m.settings_image_hosting_test_btn_send()}
      </Button>
    </div>
  );
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
  const { register, setValue, watch } = useFormContext<SystemConfig>();

  const imgbbCommentEnabled =
    watch("imageHosting.imgbb.commentEnabled") ?? false;
  const imgbbArticleEnabled =
    watch("imageHosting.imgbb.articleEnabled") ?? false;
  const imgbbApiKey = watch("imageHosting.imgbb.apiKey") ?? "";
  const ffskyArticleEnabled =
    watch("imageHosting.ffsky.articleEnabled") ?? false;
  const ffskyApiKey = watch("imageHosting.ffsky.apiKey") ?? "";
  const ffskyApiEndpoint = watch("imageHosting.ffsky.apiEndpoint") ?? "";

  const s3CommentEnabled = watch("imageHosting.s3.commentEnabled") ?? false;
  const s3ArticleEnabled = watch("imageHosting.s3.articleEnabled") ?? false;
  const s3Provider = watch("imageHosting.s3.provider") ?? "cloudflare-r2";
  const s3Endpoint = watch("imageHosting.s3.endpoint") ?? "";
  const s3Bucket = watch("imageHosting.s3.bucket") ?? "";
  const s3Region = watch("imageHosting.s3.region") ?? "";
  const s3AccessKeyId = watch("imageHosting.s3.accessKeyId") ?? "";
  const s3SecretAccessKey = watch("imageHosting.s3.secretAccessKey") ?? "";
  const s3PathPrefix = watch("imageHosting.s3.pathPrefix") ?? "";
  const s3PublicUrl = watch("imageHosting.s3.publicUrl") ?? "";

  const [imgbbStatus, setImgbbStatus] = useState<ConnectionStatus>("IDLE");
  const [ffskyStatus, setFfskyStatus] = useState<ConnectionStatus>("IDLE");
  const [s3Status, setS3Status] = useState<ConnectionStatus>("IDLE");
  const [imgbbEcho, setImgbbEcho] = useState("");
  const [ffskyEcho, setFfskyEcho] = useState("");
  const [s3Echo, setS3Echo] = useState("");

  /**
   * 评论/文章图片托管通道互斥：同一通道只允许一个托管方启用。
   * 启用某个托管方时，自动关闭其余托管方的对应通道。
   */
  const setCommentProvider = (provider: "imgbb" | "s3", checked: boolean) => {
    setValue(
      "imageHosting.imgbb.commentEnabled",
      provider === "imgbb" ? checked : false,
      {
        shouldDirty: true,
        shouldTouch: true,
      },
    );
    setValue(
      "imageHosting.s3.commentEnabled",
      provider === "s3" ? checked : false,
      {
        shouldDirty: true,
        shouldTouch: true,
      },
    );
    setImgbbStatus("IDLE");
    setS3Status("IDLE");
  };

  const setArticleProvider = (
    provider: "imgbb" | "ffsky" | "s3",
    checked: boolean,
  ) => {
    setValue(
      "imageHosting.imgbb.articleEnabled",
      provider === "imgbb" ? checked : false,
      {
        shouldDirty: true,
        shouldTouch: true,
      },
    );
    setValue(
      "imageHosting.ffsky.articleEnabled",
      provider === "ffsky" ? checked : false,
      {
        shouldDirty: true,
        shouldTouch: true,
      },
    );
    setValue(
      "imageHosting.s3.articleEnabled",
      provider === "s3" ? checked : false,
      {
        shouldDirty: true,
        shouldTouch: true,
      },
    );
    setImgbbStatus("IDLE");
    setFfskyStatus("IDLE");
    setS3Status("IDLE");
  };

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

  const handleTest = async (provider: Provider) => {
    let apiKey: string;
    let apiEndpoint: string | undefined;
    let s3: TestImageHostingConnectionInput["s3"] | undefined;
    let setStatus: Dispatch<SetStateAction<ConnectionStatus>>;
    let setEcho: Dispatch<SetStateAction<string>>;

    if (provider === "s3") {
      apiKey = s3AccessKeyId;
      apiEndpoint = undefined;
      s3 = {
        provider: s3Provider as S3Provider,
        endpoint: s3Endpoint,
        bucket: s3Bucket,
        region: s3Region,
        accessKeyId: s3AccessKeyId,
        secretAccessKey: s3SecretAccessKey,
        pathPrefix: s3PathPrefix,
        publicUrl: s3PublicUrl,
      };
      setStatus = setS3Status;
      setEcho = setS3Echo;
    } else if (provider === "imgbb") {
      apiKey = imgbbApiKey;
      apiEndpoint = undefined;
      s3 = undefined;
      setStatus = setImgbbStatus;
      setEcho = setImgbbEcho;
    } else {
      apiKey = ffskyApiKey;
      apiEndpoint = ffskyApiEndpoint;
      s3 = undefined;
      setStatus = setFfskyStatus;
      setEcho = setFfskyEcho;
    }

    setStatus("TESTING");
    setEcho("");

    try {
      const result = await testImageHostingConnection({
        data: { provider, apiKey, apiEndpoint, s3 },
      });

      if (!result.error) {
        setStatus("SUCCESS");
        setEcho(result.data.url);
      } else {
        setStatus("ERROR");
        toast.error(m.settings_image_hosting_test_error(), {
          description: result.error.message,
        });
      }
    } catch (error) {
      setStatus("ERROR");
      toast.error(m.settings_image_hosting_test_error(), {
        description:
          error instanceof Error
            ? error.message
            : m.settings_image_hosting_unknown_error(),
      });
    }
  };

  const canTestImgbb = !!imgbbApiKey.trim();
  const canTestFfsky = !!ffskyApiKey.trim();
  const canTestS3 =
    !!s3AccessKeyId.trim() &&
    !!s3SecretAccessKey.trim() &&
    !!s3Endpoint.trim() &&
    !!s3Bucket.trim();

  const S3_PROVIDER_LABELS: Record<S3Provider, () => string> = {
    aws: () => m.settings_image_hosting_s3_provider_aws_s3(),
    "cloudflare-r2": () => m.settings_image_hosting_s3_provider_cloudflare_r2(),
    "aliyun-oss": () => m.settings_image_hosting_s3_provider_aliyun_oss(),
    "tencent-cos": () => m.settings_image_hosting_s3_provider_tencent_cos(),
    custom: () => m.settings_image_hosting_s3_provider_custom(),
  };

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-700">
      <div className="border border-border/30 bg-background/50 overflow-hidden divide-y divide-border/20">
        {/* ImgBB */}
        <div className="space-y-8 p-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="rounded-sm bg-muted/40 p-2">
                <ImageIcon size={16} className="text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <h5 className="text-sm font-medium text-foreground">
                  {m.settings_image_hosting_provider_imgbb_title()}
                </h5>
                <p className="text-xs text-muted-foreground">
                  {m.settings_image_hosting_provider_imgbb_desc()}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <label className="flex cursor-pointer items-center gap-4 border border-border/20 bg-muted/10 p-4 transition-colors hover:bg-muted/20">
              <Checkbox
                checked={imgbbCommentEnabled}
                onCheckedChange={(checked) =>
                  setCommentProvider("imgbb", !!checked)
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
            <label className="flex cursor-pointer items-center gap-4 border border-border/20 bg-muted/10 p-4 transition-colors hover:bg-muted/20">
              <Checkbox
                checked={imgbbArticleEnabled}
                onCheckedChange={(checked) =>
                  setArticleProvider("imgbb", !!checked)
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
          </div>

          <div className="space-y-4">
            <label
              htmlFor="image-hosting-imgbb-api-key"
              className="text-sm text-muted-foreground"
            >
              {m.settings_image_hosting_field_api_key_label()}
            </label>
            <div className="relative group/input">
              <Input
                id="image-hosting-imgbb-api-key"
                type="password"
                placeholder={m.settings_image_hosting_field_api_key_ph()}
                {...register("imageHosting.imgbb.apiKey", {
                  onChange: () => setImgbbStatus("IDLE"),
                })}
                className="w-full rounded-none border border-border/30 bg-muted/10 px-4 py-6 text-sm text-foreground transition-all focus-visible:border-border/60 focus-visible:ring-1 focus-visible:ring-foreground/10"
              />
              <KeyRound
                size={14}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/30"
              />
            </div>
          </div>

          <TestToolbar
            status={imgbbStatus}
            canTest={canTestImgbb}
            onTest={() => handleTest("imgbb")}
          />
        </div>

        {/* Ffsky */}
        <div className="space-y-8 p-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="rounded-sm bg-muted/40 p-2">
                <CloudUpload size={16} className="text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <h5 className="text-sm font-medium text-foreground">
                  {m.settings_image_hosting_provider_ffsky_title()}
                </h5>
                <p className="text-xs text-muted-foreground">
                  {m.settings_image_hosting_provider_ffsky_desc()}
                </p>
              </div>
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-4 border border-border/20 bg-muted/10 p-4 transition-colors hover:bg-muted/20">
            <Checkbox
              checked={ffskyArticleEnabled}
              onCheckedChange={(checked) =>
                setArticleProvider("ffsky", !!checked)
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

          <div className="grid grid-cols-1 gap-x-16 gap-y-10 px-2 xl:grid-cols-2">
            <div className="space-y-4">
              <label
                htmlFor="image-hosting-ffsky-api-endpoint"
                className="text-sm text-muted-foreground"
              >
                {m.settings_image_hosting_field_api_endpoint_label()}
              </label>
              <Input
                id="image-hosting-ffsky-api-endpoint"
                placeholder={m.settings_image_hosting_field_api_endpoint_ph()}
                {...register("imageHosting.ffsky.apiEndpoint", {
                  onChange: () => setFfskyStatus("IDLE"),
                })}
                className="w-full rounded-none border border-border/30 bg-muted/10 px-4 py-6 text-sm text-foreground transition-all focus-visible:border-border/60 focus-visible:ring-1 focus-visible:ring-foreground/10"
              />
            </div>

            <div className="space-y-4">
              <label
                htmlFor="image-hosting-ffsky-api-key"
                className="text-sm text-muted-foreground"
              >
                {m.settings_image_hosting_field_api_key_label()}
              </label>
              <div className="relative group/input">
                <Input
                  id="image-hosting-ffsky-api-key"
                  type="password"
                  placeholder={m.settings_image_hosting_field_api_key_ph()}
                  {...register("imageHosting.ffsky.apiKey", {
                    onChange: () => setFfskyStatus("IDLE"),
                  })}
                  className="w-full rounded-none border border-border/30 bg-muted/10 px-4 py-6 text-sm text-foreground transition-all focus-visible:border-border/60 focus-visible:ring-1 focus-visible:ring-foreground/10"
                />
                <KeyRound
                  size={14}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/30"
                />
              </div>
            </div>
          </div>

          <TestToolbar
            status={ffskyStatus}
            canTest={canTestFfsky}
            onTest={() => handleTest("ffsky")}
          />
        </div>

        {/* S3 兼容存储（Cloudflare R2 / AWS S3 / 阿里云 OSS / 腾讯云 COS） */}
        <div className="space-y-8 p-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="rounded-sm bg-muted/40 p-2">
                <Server size={16} className="text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <h5 className="text-sm font-medium text-foreground">
                  {m.settings_image_hosting_provider_s3_title()}
                </h5>
                <p className="text-xs text-muted-foreground">
                  {m.settings_image_hosting_provider_s3_desc()}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {m.settings_image_hosting_field_s3_provider_label()}:
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
                {S3_PROVIDER_LABELS[provider]()}
              </button>
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <label className="flex cursor-pointer items-center gap-4 border border-border/20 bg-muted/10 p-4 transition-colors hover:bg-muted/20">
              <Checkbox
                checked={s3CommentEnabled}
                onCheckedChange={(checked) =>
                  setCommentProvider("s3", !!checked)
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
            <label className="flex cursor-pointer items-center gap-4 border border-border/20 bg-muted/10 p-4 transition-colors hover:bg-muted/20">
              <Checkbox
                checked={s3ArticleEnabled}
                onCheckedChange={(checked) =>
                  setArticleProvider("s3", !!checked)
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
          </div>

          <div className="grid grid-cols-1 gap-x-16 gap-y-10 px-2 xl:grid-cols-2">
            <div className="space-y-4">
              <label
                htmlFor="image-hosting-s3-endpoint"
                className="text-sm text-muted-foreground"
              >
                {m.settings_image_hosting_field_s3_endpoint_label()}
              </label>
              <Input
                id="image-hosting-s3-endpoint"
                placeholder={m.settings_image_hosting_field_s3_endpoint_ph()}
                {...register("imageHosting.s3.endpoint", {
                  onChange: () => setS3Status("IDLE"),
                })}
                className="w-full rounded-none border border-border/30 bg-muted/10 px-4 py-6 text-sm text-foreground transition-all focus-visible:border-border/60 focus-visible:ring-1 focus-visible:ring-foreground/10"
              />
            </div>

            <div className="space-y-4">
              <label
                htmlFor="image-hosting-s3-bucket"
                className="text-sm text-muted-foreground"
              >
                {m.settings_image_hosting_field_s3_bucket_label()}
              </label>
              <Input
                id="image-hosting-s3-bucket"
                placeholder={m.settings_image_hosting_field_s3_bucket_ph()}
                {...register("imageHosting.s3.bucket", {
                  onChange: () => setS3Status("IDLE"),
                })}
                className="w-full rounded-none border border-border/30 bg-muted/10 px-4 py-6 text-sm text-foreground transition-all focus-visible:border-border/60 focus-visible:ring-1 focus-visible:ring-foreground/10"
              />
            </div>

            <div className="space-y-4">
              <label
                htmlFor="image-hosting-s3-region"
                className="text-sm text-muted-foreground"
              >
                {m.settings_image_hosting_field_s3_region_label()}
              </label>
              <Input
                id="image-hosting-s3-region"
                placeholder={m.settings_image_hosting_field_s3_region_ph()}
                {...register("imageHosting.s3.region", {
                  onChange: () => setS3Status("IDLE"),
                })}
                className="w-full rounded-none border border-border/30 bg-muted/10 px-4 py-6 text-sm text-foreground transition-all focus-visible:border-border/60 focus-visible:ring-1 focus-visible:ring-foreground/10"
              />
            </div>

            <div className="space-y-4">
              <label
                htmlFor="image-hosting-s3-path-prefix"
                className="text-sm text-muted-foreground"
              >
                {m.settings_image_hosting_field_s3_path_prefix_label()}
              </label>
              <Input
                id="image-hosting-s3-path-prefix"
                placeholder={m.settings_image_hosting_field_s3_path_prefix_ph()}
                {...register("imageHosting.s3.pathPrefix", {
                  onChange: () => setS3Status("IDLE"),
                })}
                className="w-full rounded-none border border-border/30 bg-muted/10 px-4 py-6 text-sm text-foreground transition-all focus-visible:border-border/60 focus-visible:ring-1 focus-visible:ring-foreground/10"
              />
            </div>

            <div className="space-y-4">
              <label
                htmlFor="image-hosting-s3-access-key-id"
                className="text-sm text-muted-foreground"
              >
                {m.settings_image_hosting_field_s3_access_key_id_label()}
              </label>
              <div className="relative group/input">
                <Input
                  id="image-hosting-s3-access-key-id"
                  type="password"
                  placeholder={m.settings_image_hosting_field_s3_access_key_id_ph()}
                  {...register("imageHosting.s3.accessKeyId", {
                    onChange: () => setS3Status("IDLE"),
                  })}
                  className="w-full rounded-none border border-border/30 bg-muted/10 px-4 py-6 text-sm text-foreground transition-all focus-visible:border-border/60 focus-visible:ring-1 focus-visible:ring-foreground/10"
                />
                <KeyRound
                  size={14}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/30"
                />
              </div>
            </div>

            <div className="space-y-4">
              <label
                htmlFor="image-hosting-s3-secret-access-key"
                className="text-sm text-muted-foreground"
              >
                {m.settings_image_hosting_field_s3_secret_access_key_label()}
              </label>
              <div className="relative group/input">
                <Input
                  id="image-hosting-s3-secret-access-key"
                  type="password"
                  placeholder={m.settings_image_hosting_field_s3_secret_access_key_ph()}
                  {...register("imageHosting.s3.secretAccessKey", {
                    onChange: () => setS3Status("IDLE"),
                  })}
                  className="w-full rounded-none border border-border/30 bg-muted/10 px-4 py-6 text-sm text-foreground transition-all focus-visible:border-border/60 focus-visible:ring-1 focus-visible:ring-foreground/10"
                />
                <KeyRound
                  size={14}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/30"
                />
              </div>
            </div>

            <div className="space-y-4">
              <label
                htmlFor="image-hosting-s3-public-url"
                className="text-sm text-muted-foreground"
              >
                {m.settings_image_hosting_field_s3_public_url_label()}
              </label>
              <Input
                id="image-hosting-s3-public-url"
                placeholder={m.settings_image_hosting_field_s3_public_url_ph()}
                {...register("imageHosting.s3.publicUrl", {
                  onChange: () => setS3Status("IDLE"),
                })}
                className="w-full rounded-none border border-border/30 bg-muted/10 px-4 py-6 text-sm text-foreground transition-all focus-visible:border-border/60 focus-visible:ring-1 focus-visible:ring-foreground/10"
              />
            </div>
          </div>

          <TestToolbar
            status={s3Status}
            canTest={canTestS3}
            onTest={() => handleTest("s3")}
          />
        </div>
      </div>

      {imgbbStatus === "SUCCESS" && imgbbEcho && <EchoBlock url={imgbbEcho} />}
      {ffskyStatus === "SUCCESS" && ffskyEcho && <EchoBlock url={ffskyEcho} />}
      {s3Status === "SUCCESS" && s3Echo && <EchoBlock url={s3Echo} />}
    </div>
  );
}

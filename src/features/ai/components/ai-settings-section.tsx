import { Cpu, KeyRound, PlugZap, Server } from "lucide-react";
import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AI_PROVIDER_NAMES, type AiProviderName } from "@/features/ai/ai.service";
import type { TestAiConnectionInput } from "@/features/ai/ai.schema";
import type { SystemConfig } from "@/features/config/config.schema";
import type { Result } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

type ConnectionStatus = "IDLE" | "TESTING" | "SUCCESS" | "ERROR";

interface AiSettingsSectionProps {
  testAiConnection: (options: { data: TestAiConnectionInput }) => Promise<
    Result<
      { success: boolean; echo: string },
      { reason: "AI_CONNECTION_FAILED"; message: string }
    >
  >;
}

export function AiSettingsSection({
  testAiConnection,
}: AiSettingsSectionProps) {
  const [status, setStatus] = useState<ConnectionStatus>("IDLE");
  const [echo, setEcho] = useState("");

  const {
    register,
    setValue,
    watch,
    formState: { errors },
  } = useFormContext<SystemConfig>();

  const aiConfig = watch("ai");
  const provider = aiConfig?.provider ?? "workers-ai";
  const isOpenAiCompatible = provider === "openai-compatible";
  const openai = aiConfig?.openaiCompatible;

  const isOpenAiConfigured = !!openai?.baseUrl?.trim() && !!openai?.model?.trim();
  const canTest = isOpenAiCompatible ? isOpenAiConfigured : true;

  const handleTest = async () => {
    if (!canTest) return;
    setStatus("TESTING");
    setEcho("");

    try {
      const result = await testAiConnection({
        data: {
          provider,
          openaiCompatible: {
            baseUrl: openai?.baseUrl || "",
            apiKey: openai?.apiKey || "",
            model: openai?.model || "",
          },
        },
      });

      if (!result.error) {
        setStatus("SUCCESS");
        setEcho(result.data?.echo ?? "");
      } else {
        setStatus("ERROR");
        toast.error(m.settings_ai_test_error(), {
          description: result.error.message,
        });
      }
    } catch (error) {
      setStatus("ERROR");
      toast.error(m.settings_ai_test_error(), {
        description:
          error instanceof Error
            ? error.message
            : m.settings_ai_unknown_error(),
      });
    }
  };

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-700">
      <div className="border border-border/30 bg-background/50 overflow-hidden divide-y divide-border/20">
        {/* Provider Selection */}
        <div className="space-y-8 p-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="rounded-sm bg-muted/40 p-2">
                <Cpu size={16} className="text-muted-foreground" />
              </div>
              <h5 className="text-sm font-medium text-foreground">
                {m.settings_ai_provider_title()}
              </h5>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 px-2 md:grid-cols-2">
            {AI_PROVIDER_NAMES.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => {
                  setValue("ai.provider", name as AiProviderName, {
                    shouldDirty: true,
                    shouldTouch: true,
                    shouldValidate: true,
                  });
                  setStatus("IDLE");
                }}
                className={cn(
                  "flex items-start gap-3 border p-4 text-left transition-all",
                  provider === name
                    ? "border-foreground bg-muted/20"
                    : "border-border/30 hover:border-border/60",
                )}
              >
                <div
                  className={cn(
                    "mt-1 h-3 w-3 shrink-0 rounded-full border",
                    provider === name
                      ? "border-foreground bg-foreground"
                      : "border-border/60",
                  )}
                />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    {name === "workers-ai"
                      ? m.settings_ai_provider_workers_ai()
                      : m.settings_ai_provider_openai_compatible()}
                  </p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {name === "workers-ai"
                      ? m.settings_ai_provider_workers_ai_desc()
                      : m.settings_ai_provider_openai_compatible_desc()}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* OpenAI-Compatible Credentials */}
        {isOpenAiCompatible && (
          <div className="space-y-8 p-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="rounded-sm bg-muted/40 p-2">
                  <Server size={16} className="text-muted-foreground" />
                </div>
                <h5 className="text-sm font-medium text-foreground">
                  {m.settings_ai_creds_title()}
                </h5>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-x-16 gap-y-10 px-2 xl:grid-cols-2">
              <div className="space-y-4">
                <label
                  htmlFor="ai-base-url"
                  className="text-sm text-muted-foreground"
                >
                  {m.settings_ai_creds_base_url_label()}
                </label>
                <Input
                  id="ai-base-url"
                  placeholder={m.settings_ai_creds_base_url_ph()}
                  {...register("ai.openaiCompatible.baseUrl", {
                    onChange: () => setStatus("IDLE"),
                  })}
                  className="w-full rounded-none border border-border/30 bg-muted/10 px-4 py-6 text-sm text-foreground transition-all focus-visible:border-border/60 focus-visible:ring-1 focus-visible:ring-foreground/10"
                />
                {errors.ai?.openaiCompatible?.baseUrl?.message && (
                  <p className="text-xs text-red-500">
                    ! {errors.ai.openaiCompatible.baseUrl.message}
                  </p>
                )}
              </div>

              <div className="space-y-4">
                <label
                  htmlFor="ai-model"
                  className="text-sm text-muted-foreground"
                >
                  {m.settings_ai_creds_model_label()}
                </label>
                <Input
                  id="ai-model"
                  placeholder={m.settings_ai_creds_model_ph()}
                  {...register("ai.openaiCompatible.model", {
                    onChange: () => setStatus("IDLE"),
                  })}
                  className="w-full rounded-none border border-border/30 bg-muted/10 px-4 py-6 text-sm text-foreground transition-all focus-visible:border-border/60 focus-visible:ring-1 focus-visible:ring-foreground/10"
                />
                {errors.ai?.openaiCompatible?.model?.message && (
                  <p className="text-xs text-red-500">
                    ! {errors.ai.openaiCompatible.model.message}
                  </p>
                )}
              </div>

              <div className="space-y-4 xl:col-span-2">
                <label
                  htmlFor="ai-api-key"
                  className="text-sm text-muted-foreground"
                >
                  {m.settings_ai_creds_api_key_label()}
                </label>
                <div className="relative group/input">
                  <Input
                    id="ai-api-key"
                    type="password"
                    placeholder={m.settings_ai_creds_api_key_ph()}
                    {...register("ai.openaiCompatible.apiKey", {
                      onChange: () => setStatus("IDLE"),
                    })}
                    className="w-full rounded-none border border-border/30 bg-muted/10 px-4 py-6 text-sm text-foreground transition-all focus-visible:border-border/60 focus-visible:ring-1 focus-visible:ring-foreground/10"
                  />
                  <KeyRound
                    size={14}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/30"
                  />
                </div>
                {errors.ai?.openaiCompatible?.apiKey?.message && (
                  <p className="text-xs text-red-500">
                    ! {errors.ai.openaiCompatible.apiKey.message}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Test Toolbar */}
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
                  ? m.settings_ai_test_success()
                  : status === "ERROR"
                    ? m.settings_ai_test_error()
                    : status === "TESTING"
                      ? m.settings_ai_test_testing()
                      : m.settings_ai_test_idle()}
              </span>
            </div>

            <span className="hidden h-4 w-px bg-border/30 md:block" />

            <p className="hidden text-xs text-muted-foreground md:block">
              {status === "IDLE"
                ? m.settings_ai_test_hint_idle()
                : m.settings_ai_test_hint_current()}
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={handleTest}
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
              ? m.settings_ai_test_btn_testing()
              : m.settings_ai_test_btn_send()}
          </Button>
        </div>
      </div>

      {status === "SUCCESS" && echo && (
        <div className="border border-emerald-500/20 bg-emerald-500/5 p-6">
          <p className="text-xs font-mono uppercase tracking-widest text-emerald-600">
            {m.settings_ai_test_echo()}
          </p>
          <p className="mt-2 font-serif italic text-foreground/80">{echo}</p>
        </div>
      )}
    </div>
  );
}

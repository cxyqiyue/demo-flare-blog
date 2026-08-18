import {
  Cpu,
  KeyRound,
  PenLine,
  PlugZap,
  Plus,
  Server,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { TestAiConnectionInput } from "@/features/ai/ai.schema";
import type { SystemConfig } from "@/features/config/config.schema";
import {
  AI_BLOG_SKILL_TYPES,
  AI_COMPAT_TYPES,
  type AiBlogSkillType,
  type AiCompatType,
  type AiProviderInstance,
} from "@/features/config/config.schema";
import type { Result } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

type ConnectionStatus = "IDLE" | "TESTING" | "SUCCESS" | "ERROR";

interface AiSettingsSectionProps {
  testAiConnection: (options: {
    data: TestAiConnectionInput;
  }) => Promise<
    Result<
      { success: boolean; echo: string },
      { reason: "AI_CONNECTION_FAILED"; message: string }
    >
  >;
}

const COMPAT_TYPE_LABELS: Record<AiCompatType, string> = {
  "openai-compatible": "OpenAI Compatible",
  "claude-compatible": "Claude Compatible",
  "gemini-compatible": "Gemini Compatible",
};



function skillLabel(name: AiBlogSkillType): string {
  if (name === "docs") return m.settings_ai_skill_docs();
  if (name === "newsletter") return m.settings_ai_skill_newsletter();
  return m.settings_ai_skill_blog();
}

function skillDescription(name: AiBlogSkillType): string {
  if (name === "docs") return m.settings_ai_skill_docs_desc();
  if (name === "newsletter") return m.settings_ai_skill_newsletter_desc();
  return m.settings_ai_skill_blog_desc();
}

function generateId(): string {
  try {
    return crypto.randomUUID().slice(0, 8);
  } catch {
    return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }
}

export function AiSettingsSection({
  testAiConnection,
}: AiSettingsSectionProps) {
  const [status, setStatus] = useState<ConnectionStatus>("IDLE");
  const [echo, setEcho] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const {
    register,
    setValue,
    watch,
  } = useFormContext<SystemConfig>();

  const aiConfig = watch("ai");
  const activeProviderId = aiConfig?.activeProviderId;
  const providers: AiProviderInstance[] = aiConfig?.providers ?? [];

  const activeProvider = providers.find((p) => p.id === activeProviderId);
  const isUsingThirdParty = !!activeProviderId && !!activeProvider;

  // ── 切换到 Cloudflare AI ──
  const handleSelectWorkersAi = () => {
    setValue("ai.workersAi", { enabled: true }, { shouldDirty: true });
    setValue("ai.activeProviderId", undefined, { shouldDirty: true });
    setStatus("IDLE");
  };

  // ── 切换到第三方供应商 ──
  const handleSelectProvider = (id: string) => {
    setValue("ai.workersAi", { enabled: false }, { shouldDirty: true });
    setValue("ai.activeProviderId", id, { shouldDirty: true });
    setStatus("IDLE");
  };

  // ── 新增第三方供应商 ──
  const handleAddProvider = (type: AiCompatType) => {
    const newProvider: AiProviderInstance = {
      id: generateId(),
      name: COMPAT_TYPE_LABELS[type],
      type,
      baseUrl: "",
      apiKey: "",
      model: "",
    };
    const updated = [...providers, newProvider];
    setValue("ai.providers", updated, { shouldDirty: true });
    setEditingId(newProvider.id);
  };

  // ── 删除第三方供应商 ──
  const handleDeleteProvider = (id: string) => {
    const updated = providers.filter((p) => p.id !== id);
    setValue("ai.providers", updated, { shouldDirty: true });
    if (activeProviderId === id) {
      handleSelectWorkersAi();
    }
    if (editingId === id) {
      setEditingId(null);
    }
  };

  // ── 更新供应商字段 ──
  const updateProvider = (
    id: string,
    field: keyof AiProviderInstance,
    value: string,
  ) => {
    const updated = providers.map((p) =>
      p.id === id ? { ...p, [field]: value } : p,
    );
    setValue("ai.providers", updated, { shouldDirty: true });
  };

  // ── 测试连接 ──
  const handleTest = async () => {
    setStatus("TESTING");
    setEcho("");

    try {
      let result;
      if (isUsingThirdParty && activeProvider) {
        result = await testAiConnection({
          data: {
            category: "third-party",
            compatType: activeProvider.type,
            baseUrl: activeProvider.baseUrl,
            apiKey: activeProvider.apiKey,
            model: activeProvider.model,
          },
        });
      } else {
        result = await testAiConnection({
          data: { category: "workers-ai" },
        });
      }

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

  const canTest = isUsingThirdParty
    ? !!activeProvider?.baseUrl?.trim() && !!activeProvider?.model?.trim()
    : true;

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-700">
      <div className="border border-border/30 bg-background/50 overflow-hidden divide-y divide-border/20">
        {/* ── 内置 Cloudflare AI ── */}
        <div className="space-y-6 p-4 md:p-8">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="rounded-sm bg-muted/40 p-2 shrink-0">
              <Cpu size={16} className="text-muted-foreground" />
            </div>
            <div className="space-y-1 min-w-0">
              <h5 className="text-sm font-medium text-foreground truncate">
                {m.settings_ai_builtin_title()}
              </h5>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {m.settings_ai_builtin_desc()}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSelectWorkersAi}
            className={cn(
              "w-full flex items-center justify-between border p-3 md:p-4 text-left transition-all",
              !isUsingThirdParty
                ? "border-foreground bg-muted/20"
                : "border-border/30 hover:border-border/60",
            )}
          >
            <div className="flex items-center gap-2 md:gap-3 min-w-0">
              <div
                className={cn(
                  "h-3 w-3 shrink-0 rounded-full border",
                  !isUsingThirdParty
                    ? "border-foreground bg-foreground"
                    : "border-border/60",
                )}
              />
              <div className="space-y-1 min-w-0">
                <p className="text-sm font-medium text-foreground">
                  Cloudflare Workers AI
                </p>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {m.settings_ai_builtin_desc_full()}
                </p>
              </div>
            </div>
          </button>
        </div>

        {/* ── 第三方 AI 供应商列表 ── */}
        <div className="space-y-6 p-4 md:p-8">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 md:gap-4 min-w-0">
              <div className="rounded-sm bg-muted/40 p-2 shrink-0">
                <Server size={16} className="text-muted-foreground" />
              </div>
              <div className="space-y-1 min-w-0">
                <h5 className="text-sm font-medium text-foreground truncate">
                  {m.settings_ai_third_party_title()}
                </h5>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {m.settings_ai_third_party_desc()}
                </p>
              </div>
            </div>
          </div>

          {/* 已添加的供应商列表 */}
          {providers.length > 0 && (
            <div className="space-y-3">
              {providers.map((p) => {
                const isActive = activeProviderId === p.id;
                const isExpanded = editingId === p.id;
                return (
                  <div key={p.id} className="border border-border/30">
                    {/* 供应商头部 */}
                    <div className="flex items-center gap-2 md:gap-3 p-3 md:p-4">
                      <button
                        type="button"
                        onClick={() =>
                          isActive
                            ? handleSelectWorkersAi()
                            : handleSelectProvider(p.id)
                        }
                        className="flex items-center gap-2 md:gap-3 flex-1 min-w-0 text-left"
                      >
                        <div
                          className={cn(
                            "h-3 w-3 shrink-0 rounded-full border",
                            isActive
                              ? "border-foreground bg-foreground"
                              : "border-border/60",
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">
                            {p.name || COMPAT_TYPE_LABELS[p.type]}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {p.model || m.settings_ai_provider_model_unconfigured()}
                          </p>
                        </div>
                      </button>
                      <span className="hidden sm:inline text-[10px] font-mono px-2 py-0.5 rounded bg-muted/50 text-muted-foreground shrink-0">
                        {COMPAT_TYPE_LABELS[p.type]}
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
                        onClick={() => handleDeleteProvider(p.id)}
                        className="shrink-0 p-1.5 text-muted-foreground hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {/* 展开的配置表单 */}
                    {isExpanded && (
                      <div className="border-t border-border/20 p-3 md:p-4 space-y-4 bg-muted/5">
                        <div className="space-y-4">
                          <label className="text-xs text-muted-foreground">
                            {m.settings_ai_provider_name_label()}
                          </label>
                          <Input
                            value={p.name}
                            onChange={(e) =>
                              updateProvider(p.id, "name", e.target.value)
                            }
                            className="w-full rounded-none border border-border/30 bg-muted/10 px-3 md:px-4 py-4 md:py-5 text-sm text-foreground"
                          />
                        </div>
                        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                          <div className="space-y-4">
                            <label className="text-xs text-muted-foreground">
                              Base URL
                            </label>
                            <Input
                              value={p.baseUrl ?? ""}
                              onChange={(e) =>
                                updateProvider(p.id, "baseUrl", e.target.value)
                              }
                              placeholder={`https://...`}
                              className="w-full rounded-none border border-border/30 bg-muted/10 px-3 md:px-4 py-4 md:py-5 text-sm text-foreground"
                            />
                          </div>
                          <div className="space-y-4">
                            <label className="text-xs text-muted-foreground">
                              Model
                            </label>
                            <Input
                              value={p.model ?? ""}
                              onChange={(e) =>
                                updateProvider(p.id, "model", e.target.value)
                              }
                              placeholder="gpt-4o-mini"
                              className="w-full rounded-none border border-border/30 bg-muted/10 px-3 md:px-4 py-4 md:py-5 text-sm text-foreground"
                            />
                          </div>
                        </div>
                        <div className="space-y-4">
                          <label className="text-xs text-muted-foreground">
                            API Key
                          </label>
                          <div className="relative">
                            <Input
                              type="password"
                              value={p.apiKey ?? ""}
                              onChange={(e) =>
                                updateProvider(p.id, "apiKey", e.target.value)
                              }
                              placeholder="sk-..."
                              className="w-full rounded-none border border-border/30 bg-muted/10 px-3 md:px-4 py-4 md:py-5 text-sm text-foreground pr-10"
                            />
                            <KeyRound
                              size={14}
                              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/30"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* 新增按钮 */}
          <div className="flex flex-wrap gap-2">
            {(AI_COMPAT_TYPES as readonly AiCompatType[]).map((type) => (
              <Button
                key={type}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleAddProvider(type)}
                className="rounded-none border-border/30 text-xs font-mono"
              >
                <Plus size={12} className="mr-2" />
                {COMPAT_TYPE_LABELS[type]}
              </Button>
            ))}
          </div>
        </div>

        {/* ── Blog Writing Skill ── */}
        <div className="space-y-6 p-4 md:p-8">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="rounded-sm bg-muted/40 p-2 shrink-0">
              <PenLine size={16} className="text-muted-foreground" />
            </div>
            <div className="space-y-1 min-w-0">
              <h5 className="text-sm font-medium text-foreground truncate">
                {m.settings_ai_skill_title()}
              </h5>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {m.settings_ai_skill_desc()}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {AI_BLOG_SKILL_TYPES.map((name) => {
              const isActive = aiConfig?.blogSkillType === name;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    setValue("ai.blogSkillType", name, {
                      shouldDirty: true,
                    });
                  }}
                  className={cn(
                    "flex items-start gap-2 md:gap-3 border p-3 md:p-4 text-left transition-all",
                    isActive
                      ? "border-foreground bg-muted/20"
                      : "border-border/30 hover:border-border/60",
                  )}
                >
                  <div
                    className={cn(
                      "mt-1 h-3 w-3 shrink-0 rounded-full border",
                      isActive
                        ? "border-foreground bg-foreground"
                        : "border-border/60",
                    )}
                  />
                  <div className="space-y-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {skillLabel(name)}
                    </p>
                    <p className="text-xs leading-relaxed text-muted-foreground line-clamp-3">
                      {skillDescription(name)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Writing Instructions ── */}
        <div className="space-y-6 p-4 md:p-8">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="rounded-sm bg-muted/40 p-2 shrink-0">
              <PenLine size={16} className="text-muted-foreground" />
            </div>
            <div className="space-y-1 min-w-0">
              <h5 className="text-sm font-medium text-foreground truncate">
                {m.settings_ai_writing_instructions_title()}
              </h5>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {m.settings_ai_writing_instructions_desc()}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <Textarea
              rows={7}
              placeholder={m.settings_ai_writing_instructions_ph()}
              {...register("ai.writingInstructions")}
              className="w-full rounded-none border border-border/30 bg-muted/10 px-4 py-3 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/40 focus-visible:border-border/60 focus-visible:ring-1 focus-visible:ring-foreground/10"
            />
          </div>
        </div>

        {/* ── Test Toolbar ── */}
        <div className="flex flex-col items-center justify-between gap-4 bg-muted/10 p-4 sm:p-6 sm:px-10 sm:flex-row">
          <div className="flex items-center gap-4 md:gap-6">
            <div className="flex items-center gap-2 md:gap-3">
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
              <span className="text-xs md:text-sm font-serif font-medium text-foreground">
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
              "h-9 md:h-10 rounded-none border-border/50 px-6 md:px-8 text-[10px] font-mono uppercase tracking-[0.2em] transition-all hover:bg-background",
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

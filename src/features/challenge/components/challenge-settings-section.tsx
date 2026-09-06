import {
  ExternalLink,
  Globe,
  KeyRound,
  ShieldCheck,
  Timer,
  UserRound,
} from "lucide-react";
import { useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import type { SystemConfig } from "@/features/config/config.schema";
import { isFuwari } from "@/lib/theme-mode";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

const PROVIDER_OPTIONS = [
  { value: "none", label: m.settings_challenge_provider_none() },
  { value: "altcha", label: m.settings_challenge_provider_altcha() },
  { value: "turnstile", label: m.settings_challenge_provider_turnstile() },
] as const;

const SCOPE_OPTIONS = [
  {
    value: "auth-only",
    label: m.settings_challenge_scope_auth_only(),
    desc: m.settings_challenge_scope_auth_only_desc(),
    icon: UserRound,
  },
  {
    value: "full-site",
    label: m.settings_challenge_scope_full_site(),
    desc: m.settings_challenge_scope_full_site_desc(),
    icon: Globe,
  },
] as const;

export function ChallengeSettingsSection() {
  const { register, setValue, watch } = useFormContext<SystemConfig>();

  const provider = watch("challenge.provider") ?? "none";
  const scope = watch("challenge.scope") ?? "auth-only";
  const altchaEnabled = provider === "altcha";
  const turnstileEnabled = provider === "turnstile";

  const inputClassName =
    "w-full rounded-none border border-border/30 bg-muted/10 px-4 py-6 text-sm text-foreground transition-all focus-visible:border-border/60 focus-visible:ring-1 focus-visible:ring-foreground/10";

  const setProvider = (value: (typeof PROVIDER_OPTIONS)[number]["value"]) => {
    setValue("challenge.provider", value, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    setValue("challenge.altcha.enabled", value === "altcha", {
      shouldDirty: true,
    });
    setValue("challenge.turnstile.enabled", value === "turnstile", {
      shouldDirty: true,
    });
  };

  const setScope = (value: (typeof SCOPE_OPTIONS)[number]["value"]) => {
    setValue("challenge.scope", value, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  };

  if (isFuwari) {
    return (
      <FuwariChallengeSettingsSection
        register={register}
        provider={provider}
        scope={scope}
        altchaEnabled={altchaEnabled}
        turnstileEnabled={turnstileEnabled}
        setProvider={setProvider}
        setScope={setScope}
      />
    );
  }

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-700">
      {/* Provider selection */}
      <div className="space-y-6 p-8">
        <div className="flex items-center gap-4">
          <div className="rounded-sm bg-muted/40 p-2">
            <ShieldCheck size={16} className="text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <h5 className="text-sm font-medium text-foreground">
              {m.settings_challenge_provider_title()}
            </h5>
            <p className="text-xs text-muted-foreground">
              {m.settings_challenge_provider_desc()}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {PROVIDER_OPTIONS.map(({ value, label }) => {
            const selected = provider === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setProvider(value)}
                className={`flex items-center justify-center gap-3 border px-4 py-5 text-left transition-all ${
                  selected
                    ? "border-foreground/60 bg-foreground/5"
                    : "border-border/20 bg-muted/10 hover:border-border/40"
                }`}
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                    selected ? "border-foreground" : "border-border/40"
                  }`}
                >
                  {selected && (
                    <span className="h-2 w-2 rounded-full bg-foreground" />
                  )}
                </span>
                <span className="text-sm font-medium text-foreground">
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Protection scope (仅当启用了任意验证方案时展示) */}
      {provider !== "none" && (
        <div className="space-y-6 p-8 border-t border-border/20">
          <div className="flex items-center gap-4">
            <div className="rounded-sm bg-muted/40 p-2">
              <ShieldCheck size={16} className="text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <h5 className="text-sm font-medium text-foreground">
                {m.settings_challenge_scope_title()}
              </h5>
              <p className="text-xs text-muted-foreground">
                {m.settings_challenge_scope_desc()}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {SCOPE_OPTIONS.map(({ value, label, desc, icon: Icon }) => {
              const selected = scope === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setScope(value)}
                  className={`flex flex-col gap-3 border px-5 py-5 text-left transition-all ${
                    selected
                      ? "border-foreground/60 bg-foreground/5"
                      : "border-border/20 bg-muted/10 hover:border-border/40"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                        selected ? "border-foreground" : "border-border/40"
                      }`}
                    >
                      {selected && (
                        <span className="h-2 w-2 rounded-full bg-foreground" />
                      )}
                    </span>
                    <Icon size={14} className="text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">
                      {label}
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground leading-relaxed">
                    {desc}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ALTCHA PoW settings */}
      {altchaEnabled && (
        <div className="space-y-8 p-8 border-t border-border/20">
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">
              {m.settings_challenge_altcha_title()}
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {m.settings_challenge_altcha_desc()}
            </p>
          </div>

          <div className="space-y-4">
            <label
              htmlFor="challenge-altcha-difficulty"
              className="text-sm text-muted-foreground"
            >
              {m.settings_challenge_altcha_difficulty_label()}
            </label>
            <Input
              id="challenge-altcha-difficulty"
              type="number"
              min={10000}
              max={1000000}
              {...register("challenge.altcha.difficulty", {
                valueAsNumber: true,
              })}
              className={inputClassName}
            />
            <p className="text-xs text-muted-foreground">
              {m.settings_challenge_altcha_difficulty_desc()}
            </p>
          </div>
        </div>
      )}

      {/* Turnstile settings */}
      {turnstileEnabled && (
        <div className="space-y-8 p-8 border-t border-border/20">
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">
              {m.settings_challenge_turnstile_title()}
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {m.settings_challenge_turnstile_desc()}
            </p>
          </div>

          <div className="space-y-4">
            <label
              htmlFor="challenge-turnstile-site-key"
              className="text-sm text-muted-foreground"
            >
              {m.settings_turnstile_field_site_key_label()}
            </label>
            <Input
              id="challenge-turnstile-site-key"
              placeholder={m.settings_turnstile_field_site_key_ph()}
              {...register("challenge.turnstile.siteKey")}
              className={inputClassName}
            />
          </div>

          <div className="space-y-4">
            <label
              htmlFor="challenge-turnstile-secret-key"
              className="text-sm text-muted-foreground"
            >
              {m.settings_turnstile_field_secret_key_label()}
            </label>
            <div className="relative group/input">
              <Input
                id="challenge-turnstile-secret-key"
                type="password"
                placeholder={m.settings_turnstile_field_secret_key_ph()}
                {...register("challenge.turnstile.secretKey")}
                className={inputClassName}
              />
              <KeyRound
                size={14}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/30"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="space-y-4">
              <label
                htmlFor="challenge-turnstile-fallback-max"
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <Timer size={14} />
                {m.settings_challenge_fallback_max_label()}
              </label>
              <Input
                id="challenge-turnstile-fallback-max"
                type="number"
                min={1}
                max={20}
                {...register("challenge.turnstile.fallback.maxFailures", {
                  valueAsNumber: true,
                })}
                className={inputClassName}
              />
            </div>
            <div className="space-y-4">
              <label
                htmlFor="challenge-turnstile-fallback-timeout"
                className="text-sm text-muted-foreground"
              >
                {m.settings_challenge_fallback_timeout_label()}
              </label>
              <Input
                id="challenge-turnstile-fallback-timeout"
                type="number"
                min={5000}
                max={120000}
                step={1000}
                {...register("challenge.turnstile.fallback.timeoutMs", {
                  valueAsNumber: true,
                })}
                className={inputClassName}
              />
            </div>
          </div>

          <div className="flex items-start gap-3 border border-border/20 bg-muted/10 p-4">
            <ShieldCheck
              size={14}
              className="mt-0.5 shrink-0 text-muted-foreground"
            />
            <p className="text-sm text-muted-foreground">
              {m.settings_challenge_fallback_desc()}
            </p>
          </div>
        </div>
      )}

      {/* Fallback note when turnstile enabled via provider */}
      {!turnstileEnabled && !altchaEnabled && (
        <div className="flex items-start gap-3 border border-border/20 bg-muted/10 p-4">
          <ShieldCheck
            size={14}
            className="mt-0.5 shrink-0 text-muted-foreground"
          />
          <p className="text-sm text-muted-foreground">
            {m.settings_challenge_disabled_note()}
          </p>
        </div>
      )}

      {/* Doc panel */}
      <div className="space-y-3 p-8">
        <div className="flex items-center gap-3">
          <h5 className="text-sm font-medium text-foreground">
            {m.settings_challenge_doc_title()}
          </h5>
          <ExternalLink size={12} className="text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {m.settings_challenge_doc_desc()}
        </p>
      </div>
    </div>
  );
}

function FuwariChallengeSettingsSection({
  register,
  provider,
  scope,
  altchaEnabled,
  turnstileEnabled,
  setProvider,
  setScope,
}: {
  register: ReturnType<typeof useFormContext<SystemConfig>>["register"];
  provider: string;
  scope: string;
  altchaEnabled: boolean;
  turnstileEnabled: boolean;
  setProvider: (value: (typeof PROVIDER_OPTIONS)[number]["value"]) => void;
  setScope: (value: (typeof SCOPE_OPTIONS)[number]["value"]) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      {/* Provider selection */}
      <div className="fuwari-card-base p-4 sm:p-5 md:p-6 fuwari-onload-animation">
        <div className="flex items-center gap-4 mb-5">
          <div className="h-10 w-10 rounded-xl bg-(--fuwari-btn-regular-bg) flex items-center justify-center shrink-0">
            <ShieldCheck size={18} className="fuwari-text-50" />
          </div>
          <div className="space-y-0.5">
            <h5 className="text-base font-bold fuwari-text-90">
              {m.settings_challenge_provider_title()}
            </h5>
            <p className="text-xs sm:text-sm fuwari-text-50">
              {m.settings_challenge_provider_desc()}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {PROVIDER_OPTIONS.map(({ value, label }) => {
            const selected = provider === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setProvider(value)}
                className={cn(
                  "flex items-center justify-center gap-3 rounded-xl border px-4 py-4 text-left transition-all",
                  selected
                    ? "border-(--fuwari-primary)/60 bg-(--fuwari-primary)/10"
                    : "border-(--fuwari-input-border) hover:border-(--fuwari-primary)/40",
                )}
              >
                <span
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                    selected
                      ? "border-(--fuwari-primary)"
                      : "border-(--fuwari-input-border)",
                  )}
                >
                  {selected && (
                    <span className="h-2 w-2 rounded-full bg-(--fuwari-primary)" />
                  )}
                </span>
                <span className="text-sm font-bold fuwari-text-90">
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Protection scope */}
      {provider !== "none" && (
        <div className="fuwari-card-base p-4 sm:p-5 md:p-6 fuwari-onload-animation">
          <div className="flex items-center gap-4 mb-5">
            <div className="h-10 w-10 rounded-xl bg-(--fuwari-btn-regular-bg) flex items-center justify-center shrink-0">
              <ShieldCheck size={18} className="fuwari-text-50" />
            </div>
            <div className="space-y-0.5">
              <h5 className="text-base font-bold fuwari-text-90">
                {m.settings_challenge_scope_title()}
              </h5>
              <p className="text-xs sm:text-sm fuwari-text-50">
                {m.settings_challenge_scope_desc()}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {SCOPE_OPTIONS.map(({ value, label, desc, icon: Icon }) => {
              const selected = scope === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setScope(value)}
                  className={cn(
                    "flex flex-col gap-3 rounded-xl border px-5 py-4 text-left transition-all",
                    selected
                      ? "border-(--fuwari-primary)/60 bg-(--fuwari-primary)/10"
                      : "border-(--fuwari-input-border) hover:border-(--fuwari-primary)/40",
                  )}
                >
                  <span className="flex items-center gap-3">
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                        selected
                          ? "border-(--fuwari-primary)"
                          : "border-(--fuwari-input-border)",
                      )}
                    >
                      {selected && (
                        <span className="h-2 w-2 rounded-full bg-(--fuwari-primary)" />
                      )}
                    </span>
                    <Icon size={14} className="fuwari-text-50" />
                    <span className="text-sm font-bold fuwari-text-90">
                      {label}
                    </span>
                  </span>
                  <span className="text-xs sm:text-sm fuwari-text-50 leading-relaxed">
                    {desc}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ALTCHA settings */}
      {altchaEnabled && (
        <div className="fuwari-card-base p-4 sm:p-5 md:p-6 fuwari-onload-animation">
          <div className="space-y-1.5 mb-5">
            <h5 className="text-base font-bold fuwari-text-90">
              {m.settings_challenge_altcha_title()}
            </h5>
            <p className="text-xs sm:text-sm fuwari-text-50 leading-relaxed">
              {m.settings_challenge_altcha_desc()}
            </p>
          </div>

          <label className="block space-y-2">
            <span className="block text-sm font-bold fuwari-text-75">
              {m.settings_challenge_altcha_difficulty_label()}
            </span>
            <Input
              id="challenge-altcha-difficulty"
              type="number"
              min={10000}
              max={1000000}
              {...register("challenge.altcha.difficulty", {
                valueAsNumber: true,
              })}
            />
            <span className="block text-xs sm:text-sm fuwari-text-50">
              {m.settings_challenge_altcha_difficulty_desc()}
            </span>
          </label>
        </div>
      )}

      {/* Turnstile settings */}
      {turnstileEnabled && (
        <div className="fuwari-card-base p-4 sm:p-5 md:p-6 fuwari-onload-animation">
          <div className="space-y-1.5 mb-5">
            <h5 className="text-base font-bold fuwari-text-90">
              {m.settings_challenge_turnstile_title()}
            </h5>
            <p className="text-xs sm:text-sm fuwari-text-50 leading-relaxed">
              {m.settings_challenge_turnstile_desc()}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="block space-y-2">
              <span className="block text-sm font-bold fuwari-text-75">
                {m.settings_turnstile_field_site_key_label()}
              </span>
              <Input
                id="challenge-turnstile-site-key"
                placeholder={m.settings_turnstile_field_site_key_ph()}
                {...register("challenge.turnstile.siteKey")}
              />
            </label>

            <label className="block space-y-2">
              <span className="block text-sm font-bold fuwari-text-75">
                {m.settings_turnstile_field_secret_key_label()}
              </span>
              <div className="relative">
                <Input
                  id="challenge-turnstile-secret-key"
                  type="password"
                  placeholder={m.settings_turnstile_field_secret_key_ph()}
                  {...register("challenge.turnstile.secretKey")}
                  className="pr-10"
                />
                <KeyRound
                  size={14}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/30"
                />
              </div>
            </label>

            <label className="block space-y-2">
              <span className="flex items-center gap-2 text-sm font-bold fuwari-text-75">
                <Timer size={14} />
                {m.settings_challenge_fallback_max_label()}
              </span>
              <Input
                id="challenge-turnstile-fallback-max"
                type="number"
                min={1}
                max={20}
                {...register("challenge.turnstile.fallback.maxFailures", {
                  valueAsNumber: true,
                })}
              />
            </label>

            <label className="block space-y-2">
              <span className="block text-sm font-bold fuwari-text-75">
                {m.settings_challenge_fallback_timeout_label()}
              </span>
              <Input
                id="challenge-turnstile-fallback-timeout"
                type="number"
                min={5000}
                max={120000}
                step={1000}
                {...register("challenge.turnstile.fallback.timeoutMs", {
                  valueAsNumber: true,
                })}
              />
            </label>
          </div>

          <div className="mt-4 flex items-start gap-3 rounded-xl bg-(--fuwari-btn-regular-bg) p-4">
            <ShieldCheck size={14} className="mt-0.5 shrink-0 fuwari-text-50" />
            <p className="text-xs sm:text-sm fuwari-text-50">
              {m.settings_challenge_fallback_desc()}
            </p>
          </div>
        </div>
      )}

      {/* Enabled note */}
      {!turnstileEnabled && !altchaEnabled && (
        <div className="fuwari-card-base p-4 sm:p-5 md:p-6 fuwari-onload-animation flex items-start gap-3">
          <ShieldCheck size={16} className="mt-0.5 shrink-0 fuwari-text-50" />
          <p className="text-xs sm:text-sm fuwari-text-50">
            {m.settings_challenge_disabled_note()}
          </p>
        </div>
      )}

      {/* Doc panel */}
      <div className="fuwari-card-base p-4 sm:p-5 md:p-6 fuwari-onload-animation">
        <div className="flex items-center gap-3">
          <h5 className="text-sm font-bold fuwari-text-75">
            {m.settings_challenge_doc_title()}
          </h5>
          <ExternalLink size={12} className="fuwari-text-30" />
        </div>
        <p className="mt-2 text-xs sm:text-sm fuwari-text-50 leading-relaxed">
          {m.settings_challenge_doc_desc()}
        </p>
      </div>
    </div>
  );
}

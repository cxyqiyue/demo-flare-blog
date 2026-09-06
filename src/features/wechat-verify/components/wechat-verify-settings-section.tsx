import { BadgeCheck, FileCheck, ShieldCheck } from "lucide-react";
import { useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import type { SystemConfig } from "@/features/config/config.schema";
import { isFuwari } from "@/lib/theme-mode";
import { m } from "@/paraglide/messages";

const inputClassName =
  "w-full rounded-none border border-border/30 bg-muted/10 px-4 py-6 text-sm text-foreground transition-all focus-visible:border-border/60 focus-visible:ring-1 focus-visible:ring-foreground/10";

export function WechatVerifySettingsSection() {
  const { register, watch } = useFormContext<SystemConfig>();

  const fileName = watch("wechatVerify.fileName") ?? "";
  const fileContent = watch("wechatVerify.fileContent") ?? "";
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const previewUrl = fileName
    ? `${origin}/${fileName.startsWith("/") ? fileName.slice(1) : fileName}`
    : "";

  if (isFuwari) {
    return (
      <div className="flex flex-col gap-4">
        {/* 说明 */}
        <div className="fuwari-card-base flex flex-col gap-4 p-4 sm:p-5 md:p-6 fuwari-onload-animation">
          <div className="flex items-start gap-3 rounded-xl bg-(--fuwari-btn-regular-bg) p-4">
            <ShieldCheck size={16} className="mt-0.5 shrink-0 fuwari-text-50" />
            <p className="text-xs leading-relaxed sm:text-sm fuwari-text-50">
              {m.settings_wechat_verify_intro()}
            </p>
          </div>

          <ol className="flex list-decimal flex-col gap-2 pl-5 text-xs sm:text-sm fuwari-text-50">
            <li>{m.settings_wechat_verify_step1()}</li>
            <li>{m.settings_wechat_verify_step2()}</li>
          </ol>

          <div className="flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/5 p-4">
            <ShieldCheck
              size={16}
              className="mt-0.5 shrink-0 text-amber-500/70"
            />
            <p className="text-xs leading-relaxed sm:text-sm fuwari-text-50">
              {m.settings_wechat_verify_warning()}
            </p>
          </div>
        </div>

        {/* 字段 */}
        <div className="fuwari-card-base flex flex-col gap-5 p-4 sm:p-5 md:p-6 fuwari-onload-animation">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-(--fuwari-btn-regular-bg)">
              <FileCheck size={18} className="fuwari-text-50" />
            </div>
            <div className="space-y-0.5">
              <h5 className="text-base font-bold fuwari-text-90">
                {m.settings_wechat_verify_config_title()}
              </h5>
              <p className="text-xs sm:text-sm fuwari-text-50">
                {m.settings_wechat_verify_config_desc()}
              </p>
            </div>
          </div>

          <label htmlFor="wechat-verify-file-name" className="block space-y-2">
            <span className="block text-sm font-bold fuwari-text-75">
              {m.settings_wechat_verify_file_name_label()}
            </span>
            <Input
              id="wechat-verify-file-name"
              placeholder={m.settings_wechat_verify_file_name_ph()}
              {...register("wechatVerify.fileName")}
            />
            <span className="block text-xs sm:text-sm fuwari-text-50">
              {m.settings_wechat_verify_file_name_desc()}
            </span>
          </label>

          <label
            htmlFor="wechat-verify-file-content"
            className="block space-y-2"
          >
            <span className="block text-sm font-bold fuwari-text-75">
              {m.settings_wechat_verify_file_content_label()}
            </span>
            <Input
              id="wechat-verify-file-content"
              placeholder={m.settings_wechat_verify_file_content_ph()}
              {...register("wechatVerify.fileContent")}
            />
            <span className="block text-xs sm:text-sm fuwari-text-50">
              {m.settings_wechat_verify_file_content_desc()}
            </span>
          </label>
        </div>

        {/* 预览 */}
        {previewUrl && (
          <div className="fuwari-card-base p-4 sm:p-5 md:p-6 fuwari-onload-animation">
            <p className="text-xs font-bold text-emerald-500">
              {m.settings_wechat_verify_preview()}
            </p>
            <p className="mt-2 break-all text-sm font-bold fuwari-text-90">
              {previewUrl}
            </p>
            {fileContent && (
              <p className="mt-3 break-all text-xs fuwari-text-50">
                {fileContent}
              </p>
            )}
          </div>
        )}

        {/* 说明：不提交到仓库 */}
        <div className="fuwari-card-base flex items-start gap-3 p-4 sm:p-5 md:p-6 fuwari-onload-animation">
          <BadgeCheck size={16} className="mt-0.5 shrink-0 fuwari-text-50" />
          <p className="text-xs leading-relaxed sm:text-sm fuwari-text-50">
            {m.settings_wechat_verify_storage_note()}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-700">
      {/* 说明 */}
      <div className="space-y-4 p-8">
        <div className="flex items-start gap-3 border border-border/20 bg-muted/10 p-4">
          <ShieldCheck
            size={14}
            className="mt-0.5 shrink-0 text-muted-foreground"
          />
          <p className="text-sm text-muted-foreground leading-relaxed">
            {m.settings_wechat_verify_intro()}
          </p>
        </div>

        <ol className="space-y-3 pl-6 text-sm text-muted-foreground list-decimal">
          <li>{m.settings_wechat_verify_step1()}</li>
          <li>{m.settings_wechat_verify_step2()}</li>
        </ol>

        <div className="flex items-start gap-3 border border-amber-500/20 bg-amber-500/5 p-4">
          <ShieldCheck
            size={14}
            className="mt-0.5 shrink-0 text-amber-500/70"
          />
          <p className="text-sm text-muted-foreground leading-relaxed">
            {m.settings_wechat_verify_warning()}
          </p>
        </div>
      </div>

      {/* 字段 */}
      <div className="space-y-8 p-8 border-t border-border/20">
        <div className="flex items-center gap-4">
          <div className="rounded-sm bg-muted/40 p-2">
            <FileCheck size={16} className="text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <h5 className="text-sm font-medium text-foreground">
              {m.settings_wechat_verify_config_title()}
            </h5>
            <p className="text-xs text-muted-foreground">
              {m.settings_wechat_verify_config_desc()}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <label
            htmlFor="wechat-verify-file-name"
            className="text-sm text-muted-foreground"
          >
            {m.settings_wechat_verify_file_name_label()}
          </label>
          <Input
            id="wechat-verify-file-name"
            placeholder={m.settings_wechat_verify_file_name_ph()}
            {...register("wechatVerify.fileName")}
            className={inputClassName}
          />
          <p className="text-xs text-muted-foreground">
            {m.settings_wechat_verify_file_name_desc()}
          </p>
        </div>

        <div className="space-y-4">
          <label
            htmlFor="wechat-verify-file-content"
            className="text-sm text-muted-foreground"
          >
            {m.settings_wechat_verify_file_content_label()}
          </label>
          <Input
            id="wechat-verify-file-content"
            placeholder={m.settings_wechat_verify_file_content_ph()}
            {...register("wechatVerify.fileContent")}
            className={inputClassName}
          />
          <p className="text-xs text-muted-foreground">
            {m.settings_wechat_verify_file_content_desc()}
          </p>
        </div>
      </div>

      {/* 预览 */}
      {previewUrl && (
        <div className="border border-emerald-500/20 bg-emerald-500/5 p-6">
          <p className="text-xs font-mono uppercase tracking-widest text-emerald-600">
            {m.settings_wechat_verify_preview()}
          </p>
          <p className="mt-2 break-all font-serif text-sm text-foreground/80">
            {previewUrl}
          </p>
          {fileContent && (
            <p className="mt-3 break-all font-mono text-xs text-muted-foreground">
              {fileContent}
            </p>
          )}
        </div>
      )}

      {/* 说明：不提交到仓库 */}
      <div className="flex items-start gap-3 border border-border/20 bg-muted/10 p-4">
        <BadgeCheck
          size={14}
          className="mt-0.5 shrink-0 text-muted-foreground"
        />
        <p className="text-sm text-muted-foreground">
          {m.settings_wechat_verify_storage_note()}
        </p>
      </div>
    </div>
  );
}

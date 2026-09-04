import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSystemSetting } from "@/features/config/hooks/use-system-setting";
import type {
  FriendLinksConfig,
  UpdateSystemConfigSectionInput,
} from "@/features/config/config.schema";
import { FRIEND_LINK_APPLY_RULES_MAX } from "@/features/config/config.schema";
import { FRIEND_LINKS_KEYS } from "../../queries";

const EMPTY_SITE_INFO = {
  name: "",
  url: "",
  description: "",
  avatar: "",
  email: "",
};

function newRuleId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function FriendLinksConfigEditor() {
  const queryClient = useQueryClient();
  const { settings, isLoading, saveSettingsSection } = useSystemSetting();

  const [siteInfo, setSiteInfo] = useState({ ...EMPTY_SITE_INFO });
  const [applyRules, setApplyRules] = useState<Array<{ id: string; content: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const config: FriendLinksConfig | undefined = settings?.friendLinks;

  const applyRulesRemaining =
    FRIEND_LINK_APPLY_RULES_MAX - applyRules.length;

  // Hydrate the local form once from the fetched config.
  useEffect(() => {
    if (isLoading || isLoaded || !config) return;
    setSiteInfo({ ...EMPTY_SITE_INFO, ...config.siteInfo });
    setApplyRules(
      (config.applyRules ?? []).map((rule) => ({ id: rule.id, content: rule.content ?? "" })),
    );
    setIsLoaded(true);
  }, [isLoading, isLoaded, config]);

  const handleSiteInfoChange = (field: keyof typeof EMPTY_SITE_INFO, value: string) => {
    setSiteInfo((prev) => ({ ...prev, [field]: value }));
  };

  const handleRuleChange = (id: string, content: string) => {
    setApplyRules((prev) => prev.map((rule) => (rule.id === id ? { ...rule, content } : rule)));
  };

  const addRule = () => {
    setApplyRules((prev) => [...prev, { id: newRuleId(), content: "" }]);
  };

  const removeRule = (id: string) => {
    setApplyRules((prev) => prev.filter((rule) => rule.id !== id));
  };

  const handleSave = async () => {
    if (isLoading || saving) return;
    setSaving(true);
    const toastId = toast.loading("Saving friend link info...");
    try {
      await saveSettingsSection({
        data: {
          section: "friendLinks",
          data: {
            siteInfo: {
              name: siteInfo.name.trim() || undefined,
              url: siteInfo.url.trim() || undefined,
              description: siteInfo.description.trim() || undefined,
              avatar: siteInfo.avatar.trim() || undefined,
              email: siteInfo.email.trim() || undefined,
            },
            applyRules: applyRules
              .filter((rule) => rule.content.trim() !== "")
              .map((rule) => ({ id: rule.id, content: rule.content.trim() })),
          },
        } as UpdateSystemConfigSectionInput,
      });
      toast.success("Saved", { id: toastId });
      void queryClient.invalidateQueries({ queryKey: FRIEND_LINKS_KEYS.config });
    } catch {
      toast.error("Save failed", { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-24 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      {/* 本站信息 */}
      <section className="space-y-6 border border-border/30 p-6">
        <div>
          <h2 className="font-serif text-lg font-medium tracking-tight">[ 本站信息 ]</h2>
          <p className="mt-1 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Your blog's meta info shown to applicants.
          </p>
        </div>

        <div className="space-y-4">
          <SiteInfoField
            label="名称 / Name"
            value={siteInfo.name}
            onChange={(v) => handleSiteInfoChange("name", v)}
            placeholder="站点或博主名称"
          />
          <SiteInfoField
            label="地址 / URL"
            value={siteInfo.url}
            onChange={(v) => handleSiteInfoChange("url", v)}
            placeholder="https://example.com"
          />
          <SiteInfoField
            label="描述 / Description"
            value={siteInfo.description}
            onChange={(v) => handleSiteInfoChange("description", v)}
            placeholder="一句话介绍你的站点"
          />
          <SiteInfoField
            label="头像 / Avatar"
            value={siteInfo.avatar}
            onChange={(v) => handleSiteInfoChange("avatar", v)}
            placeholder="头像图片链接"
          />
          <SiteInfoField
            label="邮箱 / Email"
            value={siteInfo.email}
            onChange={(v) => handleSiteInfoChange("email", v)}
            placeholder="联系邮箱"
          />
        </div>
      </section>

      {/* 申请须知 */}
      <section className="space-y-6 border border-border/30 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-serif text-lg font-medium tracking-tight">[ 申请须知 ]</h2>
            <p className="mt-1 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Markdown supported. Up to {FRIEND_LINK_APPLY_RULES_MAX} rows.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addRule}
            disabled={applyRulesRemaining <= 0}
            className="rounded-none font-mono text-[10px] uppercase tracking-widest gap-2"
          >
            <Plus size={12} />
            <span>Add Row ({applyRulesRemaining} left)</span>
          </Button>
        </div>

        <div className="space-y-3">
          {applyRules.length === 0 ? (
            <p className="text-xs text-muted-foreground/60 font-serif italic">
              No rules yet. Add up to {FRIEND_LINK_APPLY_RULES_MAX} rows.
            </p>
          ) : (
            applyRules.map((rule, index) => (
              <div key={rule.id} className="group flex items-start gap-2">
                <span className="mt-2 w-6 shrink-0 text-right font-mono text-xs text-muted-foreground">
                  {index + 1}.
                </span>
                <textarea
                  value={rule.content}
                  onChange={(e) => handleRuleChange(rule.id, e.target.value)}
                  rows={2}
                  maxLength={1000}
                  placeholder="Markdown 内容，如：需先添加本站链接后再申请"
                  className="flex-1 resize-none bg-transparent border border-border/50 px-3 py-2 text-sm font-sans focus:border-foreground focus:outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => removeRule(rule.id)}
                  className="mt-2 p-1 text-muted-foreground/50 hover:text-red-500 transition-colors"
                  aria-label="Remove rule"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Save */}
      <div className="lg:col-span-2 flex justify-end pt-4 border-t border-border/30">
        <Button
          onClick={handleSave}
          disabled={isLoading || saving}
          className="rounded-none bg-foreground text-background hover:bg-foreground/90 font-mono text-[10px] uppercase tracking-widest gap-2 h-9 px-6"
        >
          {saving ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Save size={12} />
          )}
          <span>Save</span>
        </Button>
      </div>
    </div>
  );
}

function SiteInfoField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
        {label}
      </label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-transparent border-0 border-b border-border/50 text-sm px-0 rounded-none focus-visible:ring-0 focus-visible:border-foreground transition-all shadow-none h-auto py-1.5"
      />
    </div>
  );
}

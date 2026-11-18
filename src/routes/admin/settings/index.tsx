import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, useBlocker } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import {
  BellRing,
  Check,
  Cloud,
  Cpu,
  Database,
  Hammer,
  Image as ImageIcon,
  KeyRound,
  LayoutTemplate,
  Loader2,
  Mail,
  MessageCircle,
  ShieldCheck,
  Webhook,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import ConfirmationModal from "@/components/ui/confirmation-modal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AiSettingsSection } from "@/features/ai/components/ai-settings-section";
import { useAiConnection } from "@/features/ai/hooks/use-ai-connection";
import { ChallengeSettingsSection } from "@/features/challenge/components/challenge-settings-section";
import { CloudflareAnalyticsSettingsSection } from "@/features/cloudflare-usage/components/cloudflare-usage-settings-section";
import { MaintenanceSection } from "@/features/config/components/maintenance-section";
import {
  FuwariSectionSkeleton,
  SectionSkeleton,
} from "@/features/config/components/settings-skeleton";
import { SiteSettingsSection } from "@/features/config/components/site-settings-section";
import { StorageSettingsSection } from "@/features/config/components/storage-settings-section";
import type {
  ConfigSection,
  SystemConfig,
  UpdateSystemConfigSectionInput,
} from "@/features/config/config.schema";
import {
  createSystemConfigFormSchema,
  DEFAULT_CONFIG,
} from "@/features/config/config.schema";
import { useSystemSetting } from "@/features/config/hooks/use-system-setting";
import { sectionSaveState } from "@/features/config/utils/section-save-state";
import { EmailServiceSection } from "@/features/email/components/email-service-section";
import { useEmailConnection } from "@/features/email/hooks/use-email-connection";
import { ImageHostingSettingsSection } from "@/features/image-hosting/components/image-hosting-settings-section";
import { useImageHostingConnection } from "@/features/image-hosting/hooks/use-image-hosting-connection";
import { OAuthClientsSection } from "@/features/oauth-clients/components/oauth-clients-section";
import { SubscriptionSettingsSection } from "@/features/subscription/components/subscription-settings-section";
import {
  FlareAdminHeader,
  FlareAdminPanel,
} from "@/features/theme/themes/flare/components/admin/page";
import { WebhookSettingsSection } from "@/features/webhook/components/webhook-settings-section";
import { WechatVerifySettingsSection } from "@/features/wechat-verify/components/wechat-verify-settings-section";
import { requireSuperAdminRoute } from "@/lib/auth/route-guards";
import { isFlare, isFuwari } from "@/lib/theme-mode";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/admin/settings/")({
  ssr: false,
  beforeLoad: requireSuperAdminRoute,
  component: RouteComponent,
  loader: () => ({
    title: m.settings_admin_title(),
  }),
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData?.title,
      },
    ],
  }),
});

function RouteComponent() {
  const { settings, saveSettingsSection, isLoading } = useSystemSetting();
  const { testEmailConnection } = useEmailConnection();
  const { testAiConnection } = useAiConnection();
  const { testImageHostingConnection } = useImageHostingConnection();
  const tabItems = [
    {
      value: "site",
      icon: LayoutTemplate,
      label: m.settings_tab_site(),
    },
    {
      value: "email",
      icon: Mail,
      label: m.settings_tab_email(),
    },
    {
      value: "ai",
      icon: Cpu,
      label: m.settings_tab_ai(),
    },
    {
      value: "image-hosting",
      icon: ImageIcon,
      label: m.settings_tab_image_hosting(),
    },
    {
      value: "challenge",
      icon: ShieldCheck,
      label: m.settings_tab_challenge(),
    },
    {
      value: "wechat-verify",
      icon: MessageCircle,
      label: m.settings_tab_wechat_verify(),
    },
    {
      value: "webhook",
      icon: Webhook,
      label: m.settings_tab_webhook(),
    },
    {
      value: "subscription",
      icon: BellRing,
      label: m.settings_tab_subscription(),
    },
    {
      value: "cloudflare",
      icon: Cloud,
      label: "Cloudflare",
    },
    {
      value: "storage",
      icon: Database,
      label: "存储",
    },
    {
      value: "maintenance",
      icon: Hammer,
      label: m.settings_tab_maintenance(),
    },
    {
      value: "integrations",
      icon: KeyRound,
      label: m.settings_tab_mcp(),
    },
  ] as const;
  const [activeTab, setActiveTab] =
    useState<(typeof tabItems)[number]["value"]>("site");
  const formRef = useRef<HTMLFormElement>(null);
  const tabsScrollRef = useRef<HTMLDivElement>(null);
  const hasMountedRef = useRef(false);

  // Tabs that edit a config section are saved per-section. Tabs without a
  // mapped section (maintenance, integrations) have no form to submit.
  const TAB_SECTION: Partial<
    Record<(typeof tabItems)[number]["value"], ConfigSection>
  > = {
    site: "site",
    email: "email",
    ai: "ai",
    "image-hosting": "imageHosting",
    challenge: "challenge",
    "wechat-verify": "wechatVerify",
    webhook: "notification",
    subscription: "subscription",
    cloudflare: "cloudflareAnalytics",
    storage: "storage",
  };

  const methods = useForm<SystemConfig>({
    resolver: zodResolver(createSystemConfigFormSchema(m)),
    defaultValues: DEFAULT_CONFIG,
  });

  const {
    reset,
    handleSubmit,
    formState: { isSubmitting, isDirty, dirtyFields },
    getValues,
  } = methods;

  // Block navigation when there are unsaved changes
  const {
    proceed,
    reset: resetBlocker,
    status: blockerStatus,
  } = useBlocker({
    shouldBlockFn: () => isDirty,
    withResolver: true,
  });

  // 同步 settings 到 form
  useEffect(() => {
    if (settings) {
      reset(settings, isFlare ? { keepDirtyValues: true } : undefined);
    }
  }, [settings, reset]);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }

    const frame = requestAnimationFrame(() => {
      const scrollContainer = formRef.current?.closest(".custom-scrollbar");
      if (!(scrollContainer instanceof HTMLElement)) return;

      scrollContainer.scrollTo({
        top: 0,
        left: 0,
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [activeTab]);

  // 移动端 tab 栏横向滚动：切换 tab 时把选中的按钮滚动到可视区域内
  useEffect(() => {
    const listEl = tabsScrollRef.current;
    if (!listEl) return;
    if (window.matchMedia("(min-width: 1024px)").matches) return;

    const frame = requestAnimationFrame(() => {
      const activeEl = listEl.querySelector<HTMLElement>(
        '[data-state="active"]',
      );
      activeEl?.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [activeTab]);

  const saveSucceededRef = useRef(false);

  const onSubmit = async (data: SystemConfig) => {
    const section = TAB_SECTION[activeTab];
    if (!section) {
      reset(data);
      saveSucceededRef.current = true;
      return;
    }

    try {
      await saveSettingsSection({
        data: {
          section,
          data: data[section],
        } as UpdateSystemConfigSectionInput,
      });
      toast.success(m.settings_toast_save_success());
      if (isFlare) {
        // Advance only the saved section's baseline; other sections stay dirty.
        const baseline = methods.formState.defaultValues ?? DEFAULT_CONFIG;
        const state = sectionSaveState(
          baseline as SystemConfig,
          data,
          getValues(),
          section,
        );
        reset(state.defaults);
        for (const [key, value] of state.edits) {
          methods.setValue(key, value, { shouldDirty: true });
        }
      } else {
        reset(data);
      }
      saveSucceededRef.current = true;
    } catch {
      toast.error(m.settings_toast_save_error());
    }
  };

  const handleSaveAndLeave = async () => {
    saveSucceededRef.current = false;
    if (isFlare) {
      await handleSubmit(async (data) => {
        try {
          for (const section of new Set(Object.values(TAB_SECTION))) {
            if (!section || !dirtyFields[section]) continue;
            await saveSettingsSection({
              data: {
                section,
                data: data[section],
              } as UpdateSystemConfigSectionInput,
            });
          }
          const current = getValues();
          reset(data);
          let hasNewEdits = false;
          for (const key of Object.keys(current) as Array<keyof SystemConfig>) {
            if (JSON.stringify(current[key]) !== JSON.stringify(data[key])) {
              methods.setValue(key, current[key], { shouldDirty: true });
              hasNewEdits = true;
            }
          }
          saveSucceededRef.current = !hasNewEdits;
        } catch {
          toast.error(m.settings_toast_save_error());
        }
      })();
    } else {
      await handleSubmit(onSubmit)();
    }
    if (saveSucceededRef.current) proceed?.();
  };

  if (isFuwari || isFlare) {
    if (isLoading) {
      return (
        <div className="flex flex-col gap-4 pb-28">
          {isFlare ? <SectionSkeleton /> : <FuwariSectionSkeleton />}
        </div>
      );
    }

    const tabPanes: Array<{
      value: (typeof tabItems)[number]["value"];
      icon: LucideIcon;
      title: string;
      desc: string;
      children: ReactNode;
    }> = [
      {
        value: "site",
        icon: LayoutTemplate,
        title: m.settings_site_title(),
        desc: m.settings_site_desc(),
        children: <SiteSettingsSection />,
      },
      {
        value: "email",
        icon: Mail,
        title: m.settings_email_title(),
        desc: m.settings_email_desc(),
        children: (
          <EmailServiceSection testEmailConnection={testEmailConnection} />
        ),
      },
      {
        value: "ai",
        icon: Cpu,
        title: m.settings_ai_title(),
        desc: m.settings_ai_desc(),
        children: <AiSettingsSection testAiConnection={testAiConnection} />,
      },
      {
        value: "image-hosting",
        icon: ImageIcon,
        title: m.settings_image_hosting_title(),
        desc: m.settings_image_hosting_desc(),
        children: (
          <ImageHostingSettingsSection
            testImageHostingConnection={testImageHostingConnection}
          />
        ),
      },
      {
        value: "challenge",
        icon: ShieldCheck,
        title: m.settings_challenge_title(),
        desc: m.settings_challenge_desc(),
        children: <ChallengeSettingsSection />,
      },
      {
        value: "wechat-verify",
        icon: MessageCircle,
        title: m.settings_wechat_verify_title(),
        desc: m.settings_wechat_verify_desc(),
        children: <WechatVerifySettingsSection />,
      },
      {
        value: "webhook",
        icon: Webhook,
        title: m.settings_webhook_title(),
        desc: m.settings_webhook_desc(),
        children: <WebhookSettingsSection />,
      },
      {
        value: "subscription",
        icon: BellRing,
        title: m.settings_subscription_title(),
        desc: m.settings_subscription_desc(),
        children: <SubscriptionSettingsSection />,
      },
      {
        value: "cloudflare",
        icon: Cloud,
        title: "Cloudflare 用量监控",
        desc: "监控 Cloudflare 免费额度使用情况，支持告警通知",
        children: <CloudflareAnalyticsSettingsSection />,
      },
      {
        value: "storage",
        icon: Database,
        title: "存储管理",
        desc: "管理 KV 与 D1 存储后端，KV 达到限额时自动降级到 D1",
        children: <StorageSettingsSection />,
      },
      {
        value: "maintenance",
        icon: Hammer,
        title: m.settings_maintenance_title(),
        desc: m.settings_maintenance_desc(),
        children: <MaintenanceSection />,
      },
      {
        value: "integrations",
        icon: KeyRound,
        title: m.settings_mcp_title(),
        desc: m.settings_mcp_desc(),
        children: <OAuthClientsSection />,
      },
    ];

    if (isFlare) {
      return (
        <FormProvider {...methods}>
          <form
            ref={formRef}
            onSubmit={handleSubmit(onSubmit)}
            className="flare-settings space-y-5 pb-24"
          >
            <ConfirmationModal
              isOpen={blockerStatus === "blocked"}
              onClose={() => resetBlocker?.()}
              onConfirm={handleSaveAndLeave}
              onSecondaryConfirm={() => proceed?.()}
              title={m.settings_unsaved_title()}
              message={m.settings_unsaved_message()}
              confirmLabel={m.settings_unsaved_save_and_leave()}
              secondaryConfirmLabel={m.settings_unsaved_leave()}
            />
            <FlareAdminHeader
              title={m.settings_header_title()}
              description={m.settings_header_desc()}
              actions={
                TAB_SECTION[activeTab] ? (
                  <Button type="submit" disabled={isSubmitting || !isDirty}>
                    {isSubmitting ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Check size={16} />
                    )}
                    {isSubmitting
                      ? m.settings_btn_saving()
                      : m.settings_btn_save()}
                  </Button>
                ) : undefined
              }
            />
            <Tabs
              value={activeTab}
              onValueChange={(value) => setActiveTab(value as typeof activeTab)}
              className="grid min-w-0 gap-5 min-[1440px]:grid-cols-[13rem_minmax(0,1fr)]"
            >
              <div
                ref={tabsScrollRef}
                className="sticky top-0 z-20 min-w-0 overflow-x-auto rounded-2xl border border-border/60 bg-card p-2 lg:self-start"
              >
                <TabsList className="flex w-max gap-1 bg-transparent min-[1440px]:w-full min-[1440px]:flex-col min-[1440px]:items-stretch">
                  {tabItems.map(({ value, icon: Icon, label }) => (
                    <TabsTrigger
                      key={value}
                      value={value}
                      className="flex shrink-0 items-center justify-start gap-2 rounded-xl px-3 py-3 text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
                    >
                      <Icon size={16} />
                      <span>{label}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
              <div className="min-w-0">
                {tabPanes.map((pane) => (
                  <TabsContent
                    key={pane.value}
                    value={pane.value}
                    className="m-0"
                  >
                    <FlareAdminPanel>
                      <div className="mb-6 border-b border-border/50 pb-5">
                        <h2 className="flex items-center gap-2 text-lg font-semibold">
                          <pane.icon size={19} />
                          {pane.title}
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          {pane.desc}
                        </p>
                      </div>
                      {pane.children}
                    </FlareAdminPanel>
                  </TabsContent>
                ))}
              </div>
            </Tabs>
            {isDirty && TAB_SECTION[activeTab] ? (
              <div className="sticky bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3 shadow-lg">
                <span className="text-sm">{m.settings_unsaved_title()}</span>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting
                    ? m.settings_btn_saving()
                    : m.settings_btn_save()}
                </Button>
              </div>
            ) : null}
          </form>
        </FormProvider>
      );
    }

    return (
      <FormProvider {...methods}>
        <form
          ref={formRef}
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-1000 lg:space-y-12"
        >
          <ConfirmationModal
            isOpen={blockerStatus === "blocked"}
            onClose={() => resetBlocker?.()}
            onConfirm={handleSaveAndLeave}
            onSecondaryConfirm={() => proceed?.()}
            title={m.settings_unsaved_title()}
            message={m.settings_unsaved_message()}
            confirmLabel={m.settings_unsaved_save_and_leave()}
            secondaryConfirmLabel={m.settings_unsaved_leave()}
          />

          {/* Header Area */}
          <div className="flex flex-col justify-between gap-4 pb-5 sm:flex-row sm:items-end border-b border-(--fuwari-btn-regular-bg) lg:pb-8">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight fuwari-text-90 sm:text-3xl">
                {m.settings_header_title()}
              </h1>
              <p className="text-xs sm:text-sm fuwari-text-50">
                {m.settings_header_desc()}
              </p>
            </div>

            {TAB_SECTION[activeTab] && (
              <Button
                type="submit"
                disabled={isSubmitting || !isDirty}
                className="hidden h-11 gap-2 rounded-xl px-6 font-medium sm:flex fuwari-btn-primary active:scale-95 disabled:opacity-60"
              >
                {isSubmitting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Check size={16} />
                )}
                {isSubmitting ? m.settings_btn_saving() : m.settings_btn_save()}
              </Button>
            )}
          </div>

          {/* Segmented Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={(value) =>
              setActiveTab(value as (typeof tabItems)[number]["value"])
            }
            className="flex flex-col lg:grid lg:grid-cols-[220px_1fr] items-start gap-8 lg:gap-16"
          >
            <div
              ref={tabsScrollRef}
              className="sticky top-0 z-40 w-full self-start overflow-x-auto no-scrollbar bg-(--fuwari-page-bg)/85 pt-0.5 pb-2 backdrop-blur-md lg:bg-transparent lg:pt-0 lg:pb-0 lg:overflow-visible lg:backdrop-blur-none"
            >
              <TabsList className="min-w-max grow sm:min-w-0 sm:flex-wrap sm:max-w-full sm:justify-start lg:w-full lg:min-w-0 lg:flex-col lg:flex-wrap lg:justify-start lg:gap-1 lg:p-1.5 lg:shrink-0">
                {tabItems.map(({ value, icon: Icon, label }) => (
                  <TabsTrigger
                    key={value}
                    value={value}
                    className="mx-0 flex w-auto items-center justify-center gap-1.5 whitespace-nowrap px-3 py-2 last:mr-0 lg:w-full lg:justify-start lg:rounded-xl lg:px-3 lg:py-2.5"
                  >
                    <Icon size={15} className="shrink-0" />
                    <span>{label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <div className="min-w-0 flex-1 space-y-12 pt-2 lg:pt-0">
              {tabPanes.map((pane, index) => {
                const Icon = pane.icon;

                return (
                  <TabsContent
                    key={pane.value}
                    value={pane.value}
                    className="mt-0 space-y-10 fuwari-onload-animation"
                    style={{ animationDelay: `${index * 40}ms` }}
                  >
                    <div className="flex items-start gap-4 border-b border-(--fuwari-btn-regular-bg) pb-6">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-(--fuwari-btn-regular-bg) lg:h-11 lg:w-11">
                        <Icon size={18} className="fuwari-text-50" />
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <h2 className="text-lg font-bold leading-tight fuwari-text-90 sm:text-xl lg:text-2xl">
                          {pane.title}
                        </h2>
                        <p className="text-xs sm:text-sm fuwari-text-50">
                          {pane.desc}
                        </p>
                      </div>
                    </div>
                    {pane.children}
                  </TabsContent>
                );
              })}
            </div>
          </Tabs>

          {/* Floating Action Button for Mobile */}
          {isDirty && TAB_SECTION[activeTab] && (
            <div className="fixed bottom-8 right-6 z-50 sm:hidden animate-in fade-in zoom-in slide-in-from-bottom-10 duration-500">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex h-14 w-14 items-center justify-center rounded-full p-0 shadow-2xl fuwari-btn-primary active:scale-95"
              >
                {isSubmitting ? (
                  <Loader2 size={24} className="animate-spin" />
                ) : (
                  <Check size={24} />
                )}
              </Button>
            </div>
          )}
        </form>
      </FormProvider>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-8 pb-20">
        <SectionSkeleton />
      </div>
    );
  }

  return (
    <FormProvider {...methods}>
      <form
        ref={formRef}
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-1000 lg:space-y-12"
      >
        <ConfirmationModal
          isOpen={blockerStatus === "blocked"}
          onClose={() => resetBlocker?.()}
          onConfirm={handleSaveAndLeave}
          onSecondaryConfirm={() => proceed?.()}
          title={m.settings_unsaved_title()}
          message={m.settings_unsaved_message()}
          confirmLabel={m.settings_unsaved_save_and_leave()}
          secondaryConfirmLabel={m.settings_unsaved_leave()}
        />

        {/* Header Area */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 pb-5 border-b border-border/30 lg:pb-8">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-serif font-medium tracking-tight text-foreground">
              {m.settings_header_title()}
            </h1>
            <p className="text-sm text-muted-foreground">
              {m.settings_header_desc()}
            </p>
          </div>

          {TAB_SECTION[activeTab] && (
            <Button
              type="submit"
              disabled={isSubmitting || !isDirty}
              className="hidden sm:flex h-11 px-8 rounded-none bg-foreground text-background hover:bg-foreground/90 transition-all font-mono text-[11px] uppercase tracking-[0.2em] font-medium disabled:opacity-50 shadow-lg shadow-foreground/5"
            >
              {isSubmitting ? (
                <Loader2 size={14} className="animate-spin mr-3" />
              ) : (
                <Check size={14} className="mr-3" />
              )}
              {isSubmitting ? m.settings_btn_saving() : m.settings_btn_save()}
            </Button>
          )}
        </div>

        {/* Main Content with Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(value) =>
            setActiveTab(value as (typeof tabItems)[number]["value"])
          }
          className="flex flex-col lg:grid lg:grid-cols-[220px_1fr] gap-8 lg:gap-16 items-start"
        >
          <div className="sticky top-0 z-40 w-full self-start border-b border-border/20 bg-background/96 pt-0.5 pb-2 backdrop-blur-md shadow-[0_12px_30px_-24px_rgba(15,23,42,0.55)] lg:border-b-0 lg:bg-transparent lg:pt-0 lg:pb-0 lg:backdrop-blur-none lg:shadow-none">
            <div ref={tabsScrollRef} className="overflow-x-auto no-scrollbar">
              <div className="mx-auto flex w-max flex-row justify-start rounded-2xl border border-border/25 bg-background/90 p-1.5 gap-1.5 transition-all duration-300 lg:w-full lg:min-w-0 lg:flex-col lg:justify-start lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:gap-1.5 lg:border-r lg:border-border/20 lg:pr-6">
                {tabItems.map(({ value, icon: Icon, label }) => {
                  const isActive = activeTab === value;

                  return (
                    <TabsTrigger
                      key={value}
                      value={value}
                      className={cn(
                        "flex items-center justify-center px-3 py-2.5 rounded-full text-[10px] font-mono uppercase tracking-[0.15em] transition-all duration-300 border-none shadow-none group shrink-0 whitespace-nowrap lg:w-full lg:justify-start lg:px-4 lg:py-3 lg:rounded-none lg:border-l-2 lg:border-transparent",
                        "text-muted-foreground data-[state=active]:bg-foreground data-[state=active]:text-background lg:data-[state=active]:bg-foreground lg:data-[state=active]:text-background lg:data-[state=active]:border-foreground",
                        isActive ? "pl-3 pr-4" : "px-3",
                      )}
                    >
                      <Icon
                        size={14}
                        className={cn(
                          "shrink-0 transition-all duration-300",
                          isActive ? "opacity-100" : "opacity-60",
                        )}
                      />
                      <span
                        className={cn(
                          "overflow-hidden whitespace-nowrap text-left transition-all duration-300 ease-out",
                          isActive
                            ? "ml-2 max-w-32 opacity-100"
                            : "ml-0 max-w-0 opacity-0",
                          "lg:ml-3 lg:max-w-none lg:opacity-100",
                        )}
                      >
                        {label}
                      </span>
                    </TabsTrigger>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex-1 min-w-0 space-y-12 pt-2 lg:pt-0">
            <TabsContent value="site" className="mt-0 space-y-10">
              <div className="space-y-2 pb-6 border-b border-border/30">
                <h2 className="text-2xl font-serif font-medium tracking-tight">
                  {m.settings_site_title()}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {m.settings_site_desc()}
                </p>
              </div>
              <SiteSettingsSection />
            </TabsContent>

            <TabsContent value="integrations" className="mt-0 space-y-10">
              <div className="space-y-2 pb-6 border-b border-border/30">
                <h2 className="text-2xl font-serif font-medium tracking-tight">
                  {m.settings_mcp_title()}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {m.settings_mcp_desc()}
                </p>
              </div>
              <OAuthClientsSection />
            </TabsContent>

            <TabsContent value="email" className="mt-0 space-y-10">
              <div className="space-y-2 pb-6 border-b border-border/30">
                <h2 className="text-2xl font-serif font-medium tracking-tight">
                  {m.settings_email_title()}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {m.settings_email_desc()}
                </p>
              </div>
              <EmailServiceSection testEmailConnection={testEmailConnection} />
            </TabsContent>

            <TabsContent value="ai" className="mt-0 space-y-10">
              <div className="space-y-2 pb-6 border-b border-border/30">
                <h2 className="text-2xl font-serif font-medium tracking-tight">
                  {m.settings_ai_title()}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {m.settings_ai_desc()}
                </p>
              </div>
              <AiSettingsSection testAiConnection={testAiConnection} />
            </TabsContent>

            <TabsContent value="image-hosting" className="mt-0 space-y-10">
              <div className="space-y-2 pb-6 border-b border-border/30">
                <h2 className="text-2xl font-serif font-medium tracking-tight">
                  {m.settings_image_hosting_title()}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {m.settings_image_hosting_desc()}
                </p>
              </div>
              <ImageHostingSettingsSection
                testImageHostingConnection={testImageHostingConnection}
              />
            </TabsContent>

            <TabsContent value="challenge" className="mt-0 space-y-10">
              <div className="space-y-2 pb-6 border-b border-border/30">
                <h2 className="text-2xl font-serif font-medium tracking-tight">
                  {m.settings_challenge_title()}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {m.settings_challenge_desc()}
                </p>
              </div>
              <ChallengeSettingsSection />
            </TabsContent>

            <TabsContent value="wechat-verify" className="mt-0 space-y-10">
              <div className="space-y-2 pb-6 border-b border-border/30">
                <h2 className="text-2xl font-serif font-medium tracking-tight">
                  {m.settings_wechat_verify_title()}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {m.settings_wechat_verify_desc()}
                </p>
              </div>
              <WechatVerifySettingsSection />
            </TabsContent>

            <TabsContent value="webhook" className="mt-0 space-y-10">
              <div className="space-y-2 pb-6 border-b border-border/30">
                <h2 className="text-2xl font-serif font-medium tracking-tight">
                  {m.settings_webhook_title()}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {m.settings_webhook_desc()}
                </p>
              </div>
              <WebhookSettingsSection />
            </TabsContent>

            <TabsContent value="subscription" className="mt-0 space-y-10">
              <div className="space-y-2 pb-6 border-b border-border/30">
                <h2 className="text-2xl font-serif font-medium tracking-tight">
                  {m.settings_subscription_title()}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {m.settings_subscription_desc()}
                </p>
              </div>
              <SubscriptionSettingsSection />
            </TabsContent>

            <TabsContent value="cloudflare" className="mt-0 space-y-10">
              <div className="space-y-2 pb-6 border-b border-border/30">
                <h2 className="text-2xl font-serif font-medium tracking-tight">
                  Cloudflare 用量监控
                </h2>
                <p className="text-sm text-muted-foreground">
                  监控 Cloudflare 免费额度使用情况，支持告警通知
                </p>
              </div>
              <CloudflareAnalyticsSettingsSection />
            </TabsContent>

            <TabsContent value="maintenance" className="mt-0 space-y-10">
              <div className="space-y-2 pb-6 border-b border-border/30">
                <h2 className="text-2xl font-serif font-medium tracking-tight">
                  {m.settings_maintenance_title()}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {m.settings_maintenance_desc()}
                </p>
              </div>
              <MaintenanceSection />
            </TabsContent>

            <TabsContent value="storage" className="mt-0 space-y-10">
              <div className="space-y-2 pb-6 border-b border-border/30">
                <h2 className="text-2xl font-serif font-medium tracking-tight">
                  存储管理
                </h2>
                <p className="text-sm text-muted-foreground">
                  管理 KV 与 D1 存储后端，KV 达到限额时自动降级到 D1
                </p>
              </div>
              <StorageSettingsSection />
            </TabsContent>
          </div>
        </Tabs>

        {/* Floating Action Button for Mobile */}
        {isDirty && TAB_SECTION[activeTab] && (
          <div className="fixed bottom-8 right-6 z-50 sm:hidden animate-in fade-in zoom-in slide-in-from-bottom-10 duration-500">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-14 w-14 rounded-full bg-foreground text-background hover:bg-foreground/90 transition-all shadow-2xl flex items-center justify-center p-0"
            >
              {isSubmitting ? (
                <Loader2 size={24} className="animate-spin" />
              ) : (
                <Check size={24} />
              )}
            </Button>
          </div>
        )}
      </form>
    </FormProvider>
  );
}

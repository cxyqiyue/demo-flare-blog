import { Link } from "@tanstack/react-router";
import { Loader2, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ProfilePageProps } from "@/features/theme/contract/pages";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

export function ProfilePage({
  user,
  profileForm,
  passwordForm,
  notification,
  subscription,
  logout,
}: ProfilePageProps) {
  const inputClassName =
    "h-10 rounded-lg border border-border/60 bg-background/60 px-3 text-sm shadow-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:border-border";
  const sectionClassName =
    "rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-5 md:p-7 shadow-sm space-y-5";

  return (
    <div className="flex flex-col w-full mx-auto space-y-4 md:space-y-6">
      <section className={sectionClassName}>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
              {m.profile_settings()}
            </h1>
            <p className="text-sm md:text-base text-muted-foreground leading-7">
              {m.profile_settings_desc()}
            </p>
          </div>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors w-fit"
          >
            <Terminal size={14} />
            {m.profile_back_home()}
          </Link>
        </div>

        <div className="flex items-center gap-4 sm:gap-5 pt-1">
          <div
            className="w-20 h-20 rounded-full overflow-hidden border border-border/60 bg-muted/30 relative shrink-0"
            style={{ viewTransitionName: "user-avatar" }}
          >
            {user.image ? (
              <img
                src={user.image}
                alt={user.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground text-2xl font-medium">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0 space-y-1">
            <h2 className="text-lg md:text-xl font-semibold text-foreground truncate">
              {user.name}
            </h2>
            <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
              <span>
                {user.role === "admin"
                  ? m.profile_role_admin()
                  : m.profile_role_reader()}
              </span>
              <span className="break-all">{user.email}</span>
            </div>
          </div>
        </div>
      </section>

      <section className={sectionClassName}>
        <h3 className="text-lg font-semibold text-foreground">
          {m.profile_basic_info()}
        </h3>
        <form onSubmit={profileForm.handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground/90">
              {m.profile_name()}
            </label>
            <Input {...profileForm.register("name")} className={inputClassName} />
            {profileForm.errors.name && (
              <span className="text-xs text-destructive">
                {profileForm.errors.name.message}
              </span>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground/90">
              {m.profile_avatar_url()}
            </label>
            <Input
              {...profileForm.register("image")}
              className={inputClassName}
              placeholder="https://..."
            />
            {profileForm.errors.image && (
              <span className="text-xs text-destructive">
                {profileForm.errors.image.message}
              </span>
            )}
          </div>

          <div className="pt-1">
            <Button type="submit" disabled={profileForm.isSubmitting} className="rounded-full">
              {profileForm.isSubmitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" />
                  {m.profile_saving()}
                </span>
              ) : (
                m.profile_save_changes()
              )}
            </Button>
          </div>
        </form>
      </section>

      {notification.available && (
        <section className={sectionClassName}>
          <h3 className="text-lg font-semibold text-foreground">
            {m.profile_preferences()}
          </h3>
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border/50 bg-background/40 p-4">
            <div className="space-y-1 min-w-0">
              <span className="text-sm font-medium text-foreground block">
                {m.profile_email_notify()}
              </span>
              <span className="text-xs text-muted-foreground block">
                {m.profile_email_notify_desc()}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={notification.isLoading || notification.isPending}
              onClick={notification.toggle}
              className={cn(
                "rounded-full shrink-0",
                notification.enabled && "border-foreground/30",
              )}
            >
              {notification.enabled
                ? m.profile_notify_enabled()
                : m.profile_notify_disabled()}
            </Button>
          </div>
        </section>
      )}

      <section className={sectionClassName}>
        <h3 className="text-lg font-semibold text-foreground">
          {m.profile_subscription_title()}
        </h3>
        <div className="flex items-center justify-between gap-4 rounded-xl border border-border/50 bg-background/40 p-4">
          <div className="space-y-1 min-w-0">
            <span className="text-sm font-medium text-foreground block">
              {m.profile_subscription_label()}
            </span>
            <span className="text-xs text-muted-foreground block">
              {subscription.available
                ? m.profile_subscription_desc()
                : m.profile_subscription_no_email()}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={subscription.isLoading || subscription.isPending}
            onClick={subscription.toggle}
            className={cn(
              "rounded-full shrink-0",
              subscription.subscribed && "border-foreground/30",
            )}
          >
            {subscription.isLoading
              ? m.profile_notify_status_loading()
              : subscription.subscribed
                ? m.profile_subscription_subscribed()
                : m.profile_subscription_not_subscribed()}
          </Button>
        </div>
      </section>

      {passwordForm && (
        <section className={sectionClassName}>
          <h3 className="text-lg font-semibold text-foreground">
            {m.profile_security_settings()}
          </h3>
          <form onSubmit={passwordForm.handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground/90">
                {m.profile_current_password()}
              </label>
              <Input
                type="password"
                {...passwordForm.register("currentPassword")}
                className={inputClassName}
              />
              {passwordForm.errors.currentPassword && (
                <span className="text-xs text-destructive">
                  {passwordForm.errors.currentPassword.message}
                </span>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground/90">
                {m.profile_new_password()}
              </label>
              <Input
                type="password"
                {...passwordForm.register("newPassword")}
                className={inputClassName}
              />
              {passwordForm.errors.newPassword && (
                <span className="text-xs text-destructive">
                  {passwordForm.errors.newPassword.message}
                </span>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground/90">
                {m.profile_confirm_password()}
              </label>
              <Input
                type="password"
                {...passwordForm.register("confirmPassword")}
                className={inputClassName}
              />
              {passwordForm.errors.confirmPassword && (
                <span className="text-xs text-destructive">
                  {passwordForm.errors.confirmPassword.message}
                </span>
              )}
            </div>

            <div className="pt-1">
              <Button type="submit" disabled={passwordForm.isSubmitting} variant="outline" className="rounded-full">
                {passwordForm.isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin" />
                    {m.profile_updating()}
                  </span>
                ) : (
                  m.profile_update_password()
                )}
              </Button>
            </div>
          </form>
        </section>
      )}

      <section className={cn(sectionClassName, "flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3")}>
        <div className="flex items-center gap-2">
          {user.role === "admin" && (
            <Link
              to="/admin"
              className="inline-flex items-center rounded-full border border-border/60 bg-background/60 px-4 py-2 text-sm text-foreground/80 hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              {m.profile_admin_dashboard()}
            </Link>
          )}
        </div>
        <Button variant="ghost" onClick={logout} className="text-destructive hover:text-destructive hover:bg-destructive/10 rounded-full">
          {m.profile_logout()}
        </Button>
      </section>
    </div>
  );
}

import { Checkbox } from "@/components/ui/checkbox";
import { isFuwari } from "@/lib/theme-mode";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

interface EmailNotificationScopeProps {
  adminEmailEnabled: boolean;
  userEmailEnabled: boolean;
  onToggleAdmin: (checked: boolean) => void;
  onToggleUser: (checked: boolean) => void;
}

function ScopeCard({
  checked,
  onToggle,
  title,
  desc,
}: {
  checked: boolean;
  onToggle: (checked: boolean) => void;
  title: string;
  desc: string;
}) {
  if (isFuwari) {
    return (
      <label
        className={cn(
          "flex cursor-pointer items-center gap-4 rounded-xl border p-4 transition-all",
          checked
            ? "border-(--fuwari-primary)/60 bg-(--fuwari-primary)/10"
            : "border-(--fuwari-input-border) hover:border-(--fuwari-primary)/40",
        )}
      >
        <Checkbox checked={checked} onCheckedChange={onToggle} />
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-bold fuwari-text-90">{title}</p>
          <p className="break-all text-xs sm:text-sm fuwari-text-50">{desc}</p>
        </div>
      </label>
    );
  }
  return (
    <label className="flex cursor-pointer items-center gap-4 border border-border/20 bg-muted/10 p-4 transition-colors hover:bg-muted/20">
      <Checkbox checked={checked} onCheckedChange={onToggle} />
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="break-all text-sm text-muted-foreground">{desc}</p>
      </div>
    </label>
  );
}

export function EmailNotificationScope({
  adminEmailEnabled,
  userEmailEnabled,
  onToggleAdmin,
  onToggleUser,
}: EmailNotificationScopeProps) {
  if (isFuwari) {
    return (
      <div className="fuwari-card-base p-4 sm:p-5 md:p-6 fuwari-onload-animation">
        <h5 className="text-base font-bold fuwari-text-90 mb-5">
          {m.settings_email_scope_title()}
        </h5>
        <div className="grid gap-3 xl:grid-cols-2">
          <ScopeCard
            checked={adminEmailEnabled}
            onToggle={onToggleAdmin}
            title={m.settings_email_scope_admin_label()}
            desc={m.settings_email_scope_admin_desc()}
          />
          <ScopeCard
            checked={userEmailEnabled}
            onToggle={onToggleUser}
            title={m.settings_email_scope_user_label()}
            desc={m.settings_email_scope_user_desc()}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-8">
      <h5 className="text-sm font-medium text-foreground">
        {m.settings_email_scope_title()}
      </h5>
      <div className="grid gap-4 xl:grid-cols-2">
        <ScopeCard
          checked={adminEmailEnabled}
          onToggle={onToggleAdmin}
          title={m.settings_email_scope_admin_label()}
          desc={m.settings_email_scope_admin_desc()}
        />
        <ScopeCard
          checked={userEmailEnabled}
          onToggle={onToggleUser}
          title={m.settings_email_scope_user_label()}
          desc={m.settings_email_scope_user_desc()}
        />
      </div>
    </div>
  );
}

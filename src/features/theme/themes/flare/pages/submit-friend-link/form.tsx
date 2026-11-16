import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { FriendLinkSubmitFormData } from "@/features/theme/contract/pages";
import { m } from "@/paraglide/messages";

interface FriendLinkSubmitFormProps {
  form: FriendLinkSubmitFormData;
}

export function FriendLinkSubmitForm({ form }: FriendLinkSubmitFormProps) {
  const { register, errors, handleSubmit, isSubmitting } = form;

  const inputClassName =
    "h-10 rounded-lg border border-border/60 bg-background/60 px-3 text-sm shadow-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:border-border";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2 md:col-span-1">
          <label className="text-sm font-medium text-foreground/90">
            {m.friend_link_field_site_name()} *
          </label>
          <Input
            {...register("siteName")}
            className={inputClassName}
            placeholder={m.friend_link_placeholder_site_name_default()}
          />
          {errors.siteName && (
            <span className="text-xs text-destructive">{errors.siteName.message}</span>
          )}
        </div>

        <div className="space-y-2 md:col-span-1">
          <label className="text-sm font-medium text-foreground/90">
            {m.friend_link_field_site_url()} *
          </label>
          <Input
            {...register("siteUrl")}
            className={inputClassName}
            placeholder={m.friend_link_placeholder_site_url()}
          />
          {errors.siteUrl && (
            <span className="text-xs text-destructive">{errors.siteUrl.message}</span>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground/90">
          {m.friend_link_field_description_default()}
        </label>
        <Input
          {...register("description")}
          className={inputClassName}
          placeholder={m.friend_link_placeholder_description_default()}
        />
        {errors.description && (
          <span className="text-xs text-destructive">{errors.description.message}</span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground/90">
            {m.friend_link_field_logo_url_default()}
          </label>
          <Input
            {...register("logoUrl")}
            className={inputClassName}
            placeholder={m.friend_link_placeholder_site_url()}
          />
          {errors.logoUrl && (
            <span className="text-xs text-destructive">{errors.logoUrl.message}</span>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground/90">
            {m.friend_link_field_contact_email()} *
          </label>
          <Input
            {...register("contactEmail")}
            className={inputClassName}
            placeholder={m.friend_link_placeholder_contact_email_default()}
          />
          {errors.contactEmail && (
            <span className="text-xs text-destructive">{errors.contactEmail.message}</span>
          )}
        </div>
      </div>

      <div className="pt-1">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground text-background px-5 py-2.5 text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              {m.friend_link_submitting()}
            </>
          ) : (
            m.friend_link_submit_button_default()
          )}
        </button>
      </div>
    </form>
  );
}

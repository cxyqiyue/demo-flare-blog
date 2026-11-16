import { useFormContext } from "react-hook-form";
import { AssetUploadField } from "@/features/config/components/asset-upload-field";
import type { SystemConfig } from "@/features/config/config.schema";
import { isFuwari } from "@/lib/theme-mode";
import { m } from "@/paraglide/messages";

export function FlareThemeSettings() {
  const {
    formState: { errors },
  } = useFormContext<SystemConfig>();

  if (isFuwari) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <AssetUploadField
            name="site.theme.flare.homeBg"
            assetPath="themes/flare/home-bg.webp"
            accept=".png,.webp,.jpg,.jpeg"
            label={m.settings_site_field_home_image()}
            hint={m.settings_site_field_home_image_hint()}
            placeholder="/images/asset/themes/flare/home-bg.webp or https://picsum.photos/1600/900"
            error={errors.site?.theme?.flare?.homeBg?.message}
          />
        </div>
        <AssetUploadField
          name="site.theme.flare.avatar"
          assetPath="themes/flare/avatar.png"
          accept=".png,.webp,.jpg,.jpeg"
          readOnly
          label={m.settings_site_field_avatar()}
          error={errors.site?.theme?.flare?.avatar?.message}
        />
      </div>
    );
  }

  return (
    <>
      <AssetUploadField
        name="site.theme.flare.homeBg"
        assetPath="themes/flare/home-bg.webp"
        accept=".png,.webp,.jpg,.jpeg"
        label={m.settings_site_field_home_image()}
        hint={m.settings_site_field_home_image_hint()}
        placeholder="/images/asset/themes/flare/home-bg.webp or https://picsum.photos/1600/900"
        error={errors.site?.theme?.flare?.homeBg?.message}
      />
      <AssetUploadField
        name="site.theme.flare.avatar"
        assetPath="themes/flare/avatar.png"
        accept=".png,.webp,.jpg,.jpeg"
        readOnly
        label={m.settings_site_field_avatar()}
        error={errors.site?.theme?.flare?.avatar?.message}
      />
    </>
  );
}

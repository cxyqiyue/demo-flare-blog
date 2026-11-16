import type { SiteConfig } from "@/features/config/site-config.schema";

// if the theme doesn't have a preload image, return an empty array
export function getThemePreloadImages(siteConfig: SiteConfig): Array<string> {
  switch (__THEME_NAME__) {
    case "fuwari":
      return siteConfig.theme.fuwari.homeBg
        ? [siteConfig.theme.fuwari.homeBg]
        : [];
    case "default":
      return [
        siteConfig.theme.default.background?.homeImage,
        siteConfig.theme.default.background?.globalImage,
      ].filter((image): image is string => Boolean(image));
    case "flare":
      return siteConfig.theme.flare.homeBg
        ? [siteConfig.theme.flare.homeBg]
        : [];
    default:
      __THEME_NAME__ satisfies never;
      return [];
  }
}

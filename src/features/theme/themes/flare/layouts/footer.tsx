import { ClientOnly, Link, useRouteContext } from "@tanstack/react-router";
import type { SiteConfig } from "@/features/config/site-config.schema";
import {
  resolveSocialHref,
  SOCIAL_PLATFORMS,
} from "@/features/config/utils/social-platforms";
import type { NavOption } from "@/features/theme/contract/layouts";
import { m } from "@/paraglide/messages";

interface FooterProps {
  navOptions: Array<NavOption>;
}

export function Footer({ navOptions }: FooterProps) {
  const { siteConfig } = useRouteContext({ from: "__root__" });

  return (
    <footer className="flare-surface-soft mt-2 px-5 py-6 md:px-7 md:py-7 text-sm text-muted-foreground">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <div className="text-base font-semibold text-foreground/90 tracking-tight">
            {siteConfig.title}
          </div>
          {siteConfig.description ? (
            <p className="max-w-xl leading-6 text-muted-foreground/90">
              {siteConfig.description}
            </p>
          ) : null}
          <div className="text-xs text-muted-foreground/80">
            <ClientOnly fallback="-">
              {m.footer_copyright({
                year: new Date().getFullYear().toString(),
                author: siteConfig.author,
              })}
            </ClientOnly>
          </div>
        </div>
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 md:justify-end">
          {navOptions.map((option) => (
            <Link
              key={option.id}
              to={option.to}
              className="hover:text-foreground transition-colors"
            >
              {option.label}
            </Link>
          ))}
          {siteConfig.social
            .filter((link: SiteConfig["social"][number]) => link.url)
            .map((link: SiteConfig["social"][number], i: number) => {
              const href = resolveSocialHref(link.platform, link.url);
              const label =
                link.platform !== "custom"
                  ? SOCIAL_PLATFORMS[link.platform].label
                  : (link.label ?? "");
              return (
                <a
                  key={`${link.platform}-${i}`}
                  href={href}
                  target={link.platform === "email" ? undefined : "_blank"}
                  rel={link.platform === "email" ? undefined : "noreferrer"}
                  className="hover:text-foreground transition-colors"
                >
                  {label}
                </a>
              );
            })}
        </nav>
      </div>
    </footer>
  );
}

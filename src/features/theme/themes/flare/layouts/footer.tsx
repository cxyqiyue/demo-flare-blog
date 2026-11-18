import { ClientOnly, Link, useRouteContext } from "@tanstack/react-router";
import { UserRound } from "lucide-react";
import type { NavOption } from "@/features/theme/contract/layouts";
import { m } from "@/paraglide/messages";
import { SocialLinks } from "../components/social-links";

interface FooterProps {
  navOptions: Array<NavOption>;
}

export function Footer({ navOptions }: FooterProps) {
  const { siteConfig } = useRouteContext({ from: "__root__" });
  const avatar =
    siteConfig.theme?.flare?.avatar || siteConfig.theme?.fuwari?.avatar;

  return (
    <footer className="flare-surface px-5 py-7 text-sm text-muted-foreground md:px-8 md:py-9">
      <div className="grid gap-7 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-12">
        <div className="min-w-0 space-y-3">
          <div className="flex min-w-0 items-center gap-3">
            {avatar ? (
              <img
                src={avatar}
                alt=""
                width={48}
                height={48}
                loading="lazy"
                className="size-12 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span
                className="grid size-12 shrink-0 place-items-center rounded-full bg-muted"
                aria-hidden="true"
              >
                <UserRound size={20} />
              </span>
            )}
            <div className="min-w-0 wrap-anywhere">
              <div className="text-base font-semibold tracking-tight text-foreground">
                {siteConfig.author || siteConfig.title}
              </div>
            </div>
          </div>
          {siteConfig.description ? (
            <p className="max-w-xl leading-6 text-muted-foreground/90">
              {siteConfig.description}
            </p>
          ) : null}
          <div className="text-xs text-muted-foreground/70">
            <ClientOnly fallback="-">
              {m.footer_copyright({
                year: new Date().getFullYear().toString(),
                author: siteConfig.author,
              })}
            </ClientOnly>
          </div>
        </div>

        <div className="min-w-0 md:justify-self-end">
          <nav
            className="flex flex-wrap items-center gap-x-4 gap-y-1"
            aria-label={m.footer_navigation()}
          >
            {navOptions.map((option) => (
              <Link
                key={option.id}
                to={option.to}
                className="inline-flex min-h-11 items-center text-[13px] transition-colors hover:text-foreground"
              >
                {option.label}
              </Link>
            ))}
          </nav>
          <SocialLinks links={siteConfig.social} className="-ml-3" />
        </div>
      </div>
    </footer>
  );
}

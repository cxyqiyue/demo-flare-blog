import { Link2, MessageCircle, Send } from "lucide-react";
import {
  resolveSocialHref,
  SOCIAL_PLATFORMS,
  type SocialLink,
} from "@/features/config/utils/social-platforms";

export function SocialLinks({
  links,
  className,
}: {
  links: SocialLink[];
  className?: string;
}) {
  const visibleLinks = links.filter((link) => link.url);
  if (!visibleLinks.length) return null;

  return (
    <ul className={`flex flex-wrap gap-1 ${className ?? ""}`}>
      {visibleLinks.map((link, index) => {
        const preset =
          link.platform === "custom" ? null : SOCIAL_PLATFORMS[link.platform];
        const label = preset?.label || link.label?.trim() || link.url;
        const Icon =
          preset?.icon ??
          (label.toLowerCase() === "telegram"
            ? Send
            : label.toLowerCase() === "qq"
              ? MessageCircle
              : label.toLowerCase() === "bilibili"
                ? SOCIAL_PLATFORMS.bilibili.icon
                : Link2);
        return (
          <li key={`${link.platform}-${index}`}>
            <a
              href={resolveSocialHref(link.platform, link.url)}
              target={link.platform === "email" ? undefined : "_blank"}
              rel={link.platform === "email" ? undefined : "noreferrer"}
              aria-label={label}
              title={label}
              className="grid size-11 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
            >
              {link.platform === "custom" && link.icon ? (
                <img
                  src={link.icon}
                  alt=""
                  className="size-[18px] object-contain"
                />
              ) : (
                <span aria-hidden="true">
                  <Icon size={18} strokeWidth={1.75} />
                </span>
              )}
            </a>
          </li>
        );
      })}
    </ul>
  );
}

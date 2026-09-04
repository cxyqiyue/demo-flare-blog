import { ExternalLink, Globe } from "lucide-react";
import { renderMarkdownToHtml } from "@/features/about/utils/markdown";
import type { FriendLinksConfig } from "@/features/config/config.schema";
import { m } from "@/paraglide/messages";

interface SiteInfoAndApplyRulesProps {
  siteInfo: NonNullable<FriendLinksConfig["siteInfo"]>;
  applyRules: Array<{ id: string; content: string }>;
}

/**
 * 友链页中段两栏区块：
 * - 左栏「本站信息」：展示给申请者的博主/站点元信息（name 支持 Markdown 链接）。
 * - 右栏「申请须知」：最多 5 条 Markdown 文本，逐行渲染，行间以分隔线隔开
 *   （形似无外框/无竖线的 Markdown 表格），行线与文字保持间距。
 */
export function SiteInfoAndApplyRules({
  siteInfo,
  applyRules,
}: SiteInfoAndApplyRulesProps) {
  const hasSiteInfo =
    siteInfo.name || siteInfo.url || siteInfo.description || siteInfo.avatar || siteInfo.email;

  const visibleRules = applyRules.filter((rule) => rule.content.trim() !== "");

  return (
    <section className="mt-20 pt-10 border-t border-border/40">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-14">
        {/* 本站信息 */}
        <div className="space-y-5">
          <h2 className="text-sm font-mono uppercase tracking-[0.2em] text-foreground">
            [ {m.friend_links_site_info_title()} ]
          </h2>

          {!hasSiteInfo ? (
            <p className="text-sm text-muted-foreground/60 font-serif italic">
              {m.friend_links_site_info_missing()}
            </p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                {siteInfo.avatar && (
                  <img
                    src={siteInfo.avatar}
                    alt={siteInfo.name || "avatar"}
                    className="w-16 h-16 object-cover border border-border/40"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                )}
                <div className="min-w-0 space-y-1">
                  {siteInfo.name && (
                    <p className="text-lg font-serif font-medium text-foreground tracking-tight">
                      {siteInfo.name}
                    </p>
                  )}
                  {siteInfo.url && (
                    <a
                      href={siteInfo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 truncate"
                    >
                      <ExternalLink size={11} className="shrink-0" />
                      <span className="truncate">{siteInfo.url}</span>
                    </a>
                  )}
                </div>
              </div>

              <dl className="space-y-3">
                {siteInfo.description && (
                  <InfoRow label={m.friend_links_site_info_desc()}>
                    <div
                      className="about-md [&_p]:my-0 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_a]:underline [&_a]:decoration-foreground/30 [&_a:hover]:decoration-foreground"
                      dangerouslySetInnerHTML={{
                        __html: renderMarkdownToHtml(siteInfo.description),
                      }}
                    />
                  </InfoRow>
                )}
                {siteInfo.email && (
                  <InfoRow label={m.friend_links_site_info_email()}>
                    {siteInfo.email}
                  </InfoRow>
                )}
                {!siteInfo.description && !siteInfo.email && siteInfo.name && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Globe size={13} />
                    <span className="text-xs">{siteInfo.name}</span>
                  </div>
                )}
              </dl>
            </div>
          )}
        </div>

        {/* 申请须知 */}
        <div className="space-y-5">
          <h2 className="text-sm font-mono uppercase tracking-[0.2em] text-foreground">
            [ {m.friend_links_apply_rules_title()} ]
          </h2>

          {visibleRules.length === 0 ? (
            <p className="text-sm text-muted-foreground/60 font-serif italic">
              {m.friend_links_apply_rules_empty()}
            </p>
          ) : (
            <div className="divide-y divide-border/40">
              {visibleRules.map((rule, index) => (
                <div
                  key={rule.id || index}
                  className="py-3 first:pt-0 last:pb-0 flex gap-3"
                >
                  <span className="w-5 shrink-0 pt-px text-right font-mono text-xs text-muted-foreground/50">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div
                    className="about-md text-sm leading-relaxed text-muted-foreground [&_p]:my-0 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_a]:underline [&_a]:decoration-foreground/30 [&_a:hover]:decoration-foreground"
                    dangerouslySetInnerHTML={{
                      __html: renderMarkdownToHtml(rule.content),
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function InfoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <dt className="w-14 shrink-0 text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 pt-1">
        {label}
      </dt>
      <dd className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
        {children}
      </dd>
    </div>
  );
}

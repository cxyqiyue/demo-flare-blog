import { renderMarkdownToHtml } from "@/features/about/utils/markdown";
import type { FriendLinksConfig } from "@/features/config/config.schema";
import { m } from "@/paraglide/messages";

interface SiteInfoAndApplyRulesProps {
  siteInfo: NonNullable<FriendLinksConfig["siteInfo"]>;
  applyRules: Array<{ id: string; content: string }>;
}

/**
 * 友链「本站信息 + 申请须知」内容块（无自身外框容器，由各主题放入「申请友链」所在容器内）。
 * - 本站信息：以完整字段清单展示（名称/地址/描述/头像/邮箱），方便访客主动添加本站为友链。
 * - 申请须知：最多 5 条 Markdown 文本，逐行渲染，行间以分隔线隔开，行线与文字保持间距。
 * 样式统一使用前台主题的排版令牌（font-serif / font-mono / text-muted-foreground 等），非后台管理风格。
 */
export function SiteInfoAndApplyRules({
  siteInfo,
  applyRules,
}: SiteInfoAndApplyRulesProps) {
  const visibleRules = applyRules.filter((rule) => rule.content.trim() !== "");

  return (
    <>
      {/* 本站信息 —— 完整字段清单 */}
      <section className="space-y-5">
        <h2 className="text-sm font-serif font-medium tracking-tight text-foreground">
          {m.friend_links_site_info_title()}
        </h2>

        <div className="space-y-4">
          {/* 名称 + 头像 */}
          {(siteInfo.name || siteInfo.avatar) && (
            <div className="flex items-center gap-4">
              {siteInfo.avatar && (
                <img
                  src={siteInfo.avatar}
                  alt={siteInfo.name || "avatar"}
                  className="w-14 h-14 object-cover rounded-lg border border-border/40"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              )}
              {siteInfo.name && (
                <div>
                  <p className="font-serif text-lg font-medium text-foreground tracking-tight">
                    {siteInfo.name}
                  </p>
                  {siteInfo.url && (
                    <a
                      href={siteInfo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {siteInfo.url}
                    </a>
                  )}
                </div>
              )}
              {siteInfo.name && !siteInfo.url && (
                <p className="text-xs font-mono text-muted-foreground">
                  {siteInfo.name}
                </p>
              )}
            </div>
          )}

          {/* 字段清单 */}
          <dl className="space-y-3">
            {siteInfo.name && !siteInfo.avatar && (
              <FieldRow label={m.friend_links_site_info_name()}>
                {siteInfo.name}
              </FieldRow>
            )}
            {siteInfo.url && (
              <FieldRow label={m.friend_links_site_info_url()}>
                <a
                  href={siteInfo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors underline decoration-border/50 underline-offset-4"
                >
                  {siteInfo.url}
                </a>
              </FieldRow>
            )}
            {siteInfo.description && (
              <FieldRow label={m.friend_links_site_info_desc()}>
                <div
                  className="text-sm leading-relaxed [&_p]:my-0 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_a]:underline [&_a]:decoration-foreground/30 [&_a:hover]:decoration-foreground"
                  dangerouslySetInnerHTML={{
                    __html: renderMarkdownToHtml(siteInfo.description),
                  }}
                />
              </FieldRow>
            )}
            {siteInfo.avatar && (
              <FieldRow label={m.friend_links_site_info_avatar()}>
                {siteInfo.avatar}
              </FieldRow>
            )}
            {siteInfo.email && (
              <FieldRow label={m.friend_links_site_info_email()}>
                <a
                  href={`mailto:${siteInfo.email}`}
                  className="text-muted-foreground hover:text-foreground transition-colors underline decoration-border/50 underline-offset-4"
                >
                  {siteInfo.email}
                </a>
              </FieldRow>
            )}
          </dl>
        </div>
      </section>

      {/* 申请须知 */}
      <section className="space-y-4">
        <h2 className="text-sm font-serif font-medium tracking-tight text-foreground">
          {m.friend_links_apply_rules_title()}
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
                  className="text-sm leading-relaxed text-muted-foreground [&_p]:my-0 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_a]:underline [&_a]:decoration-foreground/30 [&_a:hover]:decoration-foreground"
                  dangerouslySetInnerHTML={{
                    __html: renderMarkdownToHtml(rule.content),
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <dt className="w-12 shrink-0 text-[11px] font-mono uppercase tracking-widest text-muted-foreground/60 pt-0.5">
        {label}
      </dt>
      <dd className="min-w-0 text-sm text-muted-foreground leading-relaxed break-words">
        {children}
      </dd>
    </div>
  );
}

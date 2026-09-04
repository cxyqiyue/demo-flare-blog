import { renderMarkdownToHtml } from "@/features/about/utils/markdown";
import type { FriendLinksConfig } from "@/features/config/config.schema";
import { m } from "@/paraglide/messages";

interface SiteInfoAndApplyRulesProps {
  siteInfo: NonNullable<FriendLinksConfig["siteInfo"]>;
  applyRules: Array<{ id: string; content: string }>;
}

/**
 * 友链「本站信息 + 申请须知」表格区块（左右两栏）。
 * - 左栏「本站信息」：名称 / 地址 / 描述 / 头像 / 邮箱，逐行展示全部字段，方便访客主动添加本站为友链。
 * - 右栏「申请须知」：最多 5 条 Markdown 文本，逐行渲染。
 * - 每行之间用下划线（border-b）隔断，行内保留上下留白，使下划线不紧挨文本；
 *   最外层不显示四边框线，仅保留行分隔线。
 */
export function SiteInfoAndApplyRules({
  siteInfo,
  applyRules,
}: SiteInfoAndApplyRulesProps) {
  const visibleRules = applyRules.filter((rule) => rule.content.trim() !== "");

  return (
    <div className="w-full grid grid-cols-1 md:grid-cols-2">
      {/* 左栏：本站信息 */}
      <section className="pr-0 md:pr-10">
        {/* 列标题行 */}
        <div className="py-3 border-b border-border/40">
          <h2 className="text-sm font-serif font-medium tracking-tight text-foreground">
            {m.friend_links_site_info_title()}
          </h2>
        </div>

        {/* 名称 */}
        {siteInfo.name && (
          <div className="py-3 border-b border-border/40">
            <dt className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground/60">
              {m.friend_links_site_info_name()}
            </dt>
            <dd className="mt-1.5 min-w-0">
              <span className="flex items-center gap-3">
                {siteInfo.avatar && (
                  <img
                    src={siteInfo.avatar}
                    alt={siteInfo.name}
                    className="w-9 h-9 shrink-0 object-cover rounded-md border border-border/40"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                )}
                <span className="font-serif text-lg font-medium text-foreground tracking-tight break-words">
                  {siteInfo.name}
                </span>
              </span>
            </dd>
          </div>
        )}

        {/* 地址 */}
        {siteInfo.url && (
          <div className="py-3 border-b border-border/40">
            <dt className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground/60">
              {m.friend_links_site_info_url()}
            </dt>
            <dd className="mt-1.5 min-w-0">
              <a
                href={siteInfo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors break-all"
              >
                {siteInfo.url}
              </a>
            </dd>
          </div>
        )}

        {/* 描述 */}
        {siteInfo.description && (
          <div className="py-3 border-b border-border/40">
            <dt className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground/60">
              {m.friend_links_site_info_desc()}
            </dt>
            <dd className="mt-1.5 min-w-0 text-sm text-muted-foreground leading-relaxed [&_p]:my-0 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_a]:underline [&_a]:decoration-foreground/30 [&_a:hover]:decoration-foreground"
              dangerouslySetInnerHTML={{
                __html: renderMarkdownToHtml(siteInfo.description),
              }}
            />
          </div>
        )}

        {/* 头像 */}
        {siteInfo.avatar && (
          <div className="py-3 border-b border-border/40">
            <dt className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground/60">
              {m.friend_links_site_info_avatar()}
            </dt>
            <dd className="mt-1.5 min-w-0">
              <span className="text-sm text-muted-foreground break-all">
                {siteInfo.avatar}
              </span>
            </dd>
          </div>
        )}

        {/* 邮箱 */}
        <div className="py-3 border-b border-border/40 last:border-b-0">
          {siteInfo.email ? (
            <>
              <dt className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground/60">
                {m.friend_links_site_info_email()}
              </dt>
              <dd className="mt-1.5 min-w-0">
                <a
                  href={`mailto:${siteInfo.email}`}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors break-all"
                >
                  {siteInfo.email}
                </a>
              </dd>
            </>
          ) : (
            <dt className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground/60">
              {m.friend_links_site_info_email()}
            </dt>
          )}
        </div>
      </section>

      {/* 右栏：申请须知 */}
      <section className="pl-0 md:pl-10">
        {/* 列标题行 */}
        <div className="py-3 border-b border-border/40">
          <h2 className="text-sm font-serif font-medium tracking-tight text-foreground">
            {m.friend_links_apply_rules_title()}
          </h2>
        </div>

        {visibleRules.length === 0 ? (
          <div className="py-3 border-b border-border/40">
            <p className="text-sm text-muted-foreground/60 font-serif italic">
              {m.friend_links_apply_rules_empty()}
            </p>
          </div>
        ) : (
          visibleRules.map((rule, index) => (
            <div
              key={rule.id || index}
              className="py-3 border-b border-border/40 flex gap-3"
            >
              <span className="w-5 shrink-0 pt-px text-right font-mono text-xs text-muted-foreground/50">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div
                className="min-w-0 text-sm leading-relaxed text-muted-foreground [&_p]:my-0 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_a]:underline [&_a]:decoration-foreground/30 [&_a:hover]:decoration-foreground"
                dangerouslySetInnerHTML={{
                  __html: renderMarkdownToHtml(rule.content),
                }}
              />
            </div>
          ))
        )}
      </section>
    </div>
  );
}

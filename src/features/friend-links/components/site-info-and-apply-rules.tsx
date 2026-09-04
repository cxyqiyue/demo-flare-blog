import { renderMarkdownToHtml } from "@/features/about/utils/markdown";
import type { FriendLinksConfig } from "@/features/config/config.schema";
import { m } from "@/paraglide/messages";

interface SiteInfoAndApplyRulesProps {
  siteInfo: NonNullable<FriendLinksConfig["siteInfo"]>;
  applyRules: Array<{ id: string; content: string }>;
}

/**
 * 友链「本站信息 + 申请须知」表格区块（三列、五行一一对应）。
 *
 * 布局（渲染后不显示最外层四边框线，仅保留行间下划线，且下划线不紧贴文本）：
 *
 * | 本站信息        |  申请须知  |
 * | 名称   | 值      | 1、…    |
 * | 地址   | 值      | 2、…    |
 * | 描述   | 值      | 3、…    |
 * | 头像   | 值      | 4、…    |
 * | 邮箱   | 值      | 5、…    |
 *
 * 样式统一使用前台主题排版（font-serif / font-mono / text-foreground / text-muted-foreground / border-border）。
 */
export function SiteInfoAndApplyRules({
  siteInfo,
  applyRules,
}: SiteInfoAndApplyRulesProps) {
  const visibleRules = applyRules.filter((rule) => rule.content.trim() !== "");

  const rows: Array<{
    label: string;
    value?: string;
    markdown?: boolean;
    href?: string;
    email?: boolean;
  }> = [
    { label: m.friend_links_site_info_name(), value: siteInfo.name },
    { label: m.friend_links_site_info_url(), value: siteInfo.url || undefined, href: siteInfo.url || undefined },
    { label: m.friend_links_site_info_desc(), value: siteInfo.description || undefined, markdown: true },
    { label: m.friend_links_site_info_avatar(), value: siteInfo.avatar || undefined, href: siteInfo.avatar || undefined },
    { label: m.friend_links_site_info_email(), value: siteInfo.email || undefined, email: true },
  ];

  return (
    <table className="w-full table-fixed border-collapse">
      <thead>
        <tr>
          <th
            colSpan={2}
            scope="colgroup"
            className="py-3 pr-4 text-left font-serif font-medium tracking-tight text-foreground border-b border-border/40"
          >
            {m.friend_links_site_info_title()}
          </th>
          <th
            scope="col"
            className="py-3 pl-4 text-left font-serif font-medium tracking-tight text-foreground border-b border-border/40"
          >
            {m.friend_links_apply_rules_title()}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => {
          const rule = visibleRules[index];
          return (
            <tr key={row.label}>
              {/* 字段标签 */}
              <td className="w-[28%] py-3 pr-4 align-top border-b border-border/40">
                <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">
                  {row.label}
                </span>
              </td>

              {/* 本站信息值（同一行，不放头像图像） */}
              <td className="w-[22%] py-3 pr-4 align-top border-b border-border/40">
                {row.markdown ? (
                  <div
                    className="text-sm leading-relaxed text-foreground [&_p]:my-0 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_a]:underline [&_a]:decoration-foreground/30 [&_a:hover]:decoration-foreground"
                    dangerouslySetInnerHTML={{
                      __html: renderMarkdownToHtml(row.value ?? ""),
                    }}
                  />
                ) : row.email ? (
                  row.value ? (
                    <a
                      href={`mailto:${row.value}`}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors break-all"
                    >
                      {row.value}
                    </a>
                  ) : null
                ) : row.href ? (
                  row.value ? (
                    <a
                      href={row.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors break-all"
                    >
                      {row.value}
                    </a>
                  ) : null
                ) : row.value ? (
                  <span className="text-sm text-foreground break-all">
                    {row.value}
                  </span>
                ) : null}
              </td>

              {/* 申请须知（与本站信息字段同一行） */}
              <td className="w-[50%] py-3 pl-4 align-top border-b border-border/40">
                {rule ? (
                  <div className="flex gap-2">
                    <span className="w-4 shrink-0 text-right font-mono text-xs text-muted-foreground/50 leading-6">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div
                      className="min-w-0 text-sm leading-relaxed text-muted-foreground [&_p]:my-0 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_a]:underline [&_a]:decoration-foreground/30 [&_a:hover]:decoration-foreground"
                      dangerouslySetInnerHTML={{
                        __html: renderMarkdownToHtml(rule.content),
                      }}
                    />
                  </div>
                ) : null}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

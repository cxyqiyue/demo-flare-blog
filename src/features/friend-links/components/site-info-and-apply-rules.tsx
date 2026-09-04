import { renderMarkdownToHtml } from "@/features/about/utils/markdown";
import type { FriendLinksConfig } from "@/features/config/config.schema";
import { m } from "@/paraglide/messages";

interface SiteInfoAndApplyRulesProps {
  siteInfo: NonNullable<FriendLinksConfig["siteInfo"]>;
  applyRules: Array<{ id: string; content: string }>;
}

interface ThemeStyles {
  header: string;
  siteInfoCell: string;
  ruleIndex: string;
  valueLink: string;
  valueText: string;
  markdown: (color: string) => string;
  divider: string;
}

function getThemeStyles(): ThemeStyles {
  switch (__THEME_NAME__) {
    case "fuwari":
      return {
        header:
          "py-3 text-left font-bold text-base tracking-tight fuwari-text-90",
        siteInfoCell:
          "text-sm font-medium fuwari-text-75 break-all",
        ruleIndex: "w-4 shrink-0 text-right font-bold text-xs fuwari-text-30 leading-6",
        valueLink:
          "text-sm font-medium fuwari-text-50 hover:text-(--fuwari-primary) transition-colors break-all no-underline",
        valueText: "text-sm font-medium fuwari-text-75 break-all",
        markdown: (color) =>
          `text-sm font-medium leading-relaxed ${color} [&_p]:my-0 [&_p]:inline [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_a]:text-(--fuwari-primary) [&_a]:no-underline`,

        divider: "border-b border-(--fuwari-meta-divider)",
      };
    case "default":
    default:
      return {
        header:
          "py-3 text-left font-serif font-medium tracking-tight text-foreground text-base",
        siteInfoCell: "text-sm text-foreground break-all",
        ruleIndex: "w-4 shrink-0 text-right font-mono text-xs text-muted-foreground/50 leading-6",
        valueLink:
          "text-sm text-muted-foreground hover:text-foreground transition-colors break-all no-underline",
        valueText: "text-sm text-foreground break-all",
        markdown: (color) =>
          `text-sm leading-relaxed ${color} [&_p]:my-0 [&_p]:inline [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_a]:no-underline [&_a:hover]:underline`,

        divider: "border-b border-border/40",
      };
  }
}

/**
 * 友链「本站信息 + 申请须知」区块，单个表格、两列、五行，头尾对齐。
 *
 * | 本站信息 | 申请须知 |
 * | 名称：***** | 1、****** |
 * | 地址：***** | 2、****** |
 * | 描述：***** | 3、****** |
 * | 头像：***** | 4、****** |
 * | 邮箱：***** | 5、****** |
 *
 * 样式按当前主题（__THEME_NAME__）拆分：default 用编辑风格
 * （font-serif / font-mono / text-muted-foreground / border-border），
 * fuwari 用 fuwari 令牌（font-bold / fuwari-text-* / --fuwari-meta-divider）。
 */
export function SiteInfoAndApplyRules({
  siteInfo,
  applyRules,
}: SiteInfoAndApplyRulesProps) {
  const visibleRules = applyRules.filter((rule) => rule.content.trim() !== "");
  const styles = getThemeStyles();

  const rows: Array<{
    label: string;
    value?: string;
    markdown?: boolean;
    href?: string;
    email?: boolean;
  }> = [
    { label: m.friend_links_site_info_name(), value: siteInfo.name },
    {
      label: m.friend_links_site_info_url(),
      value: siteInfo.url || undefined,
      href: siteInfo.url || undefined,
    },
    {
      label: m.friend_links_site_info_desc(),
      value: siteInfo.description || undefined,
      markdown: true,
    },
    {
      label: m.friend_links_site_info_avatar(),
      value: siteInfo.avatar || undefined,
      href: siteInfo.avatar || undefined,
    },
    {
      label: m.friend_links_site_info_email(),
      value: siteInfo.email || undefined,
      email: true,
    },
  ];

  const valueMarkdownColor =
    __THEME_NAME__ === "fuwari" ? "fuwari-text-75" : "text-foreground";

  return (
    <table className="w-full table-fixed border-collapse">
      <thead>
        <tr>
          <th scope="col" className={`${styles.header} ${styles.divider}`}>
            {m.friend_links_site_info_title()}
          </th>
          <th scope="col" className={`${styles.header} ${styles.divider}`}>
            {m.friend_links_apply_rules_title()}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => {
          const rule = visibleRules[index];
          return (
            <tr key={row.label}>
              {/* 本站信息：标签 名称：值 在同一格 */}
              <td className={`w-1/2 py-3 align-top ${styles.divider}`}>
                <span className={styles.siteInfoCell}>
                  {row.label}
                  {row.value ? "：" : ""}
                </span>
                {row.markdown ? (
                  <span
                    className={styles.markdown(valueMarkdownColor)}
                    dangerouslySetInnerHTML={{
                      __html: renderMarkdownToHtml(" " + (row.value ?? "")),
                    }}
                  />
                ) : row.email ? (
                  row.value ? (
                    <a
                      href={`mailto:${row.value}`}
                      className={styles.valueLink}
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
                      className={styles.valueLink}
                    >
                      {row.value}
                    </a>
                  ) : null
                ) : row.value ? (
                  <span className={styles.valueText}>{row.value}</span>
                ) : null}
              </td>

              {/* 申请须知 */}
              <td className={`w-1/2 py-3 align-top ${styles.divider}`}>
                {rule ? (
                  <div className="flex gap-2">
                    <span className={styles.ruleIndex}>
                      {index + 1}、
                    </span>
                    <div
                      className={styles.siteInfoCell}
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

import {
  thresholdForService,
  type CfServiceUsage,
} from "@/features/cloudflare-usage/cloudflare-usage.schema";

// ── Cloudflare 用量告警：纯逻辑（阈值比对 / 去重 / 内容渲染） ──
// 独立于服务模块，便于在 Node 测试环境中单测（不引入 Workers 专有依赖）。

export interface CfAlertRow {
  service: string;
  displayName: string;
  metric: string;
  used: number;
  limit: number;
  unit: string;
  percentage: number;
  threshold: number;
}

export type CfAlertLevel = "threshold" | "exhausted";

export interface CfAlertStateEntry {
  day: string;
  level: CfAlertLevel;
}

export type CfAlertState = Record<string, CfAlertStateEntry>;

function alertLevelOf(row: CfAlertRow): CfAlertLevel {
  return row.percentage >= 100 ? "exhausted" : "threshold";
}

const LEVEL_ORDER: Record<CfAlertLevel, number> = {
  threshold: 1,
  exhausted: 2,
};

/** 找出当前超阈值的服务 */
export function computeAlertRows(
  services: CfServiceUsage[],
  thresholds:
    | Parameters<typeof thresholdForService>[0]
    | undefined,
): CfAlertRow[] {
  const alerts: CfAlertRow[] = [];
  for (const svc of services) {
    if (svc.error) continue; // 查询失败的服务不参与告警（数据不可信）
    const threshold = thresholdForService(thresholds, svc.service);
    if (threshold !== undefined && svc.percentage >= threshold) {
      alerts.push({
        service: svc.service,
        displayName: svc.displayName,
        metric: svc.billingMetric ?? svc.service,
        used: svc.used,
        limit: svc.limit,
        unit: svc.unit,
        percentage: svc.percentage,
        threshold,
      });
    }
  }
  return alerts;
}

/**
 * 纯函数：结合去重状态计算本次应发送的告警与下一份状态。
 */
export function resolveAlertsToSend(
  alerts: CfAlertRow[],
  state: CfAlertState | null,
  day: string,
): { toSend: CfAlertRow[]; nextState: CfAlertState } {
  const prevState = state ?? {};
  const toSend: CfAlertRow[] = [];

  for (const row of alerts) {
    const level = alertLevelOf(row);
    const entry = prevState[row.service];
    const alreadySentToday = entry?.day === day;
    if (!alreadySentToday || LEVEL_ORDER[level] > LEVEL_ORDER[entry.level]) {
      toSend.push(row);
    }
  }

  // 保留当日已发记录（避免回落后反复重发），清理过期日期
  const nextState: CfAlertState = {};
  for (const [service, entry] of Object.entries(prevState)) {
    if (entry.day === day) nextState[service] = entry;
  }
  for (const row of toSend) {
    nextState[row.service] = { day, level: alertLevelOf(row) };
  }

  return { toSend, nextState };
}

// ── 内容渲染（跟随管理员语言，内联 zh/en 与 api 测试函数同风格） ──

function formatValue(used: number, unit: string): string {
  if (unit.includes("bytes")) {
    const units = ["B", "KB", "MB", "GB", "TB"];
    if (used === 0) return "0 B";
    const i = Math.floor(Math.log(used) / Math.log(1024));
    return `${(used / 1024 ** i).toFixed(2)} ${units[i]}`;
  }
  if (used >= 1_000_000) return `${(used / 1_000_000).toFixed(2)}M`;
  if (used >= 1_000) return `${(used / 1_000).toFixed(1)}K`;
  return String(used);
}

export function renderUsageAlertContent(
  locale: "zh" | "en",
  alerts: CfAlertRow[],
): { subject: string; message: string; html: string } {
  const rows = alerts
    .map(
      (a) =>
        `${a.displayName} · ${a.metric}: ${formatValue(a.used, a.unit)} / ${formatValue(a.limit, a.unit)} (${a.percentage.toFixed(1)}% ≥ ${a.threshold}%)`,
    )
    .join("\n");

  if (locale === "zh") {
    const subject = `[Cloudflare 用量告警] ${alerts.length} 项服务超过阈值`;
    const message = `以下 Cloudflare 服务今日用量已达到设定阈值：\n${rows}\n请前往后台「Cloudflare 用量概览」查看详情。`;
    const html = `<h2 style="margin:0 0 12px">Cloudflare 用量告警</h2><p>以下服务今日用量已达到设定阈值：</p><ul>${alerts.map((a) => `<li><b>${a.displayName}</b>（${a.metric}）：${formatValue(a.used, a.unit)} / ${formatValue(a.limit, a.unit)}（${a.percentage.toFixed(1)}%，阈值 ${a.threshold}%）</li>`).join("")}</ul><p style="color:#888">请前往后台「Cloudflare 用量概览」查看详情。</p>`;
    return { subject, message, html };
  }

  const subject = `[Cloudflare Usage Alert] ${alerts.length} service(s) over threshold`;
  const message = `The following Cloudflare services reached their configured thresholds today:\n${rows}\nVisit the admin dashboard for details.`;
  const html = `<h2 style="margin:0 0 12px">Cloudflare Usage Alert</h2><p>The following services reached their configured thresholds today:</p><ul>${alerts.map((a) => `<li><b>${a.displayName}</b> (${a.metric}): ${formatValue(a.used, a.unit)} / ${formatValue(a.limit, a.unit)} (${a.percentage.toFixed(1)}%, threshold ${a.threshold}%)</li>`).join("")}</ul><p style="color:#888">Visit the admin dashboard for details.</p>`;
  return { subject, message, html };
}

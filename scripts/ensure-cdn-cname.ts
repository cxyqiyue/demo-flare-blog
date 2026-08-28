import { getDomain } from "tldts";
import { normalizeHostname } from "./prepare-wrangler-config";

const CF_API_BASE = "https://api.cloudflare.com/client/v4";

/**
 * 维护博客域名(DOMAIN) 到优选域名(CDN_DOMAIN) 的 CNAME 记录（仅 DNS / 灰云）。
 *
 * - 幂等：记录已存在且正确（content=CDN_DOMAIN, proxied=false）时不做任何改动。
 * - 记录已存在但指向不同或为橙色云时执行更新。
 * - 同名存在非 CNAME 记录时不覆盖、不删除，仅告警提示手动处理。
 * - 任何 API 失败都只告警、不阻断部署，并提示部署成功后手动添加 CNAME。
 *
 * 意图：配合 Cloudflare 优选域名使用。博客域名通过灰云 CNAME 指向优选域名，
 * Worker route（routes 模式）仍能基于 Host 正常命中。
 */

function normalizeDomain(input: string | undefined): string {
  const value = input?.trim();
  if (!value) return "";
  return normalizeHostname(value).toLowerCase();
}

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function resolveCloudflareZoneId(options: {
  fetchImpl: typeof fetch;
  apiToken: string;
  domain: string;
  zoneIdHint?: string;
}): Promise<string | null> {
  const { fetchImpl, apiToken, domain, zoneIdHint } = options;
  if (zoneIdHint?.trim()) return zoneIdHint.trim();

  // 优先按注册域精确查找 zone
  const zoneName = getDomain(domain) ?? domain;
  const byName = await fetchImpl(
    `${CF_API_BASE}/zones?name=${encodeURIComponent(zoneName)}`,
    { headers: authHeaders(apiToken) },
  );
  const nameBody = (await parseJson(byName)) as {
    result?: Array<{ id?: string }>;
  } | null;
  if (nameBody?.result?.[0]?.id) return nameBody.result[0].id;

  // 未命中时扫描账号下 active zones，支持子域独立 zone（取最长匹配）
  const list = await fetchImpl(
    `${CF_API_BASE}/zones?status=active&per_page=50`,
    { headers: authHeaders(apiToken) },
  );
  const body = (await parseJson(list)) as {
    result?: Array<{ id?: string; name?: string }>;
  } | null;
  const zones = body?.result ?? [];
  const match = zones
    .filter((zone) => {
      const name = zone.name;
      return name != null && (domain === name || domain.endsWith(`.${name}`));
    })
    .sort((a, b) => (b.name?.length ?? 0) - (a.name?.length ?? 0))[0];
  return match?.id ?? null;
}

export type CdnCnameStatus =
  | "skipped"
  | "noop"
  | "created"
  | "updated"
  | "warning";

export interface CdnCnameOptions {
  apiToken?: string;
  zoneId?: string;
  domain?: string;
  cdnDomain?: string;
  fetchImpl?: typeof fetch;
}

export interface CdnCnameResult {
  status: CdnCnameStatus;
  message: string;
  recordId?: string;
}

type CnameRecord = {
  id?: string;
  type?: string;
  name?: string;
  content?: string;
  proxied?: boolean;
};

const MANUAL_HINT = (domain: string, cdnDomain: string) =>
  `请在部署成功后手动添加 CNAME：${domain} CNAME -> ${cdnDomain}（仅 DNS / 关闭小黄云）。`;

export async function ensureCdnCname(
  options: CdnCnameOptions,
): Promise<CdnCnameResult> {
  const domain = normalizeDomain(options.domain);
  const cdnDomain = normalizeDomain(options.cdnDomain);
  const apiToken = options.apiToken?.trim() ?? "";
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;

  if (!apiToken) {
    return {
      status: "skipped",
      message: "CLOUDFLARE_API_TOKEN 未配置，跳过 DNS 记录维护。",
    };
  }
  if (!domain) {
    return {
      status: "skipped",
      message: "DOMAIN 未配置（纯 workers.dev 部署），跳过 DNS 记录维护。",
    };
  }
  if (!cdnDomain) {
    return {
      status: "skipped",
      message: "CDN_DOMAIN 未配置，跳过 DNS 记录创建。",
    };
  }
  if (cdnDomain === domain) {
    return {
      status: "skipped",
      message: "CDN_DOMAIN 与 DOMAIN 相同，无需创建 CNAME。",
    };
  }
  if (/\.workers\.dev$/i.test(domain)) {
    return {
      status: "skipped",
      message: `${domain} 为 workers.dev 部署，跳过 DNS 记录创建。`,
    };
  }

  const zoneId = await resolveCloudflareZoneId({
    fetchImpl,
    apiToken,
    domain,
    zoneIdHint: options.zoneId,
  });
  if (!zoneId) {
    return {
      status: "warning",
      message: `无法解析 ${domain} 所属的 Cloudflare Zone。请配置 CLOUDFLARE_ZONE_ID 仓库 Secret，或${MANUAL_HINT(domain, cdnDomain)}`,
    };
  }

  const collection = `${CF_API_BASE}/zones/${zoneId}/dns_records`;

  const listRes = await fetchImpl(
    `${collection}?name=${encodeURIComponent(domain)}&per_page=100`,
    { headers: authHeaders(apiToken) },
  );
  if (!listRes.ok) {
    return {
      status: "warning",
      message: `查询 DNS 记录失败 (${listRes.status})：${await listRes.text()}。请检查 CLOUDFLARE_API_TOKEN 是否具备 Zone->DNS->Edit 权限，或${MANUAL_HINT(domain, cdnDomain)}`,
    };
  }
  const listBody = (await parseJson(listRes)) as { result?: unknown } | null;
  const records = Array.isArray(listBody?.result)
    ? (listBody?.result as CnameRecord[])
    : [];
  const sameName = records.filter(
    (record) => record.name === domain || record.name === `${domain}.`,
  );
  const cname = sameName.find((record) => record.type === "CNAME");

  const writeBody = JSON.stringify({
    type: "CNAME",
    name: domain,
    content: cdnDomain,
    proxied: false,
    ttl: 1,
  });

  if (cname) {
    if (cname.content === cdnDomain && cname.proxied === false) {
      return {
        status: "noop",
        message: `DNS 记录已存在且正确：${domain} CNAME -> ${cdnDomain}（仅 DNS），无需改动。`,
        recordId: cname.id,
      };
    }

    const updateRes = await fetchImpl(`${collection}/${cname.id}`, {
      method: "PUT",
      headers: authHeaders(apiToken),
      body: writeBody,
    });
    if (!updateRes.ok) {
      return {
        status: "warning",
        message: `更新 CNAME 失败 (${updateRes.status})：${await updateRes.text()}。请手动将 ${domain} 的 CNAME 改为指向 ${cdnDomain}（仅 DNS），或授权 CLOUDFLARE_API_TOKEN 的 Zone->DNS->Edit 权限。`,
      };
    }
    return {
      status: "updated",
      message: `已更新 CNAME：${domain} -> ${cdnDomain}（仅 DNS）。`,
      recordId: cname.id,
    };
  }

  const nonCname = sameName.filter((record) => record.type !== "CNAME");
  if (nonCname.length > 0) {
    const types = nonCname.map((record) => record.type).join(", ");
    return {
      status: "warning",
      message: `${domain} 已存在非 CNAME 记录 (${types})，为避免影响解析未自动创建 CNAME。请手动处理：${MANUAL_HINT(domain, cdnDomain)}`,
    };
  }

  const createRes = await fetchImpl(collection, {
    method: "POST",
    headers: authHeaders(apiToken),
    body: writeBody,
  });
  if (!createRes.ok) {
    return {
      status: "warning",
      message: `创建 CNAME 失败 (${createRes.status})：${await createRes.text()}。请检查 CLOUDFLARE_API_TOKEN 是否具备 Zone->DNS->Edit 权限，或${MANUAL_HINT(domain, cdnDomain)}`,
    };
  }
  const createBody = (await parseJson(createRes)) as {
    result?: { id?: string };
  } | null;
  return {
    status: "created",
    message: `已创建 CNAME：${domain} -> ${cdnDomain}（仅 DNS）。`,
    recordId: createBody?.result?.id,
  };
}

if (import.meta.main) {
  const result = await ensureCdnCname({
    apiToken: process.env.CLOUDFLARE_API_TOKEN,
    zoneId: process.env.CLOUDFLARE_ZONE_ID,
    domain: process.env.DOMAIN,
    cdnDomain: process.env.CDN_DOMAIN,
  });

  const prefix =
    result.status === "warning" ? "[CDN CNAME] WARNING:" : "[CDN CNAME]";
  const sink = result.status === "warning" ? console.warn : console.log;
  sink(`${prefix} ${result.message}`);
}

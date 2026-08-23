import { serverEnv } from "@/lib/env/server.env";
import { isNotInProduction } from "@/lib/env/server.env";
import type { CfService } from "@/features/cloudflare-usage/cloudflare-usage.schema";

// ── Cloudflare GraphQL Analytics API Client ─────────────────
// API: https://api.cloudflare.com/client/v4/graphql
// Permission: Account > Account Analytics > Read
// Rate limit: 320 queries / 5 min (free)
//
// 数据集名称与字段以官方 GraphQL Analytics API 为准（2026-08 核对）：
// - D1            → d1AnalyticsAdaptiveGroups.sum.rowsRead
// - R2 存量       → r2StorageAdaptiveGroups.max.payloadSize（datetime 维度，取最新）
// - KV 读/写      → kvOperationsAdaptiveGroups.sum.requests + actionType 过滤
// - KV 存量       → kvStorageAdaptiveGroups.max.byteCount（取最新日期）
// - Queues        → queueMessageOperationsAdaptiveGroups.sum.billableOperations
// - Workflows     → workflowsAdaptiveGroups.count（eventType=WORKFLOW_START）
// - Workers AI    → aiInferenceAdaptiveGroups.sum.totalNeurons
// - DO            → durableObjectsInvocationsAdaptiveGroups.sum.requests
// ⚠️ 此前使用的不存在数据集（d1OperationsAdaptiveGroups、
//   queuesInvocationsAdaptiveGroups 等）会导致查询报错且被吞掉，
//   各服务用量恒为 0——修改数据集名时务必逐个在真实账号上验证。
// ─────────────────────────────────────────────────────────────

const GRAPHQL_ENDPOINT = "https://api.cloudflare.com/client/v4/graphql";

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

// ── Workers Invocations Subtotal (requests) ──────────────────
const WORKERS_REQUESTS_QUERY = `
query WorkersRequests($accountTag: String!, $start: Date!, $end: Date!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      workersInvocationsAdaptive(
        filter: { date_geq: $start, date_leq: $end }
        limit: 1000
      ) {
        sum {
          requests
        }
      }
    }
  }
}`;

// ── D1 Rows Read ─────────────────────────────────────────────
const D1_ROWS_READ_QUERY = `
query D1RowsRead($accountTag: String!, $start: Date!, $end: Date!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      d1AnalyticsAdaptiveGroups(
        filter: { date_geq: $start, date_leq: $end }
        limit: 1000
      ) {
        sum {
          rowsRead
        }
      }
    }
  }
}`;

// ── R2 Storage（存量指标：取最新时点，不做累计） ─────────────
const R2_STORAGE_QUERY = `
query R2Storage($accountTag: String!, $start: DateTime!, $end: DateTime!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      r2StorageAdaptiveGroups(
        filter: { datetime_geq: $start, datetime_leq: $end }
        limit: 1000
      ) {
        dimensions {
          datetime
        }
        max {
          payloadSize
        }
      }
    }
  }
}`;

// ── KV Reads ─────────────────────────────────────────────────
const KV_READS_QUERY = `
query KvReads($accountTag: String!, $start: Date!, $end: Date!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      kvOperationsAdaptiveGroups(
        filter: { date_geq: $start, date_leq: $end, actionType: "read" }
        limit: 1000
      ) {
        sum {
          requests
        }
      }
    }
  }
}`;

// ── KV Writes ────────────────────────────────────────────────
const KV_WRITES_QUERY = `
query KvWrites($accountTag: String!, $start: Date!, $end: Date!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      kvOperationsAdaptiveGroups(
        filter: { date_geq: $start, date_leq: $end, actionType: "write" }
        limit: 1000
      ) {
        sum {
          requests
        }
      }
    }
  }
}`;

// ── KV Storage（存量指标：取最新一天，不做累计） ─────────────
const KV_STORAGE_QUERY = `
query KvStorage($accountTag: String!, $start: Date!, $end: Date!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      kvStorageAdaptiveGroups(
        filter: { date_geq: $start, date_leq: $end }
        limit: 1000
      ) {
        dimensions {
          date
        }
        max {
          byteCount
        }
      }
    }
  }
}`;

// ── Queues Messages ──────────────────────────────────────────
const QUEUES_MESSAGES_QUERY = `
query QueuesMessages($accountTag: String!, $start: DateTime!, $end: DateTime!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      queueMessageOperationsAdaptiveGroups(
        filter: { datetime_geq: $start, datetime_leq: $end }
        limit: 1000
      ) {
        sum {
          billableOperations
        }
      }
    }
  }
}`;

// ── Workflows Invocations ────────────────────────────────────
const WORKFLOWS_INVOCATIONS_QUERY = `
query WorkflowsInvocations($accountTag: String!, $start: DateTime!, $end: DateTime!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      workflowsAdaptiveGroups(
        filter: {
          datetime_geq: $start
          datetime_leq: $end
          eventType: "WORKFLOW_START"
        }
        limit: 1000
      ) {
        count
      }
    }
  }
}`;

// ── Workers AI ───────────────────────────────────────────────
const WORKERS_AI_QUERY = `
query WorkersAi($accountTag: String!, $start: DateTime!, $end: DateTime!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      aiInferenceAdaptiveGroups(
        filter: { datetime_geq: $start, datetime_leq: $end }
        limit: 1000
      ) {
        sum {
          totalNeurons
        }
      }
    }
  }
}`;

// ── Durable Objects Requests ──────────────────────────────────
const DO_REQUESTS_QUERY = `
query DurableObjectsRequests($accountTag: String!, $start: Date!, $end: Date!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      durableObjectsInvocationsAdaptiveGroups(
        filter: { date_geq: $start, date_leq: $end }
        limit: 1000
      ) {
        sum {
          requests
        }
      }
    }
  }
}`;

function pickNum(obj: unknown, path: string): number {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return 0;
    cur = (cur as Record<string, unknown>)[p];
  }
  return typeof cur === "number" ? cur : 0;
}

/**
 * 累计型指标：把窗口内所有行的 <fieldPath> 相加。
 * fieldPath 是行内完整路径，如 "sum.requests" 或 "count"。
 */
export function extractSumAllRows(
  data: Record<string, unknown>,
  rowsPath: string,
  fieldPath: string,
): number {
  const rows = pickValue(data, rowsPath);
  if (!Array.isArray(rows)) return 0;
  return rows.reduce((total, row) => total + pickNum(row, fieldPath), 0);
}

/**
 * 存量型指标（存储占用等 gauge）：按维度值取最新一行的值，而非累计。
 * dimensionPath 如 "dimensions.date" / "dimensions.datetime"（ISO 值可字典序比较）。
 */
export function extractLatestRow(
  data: Record<string, unknown>,
  rowsPath: string,
  fieldPath: string,
  dimensionPath = "dimensions.date",
): number {
  const rows = pickValue(data, rowsPath);
  if (!Array.isArray(rows) || rows.length === 0) return 0;
  let latestDim = "";
  let value = 0;
  for (const row of rows) {
    const dim = String(pickValue(row, dimensionPath) ?? "");
    if (dim >= latestDim) {
      latestDim = dim;
      value = pickNum(row, fieldPath);
    }
  }
  return value;
}

function pickValue(obj: unknown, path: string): unknown {
  if (!path) return obj;
  let cur: unknown = obj;
  for (const p of path.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

interface ServiceQueryConfig {
  query: string;
  /** true 表示 $start/$end 是 DateTime（含时间），false 表示 Date */
  datetimeVariables: boolean;
  extract: (data: Record<string, unknown>) => number;
}

/** 累计型（窗口内各行求和）的通用 extractor */
function cumulativeExtractor(rowsPath: string, fieldPath: string) {
  return (data: Record<string, unknown>) =>
    extractSumAllRows(data, rowsPath, fieldPath);
}

/** 存量型（取最新维度值）的通用 extractor */
function gaugeExtractor(
  rowsPath: string,
  fieldPath: string,
  dimensionPath = "dimensions.date",
) {
  return (data: Record<string, unknown>) =>
    extractLatestRow(data, rowsPath, fieldPath, dimensionPath);
}

const ACCOUNTS = "viewer.accounts.0";

const SERVICE_QUERIES: Record<CfService, ServiceQueryConfig> = {
  workers: {
    query: WORKERS_REQUESTS_QUERY,
    datetimeVariables: false,
    extract: cumulativeExtractor(
      `${ACCOUNTS}.workersInvocationsAdaptive`,
      "sum.requests",
    ),
  },
  d1: {
    query: D1_ROWS_READ_QUERY,
    datetimeVariables: false,
    extract: cumulativeExtractor(
      `${ACCOUNTS}.d1AnalyticsAdaptiveGroups`,
      "sum.rowsRead",
    ),
  },
  r2: {
    query: R2_STORAGE_QUERY,
    datetimeVariables: true,
    extract: gaugeExtractor(
      `${ACCOUNTS}.r2StorageAdaptiveGroups`,
      "max.payloadSize",
      "dimensions.datetime",
    ),
  },
  kv: {
    query: KV_READS_QUERY,
    datetimeVariables: false,
    extract: cumulativeExtractor(
      `${ACCOUNTS}.kvOperationsAdaptiveGroups`,
      "sum.requests",
    ),
  },
  kvWrites: {
    query: KV_WRITES_QUERY,
    datetimeVariables: false,
    extract: cumulativeExtractor(
      `${ACCOUNTS}.kvOperationsAdaptiveGroups`,
      "sum.requests",
    ),
  },
  kvStorage: {
    query: KV_STORAGE_QUERY,
    datetimeVariables: false,
    extract: gaugeExtractor(`${ACCOUNTS}.kvStorageAdaptiveGroups`, "max.byteCount"),
  },
  queues: {
    query: QUEUES_MESSAGES_QUERY,
    datetimeVariables: true,
    extract: cumulativeExtractor(
      `${ACCOUNTS}.queueMessageOperationsAdaptiveGroups`,
      "sum.billableOperations",
    ),
  },
  workflows: {
    query: WORKFLOWS_INVOCATIONS_QUERY,
    datetimeVariables: true,
    extract: cumulativeExtractor(`${ACCOUNTS}.workflowsAdaptiveGroups`, "count"),
  },
  workersAi: {
    query: WORKERS_AI_QUERY,
    datetimeVariables: true,
    extract: cumulativeExtractor(
      `${ACCOUNTS}.aiInferenceAdaptiveGroups`,
      "sum.totalNeurons",
    ),
  },
  durableObjects: {
    query: DO_REQUESTS_QUERY,
    datetimeVariables: false,
    extract: cumulativeExtractor(
      `${ACCOUNTS}.durableObjectsInvocationsAdaptiveGroups`,
      "sum.requests",
    ),
  },
};

// ── 日期范围计算 ─────────────────────────────────────────────
function getDateRange(period: "today" | "7d" | "30d") {
  const now = new Date();
  const end = now.toISOString().split("T")[0];
  let start: string;

  if (period === "today") {
    start = end;
  } else {
    const days = period === "7d" ? 7 : 30;
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - days);
    start = startDate.toISOString().split("T")[0];
  }

  return {
    start,
    end,
    // 部分数据集只接受 datetime 过滤参数
    startDatetime: `${start}T00:00:00Z`,
    endDatetime: `${end}T23:59:59Z`,
  };
}

// ── GraphQL 查询执行器 ──────────────────────────────────────
async function executeQuery<T>(
  query: string,
  variables: {
    accountTag: string;
    start: string;
    end: string;
  },
  apiToken: string,
): Promise<T> {
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Cloudflare GraphQL API error: ${response.status} ${text.slice(0, 200)}`,
    );
  }

  const result = (await response.json()) as GraphQLResponse<T>;

  if (result.errors?.length) {
    throw new Error(
      `GraphQL errors: ${result.errors.map((e) => e.message).join(", ")}`,
    );
  }

  return result.data as T;
}

// ── 公共 API ─────────────────────────────────────────────────
export interface CfUsageResult {
  service: CfService;
  used: number;
  /** 查询失败原因；存在时 used 无意义，UI 应显示不可用而非 0 */
  error?: string;
}

export async function fetchAllUsage(
  env: Env,
  accountId: string,
  apiToken: string,
  period: "today" | "7d" | "30d" = "30d",
): Promise<Array<CfUsageResult>> {
  if (isNotInProduction(env)) {
    console.log(
      JSON.stringify({
        message: "skip cloudflare analytics in dev/test",
        environment: serverEnv(env).ENVIRONMENT,
      }),
    );
    return [];
  }

  const range = getDateRange(period);

  const results = await Promise.all(
    (Object.keys(SERVICE_QUERIES) as CfService[]).map(async (service) => {
      const config = SERVICE_QUERIES[service];
      try {
        const data = await executeQuery<Record<string, unknown>>(
          config.query,
          {
            accountTag: accountId,
            start: config.datetimeVariables ? range.startDatetime : range.start,
            end: config.datetimeVariables ? range.endDatetime : range.end,
          },
          apiToken,
        );
        const used = config.extract(data);
        return { service, used } satisfies CfUsageResult;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        console.error(
          JSON.stringify({
            message: "failed to fetch cloudflare usage",
            service,
            error: message,
          }),
        );
        return { service, used: 0, error: message } satisfies CfUsageResult;
      }
    }),
  );

  return results;
}

export async function testCloudflareConnection(
  accountId: string,
  apiToken: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const range = getDateRange("today");
    await executeQuery(
      WORKERS_REQUESTS_QUERY,
      { accountTag: accountId, start: range.start, end: range.end },
      apiToken,
    );
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

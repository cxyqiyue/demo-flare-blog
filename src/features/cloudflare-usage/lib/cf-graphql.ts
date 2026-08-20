import { serverEnv } from "@/lib/env/server.env";
import { isNotInProduction } from "@/lib/env/server.env";
import type { CfService } from "@/features/cloudflare-usage/cloudflare-usage.schema";

// ── Cloudflare GraphQL Analytics API Client ─────────────────
// API: https://api.cloudflare.com/client/v4/graphql
// Permission: Account > Account Analytics > Read
// Rate limit: 320 queries / 5 min (free)
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
      d1OperationsAdaptiveGroups(
        filter: { date_geq: $start, date_leq: $end }
        limit: 1000
      ) {
        sum {
          readQueries
        }
      }
    }
  }
}`;

// ── R2 Storage ───────────────────────────────────────────────
const R2_STORAGE_QUERY = `
query R2Storage($accountTag: String!, $start: Date!, $end: Date!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      r2StorageAdaptiveGroups(
        filter: { date_geq: $start, date_leq: $end }
        limit: 1000
      ) {
        sum {
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
        filter: { date_geq: $start, date_leq: $end }
        limit: 1000
      ) {
        sum {
          reads
        }
      }
    }
  }
}`;

// ── Queues Messages ──────────────────────────────────────────
const QUEUES_MESSAGES_QUERY = `
query QueuesMessages($accountTag: String!, $start: Date!, $end: Date!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      queuesInvocationsAdaptiveGroups(
        filter: { date_geq: $start, date_leq: $end }
        limit: 1000
      ) {
        sum {
          messageCount
        }
      }
    }
  }
}`;

// ── Workflows Invocations ────────────────────────────────────
const WORKFLOWS_INVOCATIONS_QUERY = `
query WorkflowsInvocations($accountTag: String!, $start: Date!, $end: Date!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      workflowsInvocationsAdaptiveGroups(
        filter: { date_geq: $start, date_leq: $end }
        limit: 1000
      ) {
        sum {
          invocations
        }
      }
    }
  }
}`;

// ── Workers AI ───────────────────────────────────────────────
const WORKERS_AI_QUERY = `
query WorkersAi($accountTag: String!, $start: Date!, $end: Date!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      workersAiOperationsAdaptiveGroups(
        filter: { date_geq: $start, date_leq: $end }
        limit: 1000
      ) {
        sum {
          neuronCount
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

const SERVICE_QUERIES: Record<
  CfService,
  { query: string; extract: (data: Record<string, unknown>) => number }
> = {
  workers: {
    query: WORKERS_REQUESTS_QUERY,
    extract: (data) =>
      pickNum(
        data,
        "viewer.accounts.0.workersInvocationsAdaptive.0.sum.requests",
      ),
  },
  d1: {
    query: D1_ROWS_READ_QUERY,
    extract: (data) =>
      pickNum(
        data,
        "viewer.accounts.0.d1OperationsAdaptiveGroups.0.sum.readQueries",
      ),
  },
  r2: {
    query: R2_STORAGE_QUERY,
    extract: (data) =>
      pickNum(
        data,
        "viewer.accounts.0.r2StorageAdaptiveGroups.0.sum.payloadSize",
      ),
  },
  kv: {
    query: KV_READS_QUERY,
    extract: (data) =>
      pickNum(data, "viewer.accounts.0.kvOperationsAdaptiveGroups.0.sum.reads"),
  },
  queues: {
    query: QUEUES_MESSAGES_QUERY,
    extract: (data) =>
      pickNum(
        data,
        "viewer.accounts.0.queuesInvocationsAdaptiveGroups.0.sum.messageCount",
      ),
  },
  workflows: {
    query: WORKFLOWS_INVOCATIONS_QUERY,
    extract: (data) =>
      pickNum(
        data,
        "viewer.accounts.0.workflowsInvocationsAdaptiveGroups.0.sum.invocations",
      ),
  },
  workersAi: {
    query: WORKERS_AI_QUERY,
    extract: (data) =>
      pickNum(
        data,
        "viewer.accounts.0.workersAiOperationsAdaptiveGroups.0.sum.neuronCount",
      ),
  },
  durableObjects: {
    query: DO_REQUESTS_QUERY,
    extract: (data) =>
      pickNum(
        data,
        "viewer.accounts.0.durableObjectsInvocationsAdaptiveGroups.0.sum.requests",
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

  return { start, end };
}

// ── GraphQL 查询执行器 ──────────────────────────────────────
async function executeQuery<T>(
  query: string,
  variables: { accountTag: string; start: string; end: string },
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
export async function fetchAllUsage(
  env: Env,
  accountId: string,
  apiToken: string,
  period: "today" | "7d" | "30d" = "30d",
): Promise<Array<{ service: CfService; used: number }>> {
  if (isNotInProduction(env)) {
    console.log(
      JSON.stringify({
        message: "skip cloudflare analytics in dev/test",
        environment: serverEnv(env).ENVIRONMENT,
      }),
    );
    return [];
  }

  const { start, end } = getDateRange(period);
  const variables = { accountTag: accountId, start, end };

  const results = await Promise.all(
    (Object.keys(SERVICE_QUERIES) as CfService[]).map(async (service) => {
      const config = SERVICE_QUERIES[service];
      try {
        const data = await executeQuery<Record<string, unknown>>(
          config.query,
          variables,
          apiToken,
        );
        const used = config.extract(data);
        return { service, used };
      } catch (error) {
        console.error(
          JSON.stringify({
            message: "failed to fetch cloudflare usage",
            service,
            error: String(error),
          }),
        );
        return { service, used: 0 };
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
    const { start, end } = getDateRange("today");
    const variables = { accountTag: accountId, start, end };

    await executeQuery(WORKERS_REQUESTS_QUERY, variables, apiToken);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

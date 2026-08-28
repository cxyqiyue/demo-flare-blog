import { describe, expect, it, vi } from "vitest";
import { ensureCdnCname, resolveCloudflareZoneId } from "./ensure-cdn-cname";

type FetchCall = {
  input: string;
  init?: RequestInit;
};

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 500) {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function createMockFetch(
  handlers: Record<string, (input: string, init?: RequestInit) => Response>,
) {
  const calls: FetchCall[] = [];
  const fetchImpl = vi.fn(
    async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      calls.push({ input: url, init });
      const entry = Object.entries(handlers).find(([key]) =>
        key === "*" ? true : url.includes(key),
      );
      const responder = entry?.[1] ?? handlers["*"];
      if (!responder) throw new Error(`unhandled fetch: ${url}`);
      return responder(url, init);
    },
  );
  return { fetchImpl, calls };
}

function record(id: string, type: string, content: string, proxied?: boolean) {
  return {
    id,
    type,
    name: "blog.example.com",
    content,
    proxied,
  };
}

describe("ensureCdnCname", () => {
  const base = {
    apiToken: "test-token",
    zoneId: "test-zone",
    domain: "blog.example.com",
    cdnDomain: "cdn.optimized.example",
  };

  it("skips when api token is missing", async () => {
    const { fetchImpl } = createMockFetch({ "*": () => jsonResponse({}) });
    const result = await ensureCdnCname({
      ...base,
      apiToken: undefined,
      fetchImpl,
    });
    expect(result.status).toBe("skipped");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("skips when DOMAIN is missing", async () => {
    const { fetchImpl } = createMockFetch({ "*": () => jsonResponse({}) });
    const result = await ensureCdnCname({
      ...base,
      domain: undefined,
      fetchImpl,
    });
    expect(result.status).toBe("skipped");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("skips when CDN_DOMAIN is missing", async () => {
    const { fetchImpl } = createMockFetch({ "*": () => jsonResponse({}) });
    const result = await ensureCdnCname({
      ...base,
      cdnDomain: undefined,
      fetchImpl,
    });
    expect(result.status).toBe("skipped");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("skips when CDN_DOMAIN equals DOMAIN", async () => {
    const { fetchImpl } = createMockFetch({ "*": () => jsonResponse({}) });
    const result = await ensureCdnCname({
      ...base,
      cdnDomain: base.domain,
      fetchImpl,
    });
    expect(result.status).toBe("skipped");
  });

  it("skips for workers.dev-only deployments", async () => {
    const { fetchImpl } = createMockFetch({ "*": () => jsonResponse({}) });
    const result = await ensureCdnCname({
      ...base,
      domain: "blog.workers.dev",
      fetchImpl,
    });
    expect(result.status).toBe("skipped");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("creates a gray-cloud CNAME when no matching record exists", async () => {
    const { fetchImpl, calls } = createMockFetch({
      "/dns_records?": () => jsonResponse({ success: true, result: [] }),
      "*": () => jsonResponse({ success: true, result: { id: "rec-new" } }),
    });

    const result = await ensureCdnCname({ ...base, fetchImpl });

    expect(result.status).toBe("created");
    expect(result.recordId).toBe("rec-new");
    const post = calls.find((c) => c.init?.method === "POST");
    expect(post).toBeDefined();
    const body = JSON.parse(String(post?.init?.body));
    expect(body).toMatchObject({
      type: "CNAME",
      name: "blog.example.com",
      content: "cdn.optimized.example",
      proxied: false,
    });
  });

  it("does nothing when the correct gray-cloud CNAME already exists", async () => {
    const { fetchImpl, calls } = createMockFetch({
      "/dns_records?": () =>
        jsonResponse({
          success: true,
          result: [record("rec-1", "CNAME", "cdn.optimized.example", false)],
        }),
    });

    const result = await ensureCdnCname({ ...base, fetchImpl });

    expect(result.status).toBe("noop");
    expect(
      calls.filter(
        (c) => c.init?.method === "PUT" || c.init?.method === "POST",
      ),
    ).toHaveLength(0);
  });

  it("updates an existing CNAME with wrong target or orange-cloud", async () => {
    const { fetchImpl, calls } = createMockFetch({
      "/dns_records?": () =>
        jsonResponse({
          success: true,
          result: [record("rec-1", "CNAME", "other.example", true)],
        }),
      "/dns_records/rec-1": () =>
        jsonResponse({
          success: true,
          result: record("rec-1", "CNAME", "cdn.optimized.example", false),
        }),
    });

    const result = await ensureCdnCname({ ...base, fetchImpl });

    expect(result.status).toBe("updated");
    const put = calls.find((c) => c.init?.method === "PUT");
    expect(put).toBeDefined();
    const body = JSON.parse(String(put?.init?.body));
    expect(body.proxied).toBe(false);
    expect(body.content).toBe("cdn.optimized.example");
  });

  it("warns, not overwrites, when a non-CNAME record occupies the name", async () => {
    const { fetchImpl, calls } = createMockFetch({
      "/dns_records?": () =>
        jsonResponse({
          success: true,
          result: [record("rec-1", "A", "1.2.3.4")],
        }),
    });

    const result = await ensureCdnCname({ ...base, fetchImpl });

    expect(result.status).toBe("warning");
    expect(result.message).toContain("非 CNAME");
    expect(
      calls.filter(
        (c) => c.init?.method === "POST" || c.init?.method === "PUT",
      ),
    ).toHaveLength(0);
  });

  it("warns when the create API call fails", async () => {
    const { fetchImpl } = createMockFetch({
      "/dns_records?": () => jsonResponse({ success: true, result: [] }),
      "*": () =>
        jsonResponse({ success: false, errors: [{ code: 81058 }] }, false, 403),
    });

    const result = await ensureCdnCname({ ...base, fetchImpl });

    expect(result.status).toBe("warning");
    expect(result.message).toContain("手动添加 CNAME");
  });

  it("warns when the zone cannot be resolved", async () => {
    const { fetchImpl } = createMockFetch({
      "/zones?": () => jsonResponse({ success: true, result: [] }),
      "*": () => jsonResponse({ success: true, result: [] }),
    });

    const result = await ensureCdnCname({
      ...base,
      zoneId: undefined,
      fetchImpl,
    });

    expect(result.status).toBe("warning");
    expect(result.message).toContain("CLOUDFLARE_ZONE_ID");
  });
});

describe("resolveCloudflareZoneId", () => {
  const base = {
    apiToken: "test-token",
    domain: "blog.example.com",
    fetchImpl: async () => jsonResponse({ success: true, result: [] }),
  };

  it("prefers the explicit zone id hint", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ success: true, result: [] }),
    );
    const result = await resolveCloudflareZoneId({
      ...base,
      zoneIdHint: "zone-hint",
      fetchImpl,
    });
    expect(result).toBe("zone-hint");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("resolves the zone by name lookup", async () => {
    const { fetchImpl, calls } = createMockFetch({
      "/zones?name=example.com": () =>
        jsonResponse({ success: true, result: [{ id: "zone-by-name" }] }),
    });
    const result = await resolveCloudflareZoneId({ ...base, fetchImpl });
    expect(result).toBe("zone-by-name");
    expect(calls[0]?.input).toContain("/zones?name=example.com");
  });

  it("scans active zones and picks the most specific suffix match", async () => {
    const { fetchImpl } = createMockFetch({
      "/zones?name=example.com": () =>
        jsonResponse({ success: true, result: [] }),
      "/zones?status=active": () =>
        jsonResponse({
          success: true,
          result: [
            { id: "zone-example", name: "example.com" },
            { id: "zone-blog", name: "blog.example.com" },
          ],
        }),
    });
    const result = await resolveCloudflareZoneId({ ...base, fetchImpl });
    expect(result).toBe("zone-blog");
  });

  it("returns null when no zone matches", async () => {
    const { fetchImpl } = createMockFetch({
      "/zones?name=example.com": () =>
        jsonResponse({ success: true, result: [] }),
      "/zones?status=active": () =>
        jsonResponse({
          success: true,
          result: [{ id: "x", name: "other.com" }],
        }),
    });
    const result = await resolveCloudflareZoneId({ ...base, fetchImpl });
    expect(result).toBeNull();
  });
});

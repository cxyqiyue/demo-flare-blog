import { Hono } from "hono";

const app = new Hono<{ Bindings: Env }>();

const DOMAIN_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/i;

const FAVICON_SOURCES = (domain: string) => [
  `https://${domain}/favicon.ico`,
  `https://icons.duckduckgo.com/ip3/${domain}.ico`,
  `https://www.google.com/s2/favicons?sz=64&domain=${domain}`,
];

/**
 * 导航页 favicon 代理：按顺序尝试多个来源获取站点图标，
 * 网络不可用时自动降级到下一个来源，全部失败返回 404。
 * 浏览器端在 404 时回退为文字占位图标。
 */
app.get("/favicon", async (c) => {
  const domain = (c.req.query("domain") ?? "").trim().toLowerCase();

  if (!domain || domain.length > 253 || !DOMAIN_PATTERN.test(domain)) {
    return c.text("Bad Request", 400);
  }

  for (const source of FAVICON_SOURCES(domain)) {
    try {
      const response = await fetch(source, {
        redirect: "follow",
        cf: { cacheTtl: 86400, cacheEverything: true },
      });

      if (!response.ok) continue;

      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.startsWith("image/")) continue;

      const body = await response.arrayBuffer();
      return new Response(body, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        },
      });
    } catch {
      // try next source
    }
  }

  return c.text("Not Found", 404);
});

export default app;

import { Hono } from "hono";
import * as ConfigService from "@/features/config/service/config.service";
import { getDb } from "@/lib/db";
import { getExecutionContext } from "@/lib/hono/helper";

const app = new Hono<{ Bindings: Env }>();

/**
 * 微信部署验证文件：按配置在网站根目录提供 `/{fileName}` 内容。
 * 仅当请求的文件名与后台配置的验证文件名一致时返回文件内容，否则 404。
 */
app.get("/:fileName{.+\\.txt}", async (c) => {
  const requestedFileName = c.req.param("fileName");

  const config = await ConfigService.getSystemConfig({
    db: getDb(c.env),
    env: c.env,
    executionCtx: getExecutionContext(c),
  });

  const verify = config.wechatVerify;
  const configuredFileName = verify?.fileName?.trim();
  const fileContent = verify?.fileContent;

  if (
    !configuredFileName ||
    !fileContent ||
    configuredFileName !== requestedFileName
  ) {
    return c.text("Not Found", 404);
  }

  return c.text(fileContent, 200, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
  });
});

export default app;

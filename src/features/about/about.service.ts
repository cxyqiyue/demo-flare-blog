import type {
  AboutArticle,
  SaveAboutArticleInput,
} from "@/features/about/about.schema";
import * as AboutRepo from "@/features/about/data/about-article.data";
import { jsonContentToMarkdown } from "@/features/import-export/utils/markdown-serializer";
import * as PostRepo from "@/features/posts/data/posts.data";
import { deletePost as deleteLegacyPost } from "@/features/posts/services/posts.service";
import { ok } from "@/lib/errors";
import { purgeCDNCache } from "@/lib/invalidate";

/** 旧实现将关于页内容保存为 slug=about 的文章，这里用于一次性迁移并清理 */
const LEGACY_ABOUT_SLUG = "about";
const DEFAULT_TITLE = "关于";

/**
 * 一次性迁移：旧版关于页内容以 slug=about 文章存储于 posts 表。
 * 若独立 about_article 表尚无数据，则将其内容转为 Markdown 后迁入，
 * 并删除遗留文章（同时清理其缓存/搜索索引）。
 */
async function migrateLegacyAboutPost(
  context: DbContext & { executionCtx: ExecutionContext; env: Env },
) {
  const existing = await AboutRepo.findAboutArticle(context.db);
  const legacy = await PostRepo.findPostBySlug(context.db, LEGACY_ABOUT_SLUG, {
    publicOnly: false,
  });
  if (!legacy) return;

  try {
    if (!existing) {
      await AboutRepo.insertAboutArticle(context.db, {
        title: legacy.title || DEFAULT_TITLE,
        markdown: legacy.contentJson
          ? jsonContentToMarkdown(legacy.contentJson)
          : "",
      });
    }
    await deleteLegacyPost(context, { id: legacy.id });
  } catch (error) {
    console.error("about: failed to migrate legacy about post", error);
  }
}

export async function getAboutArticle(
  context: DbContext & { executionCtx: ExecutionContext; env: Env },
): Promise<AboutArticle | null> {
  await migrateLegacyAboutPost(context);
  return await AboutRepo.findAboutArticle(context.db);
}

/** 关于页保存后清理公开页面 CDN 缓存，让访客尽快看到新内容 */
async function invalidateAboutCache(
  context: DbContext & { executionCtx: ExecutionContext; env: Env },
) {
  try {
    await purgeCDNCache(context.env, { urls: ["/", "/about"] });
  } catch (error) {
    // CDN 清理失败不影响保存结果（未配置 Purge 凭证时为静默跳过）
    console.error(
      JSON.stringify({
        message: "about cdn purge failed",
        error: String(error),
      }),
    );
  }
}

export async function saveAboutArticle(
  context: DbContext & { executionCtx: ExecutionContext; env: Env },
  data: SaveAboutArticleInput,
) {
  const title = data.title.trim() || DEFAULT_TITLE;
  const markdown = data.markdown;

  const existing = await AboutRepo.findAboutArticle(context.db);
  if (existing) {
    const article = await AboutRepo.updateAboutArticle(
      context.db,
      existing.id,
      {
        title,
        markdown,
      },
    );
    await invalidateAboutCache(context);
    return ok(article);
  }

  // 首次保存：先迁移旧版内容（若本次提交为空则保留迁移结果）
  await migrateLegacyAboutPost(context);
  const seeded = await AboutRepo.findAboutArticle(context.db);
  if (seeded) {
    if (!markdown.trim()) {
      return ok(seeded);
    }
    const article = await AboutRepo.updateAboutArticle(context.db, seeded.id, {
      title,
      markdown,
    });
    await invalidateAboutCache(context);
    return ok(article);
  }

  const article = await AboutRepo.insertAboutArticle(context.db, {
    title,
    markdown,
  });
  await invalidateAboutCache(context);
  return ok(article);
}

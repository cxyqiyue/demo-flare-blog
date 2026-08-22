import { createAdminTestContext, seedUser } from "tests/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CONFIG } from "@/features/config/config.schema";
import * as ConfigRepo from "@/features/config/data/config.data";
import {
  DEFAULT_FFSKY_API_ENDPOINT,
  IMGBB_API_ENDPOINT,
} from "@/features/image-hosting/image-hosting.schema";
import * as ImageHostingService from "@/features/image-hosting/image-hosting.service";
import { extractImageUrlFromMarkdown } from "@/features/image-hosting/utils/extract-image-url";
import { unwrap } from "@/lib/errors";

/**
 * ImageHostingService Tests
 *
 * External provider calls are mocked at the fetch layer. These are integration
 * tests focused on:
 * - Provider selection / fallback logic
 * - Server-side proxy request building (ImgBB + ffsky)
 * - Response URL parsing
 * - Comment image hosting config exposure (no secrets leaked)
 */
describe("ImageHostingService", () => {
  let adminContext: ReturnType<typeof createAdminTestContext>;

  beforeEach(async () => {
    adminContext = createAdminTestContext();
    await seedUser(adminContext.db, adminContext.session.user);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function seedImageHosting(
    imageHosting: Partial<typeof DEFAULT_CONFIG.imageHosting>,
  ) {
    await ConfigRepo.upsertSystemConfig(adminContext.db, {
      ...DEFAULT_CONFIG,
      imageHosting: {
        ...DEFAULT_CONFIG.imageHosting,
        ...imageHosting,
      },
    });
  }

  function makeFile(name = "test-image.png") {
    return new File(["fake image content"], name, { type: "image/png" });
  }

  type FetchMock = ReturnType<
    typeof vi.fn<(url: string, init?: RequestInit) => Promise<Response>>
  >;

  function stubFetch(response: {
    status?: number;
    body?: unknown;
    rawText?: string;
  }) {
    const fetchMock: FetchMock = vi.fn(async () => {
      const status = response.status ?? 200;
      const body =
        response.rawText ??
        (response.body !== undefined ? JSON.stringify(response.body) : "");
      return new Response(body, { status });
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  function captureFormData(fetchMock: FetchMock) {
    const init = fetchMock.mock.calls[0]?.[1];
    return init?.body as FormData | undefined;
  }

  // ============================================
  // 文章上传 (Article Upload via server proxy)
  // ============================================
  describe("uploadForArticle", () => {
    it("should return mode none when no provider is enabled", async () => {
      const fetchMock = stubFetch({
        body: { data: { url: "https://i.ibb.co/x.png" }, success: true },
      });
      await seedImageHosting({
        r2Native: { articleEnabled: false, commentEnabled: false },
      });

      const formData = new FormData();
      formData.append("image", makeFile("article.png"));

      const result = await ImageHostingService.uploadForArticle(
        adminContext,
        formData,
      );

      expect(unwrap(result).mode).toBe("none");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("should upload to imgbb when only imgbb article is enabled", async () => {
      const fetchMock = stubFetch({
        body: { data: { url: "https://i.ibb.co/xyz/file.png" }, success: true },
        status: 200,
      });
      await seedImageHosting({
        apiProviders: [
          {
            id: "imgbb-1",
            name: "ImgBB",
            type: "imgbb",
            apiKey: "imgbb-key",
            articleEnabled: true,
          },
        ],
      });

      const formData = new FormData();
      formData.append("image", makeFile("article.png"));

      const result = await ImageHostingService.uploadForArticle(
        adminContext,
        formData,
      );

      expect(unwrap(result)).toMatchObject({
        mode: "image-hosting",
        provider: "imgbb",
        url: "https://i.ibb.co/xyz/file.png",
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][0]).toBe(IMGBB_API_ENDPOINT);
      const form = captureFormData(fetchMock);
      expect(form?.get("key")).toBe("imgbb-key");
      expect(typeof form?.get("image")).toBe("string");
      expect(form?.get("source")).toBeNull();
    });

    it("should upload to ffsky when only ffsky article is enabled", async () => {
      const fetchMock = stubFetch({
        body: {
          success: { code: 200, message: "ok" },
          image: { url: "https://pic.ffsky.net/u/123/file.png" },
        },
      });
      await seedImageHosting({
        apiProviders: [
          {
            id: "ffsky-1",
            name: "Ffsky",
            type: "ffsky",
            apiKey: "ffsky-key",
            apiEndpoint: DEFAULT_FFSKY_API_ENDPOINT,
            articleEnabled: true,
          },
        ],
      });

      const formData = new FormData();
      formData.append("image", makeFile());

      const result = await ImageHostingService.uploadForArticle(
        adminContext,
        formData,
      );

      expect(unwrap(result)).toMatchObject({
        mode: "image-hosting",
        provider: "ffsky",
        url: "https://pic.ffsky.net/u/123/file.png",
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][0]).toBe(DEFAULT_FFSKY_API_ENDPOINT);
      const form = captureFormData(fetchMock);
      expect(form?.get("key")).toBe("ffsky-key");
      expect(typeof form?.get("source")).toBe("string");
    });

    it("should prefer imgbb when both providers are enabled", async () => {
      const fetchMock = stubFetch({
        body: { data: { url: "https://i.ibb.co/imgbb.png" }, success: true },
      });
      await seedImageHosting({
        apiProviders: [
          {
            id: "imgbb-1",
            name: "ImgBB",
            type: "imgbb",
            apiKey: "imgbb-key",
            articleEnabled: true,
          },
          {
            id: "ffsky-1",
            name: "Ffsky",
            type: "ffsky",
            apiKey: "ffsky-key",
            articleEnabled: true,
          },
        ],
      });

      const formData = new FormData();
      formData.append("image", makeFile());

      const result = await ImageHostingService.uploadForArticle(
        adminContext,
        formData,
      );

      expect(unwrap(result)).toMatchObject({
        mode: "image-hosting",
        provider: "imgbb",
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("should fail over to ffsky when imgbb fails and ffsky is enabled", async () => {
      const fetchMock = vi.fn(async (url: string) => {
        if (url === IMGBB_API_ENDPOINT) {
          return new Response(
            JSON.stringify({
              status_code: 400,
              status_txt: "Invalid key",
              error: { message: "Invalid key" },
            }),
            { status: 200 },
          );
        }
        return new Response(
          JSON.stringify({
            success: { code: 200, message: "ok" },
            image: { url: "https://pic.ffsky.net/u/456/f.png" },
          }),
          { status: 200 },
        );
      });
      vi.stubGlobal("fetch", fetchMock);
      await seedImageHosting({
        apiProviders: [
          {
            id: "imgbb-1",
            name: "ImgBB",
            type: "imgbb",
            apiKey: "imgbb-key",
            articleEnabled: true,
          },
          {
            id: "ffsky-1",
            name: "Ffsky",
            type: "ffsky",
            apiKey: "ffsky-key",
            articleEnabled: true,
          },
        ],
      });

      const formData = new FormData();
      formData.append("image", makeFile());

      const result = await ImageHostingService.uploadForArticle(
        adminContext,
        formData,
      );

      expect(unwrap(result)).toMatchObject({
        mode: "image-hosting",
        provider: "ffsky",
        url: "https://pic.ffsky.net/u/456/f.png",
      });
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls[0][0]).toBe(IMGBB_API_ENDPOINT);
      expect(fetchMock.mock.calls[1][0]).toBe(DEFAULT_FFSKY_API_ENDPOINT);
    });

    it("should return error when all enabled providers fail", async () => {
      const fetchMock = vi.fn(
        async () =>
          new Response(
            JSON.stringify({ status_code: 500, status_txt: "boom" }),
            { status: 200 },
          ),
      );
      vi.stubGlobal("fetch", fetchMock);
      await seedImageHosting({
        apiProviders: [
          {
            id: "imgbb-1",
            name: "ImgBB",
            type: "imgbb",
            apiKey: "imgbb-key",
            articleEnabled: true,
          },
          {
            id: "ffsky-1",
            name: "Ffsky",
            type: "ffsky",
            apiKey: "ffsky-key",
            articleEnabled: true,
          },
        ],
      });

      const formData = new FormData();
      formData.append("image", makeFile());

      const result = await ImageHostingService.uploadForArticle(
        adminContext,
        formData,
      );

      expect(result.data).toBeNull();
      expect(result.error?.reason).toBe("IMAGE_HOSTING_UPLOAD_FAILED");
      expect(result.error?.message).toContain("boom");
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("should skip enabled provider without an api key", async () => {
      const fetchMock = stubFetch({
        body: { data: { url: "https://i.ibb.co/imgbb.png" }, success: true },
      });
      await seedImageHosting({
        r2Native: { articleEnabled: false, commentEnabled: false },
        apiProviders: [
          {
            id: "imgbb-1",
            name: "ImgBB",
            type: "imgbb",
            apiKey: "",
            articleEnabled: true,
          },
        ],
      });

      const formData = new FormData();
      formData.append("image", makeFile());

      const result = await ImageHostingService.uploadForArticle(
        adminContext,
        formData,
      );

      expect(unwrap(result).mode).toBe("none");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("should return error when provider rejects the upload", async () => {
      stubFetch({
        status: 200,
        rawText: JSON.stringify({
          status_code: 400,
          status_txt: "Bad Request",
          error: { code: 401, message: "Invalid key" },
        }),
      });
      await seedImageHosting({
        apiProviders: [
          {
            id: "imgbb-1",
            name: "ImgBB",
            type: "imgbb",
            apiKey: "wrong-key",
            articleEnabled: true,
          },
        ],
      });

      const formData = new FormData();
      formData.append("image", makeFile());

      const result = await ImageHostingService.uploadForArticle(
        adminContext,
        formData,
      );

      expect(result.data).toBeNull();
      expect(result.error?.reason).toBe("IMAGE_HOSTING_UPLOAD_FAILED");
      expect(result.error?.message).toContain("Invalid key");
    });

    it("should return error when the request itself throws", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          throw new Error("network down");
        }),
      );
      await seedImageHosting({
        apiProviders: [
          {
            id: "imgbb-1",
            name: "ImgBB",
            type: "imgbb",
            apiKey: "imgbb-key",
            articleEnabled: true,
          },
        ],
      });

      const formData = new FormData();
      formData.append("image", makeFile());

      const result = await ImageHostingService.uploadForArticle(
        adminContext,
        formData,
      );

      expect(result.error?.reason).toBe("IMAGE_HOSTING_UPLOAD_FAILED");
      expect(result.error?.message).toContain("network down");
    });
  });

  // ============================================
  // 测试连接 (Test Connection)
  // ============================================
  describe("testConnection", () => {
    it("should fail fast when no api key is provided", async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      const result = await ImageHostingService.testConnection({
        category: "api-key",
        apiKeyProviderType: "imgbb",
        apiKey: "  ",
      });

      expect(result.error?.reason).toBe("IMAGE_HOSTING_TEST_FAILED");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("should upload a tiny png and return the hosted url for imgbb", async () => {
      const fetchMock = stubFetch({
        body: { data: { url: "https://i.ibb.co/test.png" }, success: true },
      });

      const result = await ImageHostingService.testConnection({
        category: "api-key",
        apiKeyProviderType: "imgbb",
        apiKey: "imgbb-key",
      });

      expect(unwrap(result)).toEqual({
        success: true,
        url: "https://i.ibb.co/test.png",
      });

      expect(fetchMock.mock.calls[0][0]).toBe(IMGBB_API_ENDPOINT);
      const form = captureFormData(fetchMock);
      expect(form?.get("key")).toBe("imgbb-key");
      expect(typeof form?.get("image")).toBe("string");
    });

    it("should use the custom ffsky endpoint when provided", async () => {
      const fetchMock = stubFetch({
        body: {
          success: { code: 200, message: "ok" },
          image: { url: "https://custom.example/u/1.png" },
        },
      });

      const result = await ImageHostingService.testConnection({
        category: "api-key",
        apiKeyProviderType: "ffsky",
        apiKey: "ffsky-key",
        apiEndpoint: "https://custom.example/api/1/upload",
      });

      expect(unwrap(result).url).toBe("https://custom.example/u/1.png");
      expect(fetchMock.mock.calls[0][0]).toBe(
        "https://custom.example/api/1/upload",
      );
      const form = captureFormData(fetchMock);
      expect(form?.get("source")).toBeTruthy();
    });
  });

  // ============================================
  // 评论配置 (Comment Image Hosting Config)
  // ============================================
  describe("getCommentImageHostingConfig", () => {
    it("should enable s3 comments when s3 commentEnabled is on", async () => {
      await seedImageHosting({
        s3: {
          commentEnabled: true,
          provider: "aws",
          endpoint: "https://s3.example.com",
          bucket: "test-bucket",
          region: "auto",
          accessKeyId: "key",
          secretAccessKey: "secret",
        },
      });

      const result =
        await ImageHostingService.getCommentImageHostingConfig(adminContext);

      expect(result.enabled).toBe(true);
      expect(result.providerCategory).toBe("s3");
    });

    it("should enable r2-native comments when r2Native commentEnabled is on", async () => {
      await seedImageHosting({
        r2Native: { commentEnabled: true },
      });

      const result =
        await ImageHostingService.getCommentImageHostingConfig(adminContext);

      expect(result.enabled).toBe(true);
      expect(result.providerCategory).toBe("r2-native");
    });

    it("should fall back to r2-native comments when nothing else is configured", async () => {
      await seedImageHosting({});

      const result =
        await ImageHostingService.getCommentImageHostingConfig(adminContext);

      expect(result.enabled).toBe(true);
      expect(result.providerCategory).toBe("r2-native");
    });

    it("should be disabled when no image hosting is configured", async () => {
      await seedImageHosting({
        r2Native: { articleEnabled: false, commentEnabled: false },
      });

      const result =
        await ImageHostingService.getCommentImageHostingConfig(adminContext);

      expect(result.enabled).toBe(false);
      expect(result.providerCategory).toBeNull();
    });
  });

  // ============================================
  // 文章配置 (Article Image Hosting Config)
  // ============================================
  describe("getArticleImageHostingConfig", () => {
    it("should enable when s3 article is on", async () => {
      await seedImageHosting({
        s3: {
          articleEnabled: true,
          commentEnabled: false,
          provider: "aws",
          endpoint: "https://s3.example.com",
          bucket: "test-bucket",
          region: "auto",
          accessKeyId: "key",
          secretAccessKey: "secret",
        },
      });

      const result =
        await ImageHostingService.getArticleImageHostingConfig(adminContext);

      expect(result).toEqual({
        enabled: true,
        maxImageBytes: null,
        compressEnabled: true,
        convertToFormat: "none",
      });
    });

    it("should enable when api key provider article is on", async () => {
      await seedImageHosting({
        apiProviders: [
          {
            id: "imgbb-1",
            name: "ImgBB",
            type: "imgbb",
            apiKey: "imgbb-key",
            articleEnabled: true,
          },
        ],
      });

      const result =
        await ImageHostingService.getArticleImageHostingConfig(adminContext);

      expect(result).toEqual({
        enabled: true,
        maxImageBytes: 32 * 1024 * 1024,
        compressEnabled: true,
        convertToFormat: "none",
      });
    });

    it("should be disabled when only r2-native comments are on", async () => {
      await seedImageHosting({
        r2Native: { commentEnabled: true },
      });

      const result =
        await ImageHostingService.getArticleImageHostingConfig(adminContext);

      expect(result).toEqual({
        enabled: false,
        maxImageBytes: 10 * 1024 * 1024,
        compressEnabled: true,
        convertToFormat: "none",
      });
    });

    it("should be disabled when nothing is configured", async () => {
      await seedImageHosting({
        r2Native: { articleEnabled: false, commentEnabled: false },
      });

      const result =
        await ImageHostingService.getArticleImageHostingConfig(adminContext);

      expect(result).toEqual({
        enabled: false,
        maxImageBytes: 10 * 1024 * 1024,
        compressEnabled: true,
        convertToFormat: "none",
      });
    });
  });

  // ============================================
  // Markdown 嵌入解析 (Markdown Embed Parsing)
  // ============================================
  describe("extractImageUrlFromMarkdown", () => {
    it("should extract the url from a plain markdown image", () => {
      expect(extractImageUrlFromMarkdown("![alt](https://img.com/a.png)")).toBe(
        "https://img.com/a.png",
      );
    });

    it("should extract the inner image url from a linked image embed", () => {
      expect(
        extractImageUrlFromMarkdown(
          "[![alt](https://img.com/a.png)](https://viewer.com)",
        ),
      ).toBe("https://img.com/a.png");
    });

    it("should extract a bare url", () => {
      expect(extractImageUrlFromMarkdown("https://raw.example/img.png")).toBe(
        "https://raw.example/img.png",
      );
    });

    it("should return null for empty input", () => {
      expect(extractImageUrlFromMarkdown("")).toBeNull();
      expect(extractImageUrlFromMarkdown("no image here")).toBeNull();
    });
  });
});

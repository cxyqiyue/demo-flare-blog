import { createAdminTestContext, seedUser } from "tests/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CONFIG } from "@/features/config/config.schema";
import * as ConfigRepo from "@/features/config/data/config.data";
import * as DiscordChannelApi from "@/features/image-hosting/channels/discord";
import * as HuggingFaceChannelApi from "@/features/image-hosting/channels/huggingface";
import * as TelegramChannelApi from "@/features/image-hosting/channels/telegram";
import * as WebDavChannelApi from "@/features/image-hosting/channels/webdav";
import * as PostService from "@/features/posts/services/posts.service";
import { PostMediaTable } from "@/lib/db/schema";
import { err, ok, unwrap } from "@/lib/errors";
import * as MediaRepo from "./data/media.data";
import * as MediaService from "./service/media.service";

/**
 * MediaService external channel tests (telegram / discord / huggingface / webdav)
 *
 * Remote calls are mocked at the channel-client layer; D1 is real.
 * Focus: the media library stays in true sync with each real channel:
 * - uploads store the REAL provider handle (message id / repo path) as key
 * - listings come from the authoritative source for each provider
 * - deletes hit the remote channel first; only succeeded keys leave D1
 */
describe("MediaService external channels", () => {
  let adminContext: ReturnType<typeof createAdminTestContext>;

  const HF_CONFIG = {
    token: "hf-test-token",
    repo: "user/test-dataset",
    isPrivate: false,
  };

  const WEBDAV_CONFIG = {
    baseUrl: "https://dav.example.com",
    username: "user",
    password: "pass",
    publicUrl: "https://cdn-dav.example.com",
    createDirectory: true,
  };

  beforeEach(async () => {
    adminContext = createAdminTestContext();
    await seedUser(adminContext.db, adminContext.session.user);

    vi.spyOn(TelegramChannelApi, "uploadToTelegramChannel").mockResolvedValue(
      err({ reason: "TELEGRAM_UPLOAD_FAILED", message: "not mocked" }),
    );
    vi.spyOn(TelegramChannelApi, "deleteTelegramMessage").mockResolvedValue(
      ok({ success: true }),
    );
    vi.spyOn(DiscordChannelApi, "uploadToDiscordChannel").mockResolvedValue(
      err({ reason: "DISCORD_UPLOAD_FAILED", message: "not mocked" }),
    );
    vi.spyOn(DiscordChannelApi, "listDiscordAttachments").mockResolvedValue(
      ok({ files: [], nextBefore: null }),
    );
    vi.spyOn(DiscordChannelApi, "deleteDiscordMessage").mockResolvedValue(
      ok({ success: true }),
    );
    vi.spyOn(
      HuggingFaceChannelApi,
      "uploadToHuggingFaceChannel",
    ).mockResolvedValue(
      err({ reason: "HUGGINGFACE_UPLOAD_FAILED", message: "not mocked" }),
    );
    vi.spyOn(
      HuggingFaceChannelApi,
      "listHuggingFaceDirectory",
    ).mockResolvedValue(ok({ files: [], folders: [] }));
    vi.spyOn(
      HuggingFaceChannelApi,
      "listAllHuggingFacePaths",
    ).mockResolvedValue(ok([]));
    vi.spyOn(HuggingFaceChannelApi, "deleteHuggingFaceFiles").mockResolvedValue(
      ok({ deleted: 0 }),
    );
    vi.spyOn(HuggingFaceChannelApi, "moveHuggingFaceFile").mockResolvedValue(
      ok({ success: true }),
    );
    vi.spyOn(
      HuggingFaceChannelApi,
      "createHuggingFaceFolder",
    ).mockResolvedValue(ok({ success: true }));
    vi.spyOn(WebDavChannelApi, "uploadToWebDavChannel").mockResolvedValue(
      err({ reason: "WEBDAV_UPLOAD_FAILED", message: "not mocked" }),
    );
    vi.spyOn(WebDavChannelApi, "listWebDavDirectory").mockResolvedValue(
      ok({ files: [], folders: [] }),
    );
    vi.spyOn(WebDavChannelApi, "listAllWebDavFilePaths").mockResolvedValue(
      ok([]),
    );
    vi.spyOn(WebDavChannelApi, "deleteWebDavPaths").mockResolvedValue(
      ok({ deleted: 0, failed: [] }),
    );
    vi.spyOn(WebDavChannelApi, "moveWebDavObject").mockResolvedValue(
      ok({ success: true }),
    );
    vi.spyOn(WebDavChannelApi, "ensureWebDavFolder").mockResolvedValue(
      ok({ success: true }),
    );
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

  // ============================================
  // Telegram — D1 index listing + real message delete
  // ============================================
  describe("telegram", () => {
    beforeEach(async () => {
      await seedImageHosting({
        telegram: { botToken: "bot-token", chatId: "-100123", proxyUrl: "" },
      });
    });

    it("should store the real messageId+fileId based key at upload", async () => {
      vi.mocked(TelegramChannelApi.uploadToTelegramChannel).mockResolvedValue(
        ok({
          url: "https://t.me/file/photo.jpg",
          messageId: "4242",
          fileId: "file-1",
          fileName: "photo.png",
          mimeType: "image/png",
          sizeInBytes: 100,
        }),
      );

      const file = new File(["tg"], "photo.png", { type: "image/png" });
      const result = await MediaService.uploadToProvider(
        adminContext,
        { providerId: "telegram", folder: "" },
        file,
      );
      expect(result.error).toBeNull();

      const stored = await MediaRepo.getMediaByKey(
        adminContext.db,
        "telegram/4242:file-1",
      );
      expect(stored).toBeDefined();
      expect(stored?.provider).toBe("telegram");
      expect(stored?.url).toBe("https://t.me/file/photo.jpg");
    });

    it("should list from the D1 index (Bot API cannot enumerate history)", async () => {
      await MediaRepo.insertMedia(adminContext.db, {
        provider: "telegram",
        key: "telegram/111",
        url: "https://t.me/file/1.jpg",
        fileName: "1.jpg",
        mimeType: "image/jpeg",
        sizeInBytes: 10,
      });

      const result = await MediaService.listExternalDirectory(adminContext, {
        providerId: "telegram",
        folder: "",
      });
      expect(result.files.map((f) => f.key)).toEqual(["telegram/111"]);
      expect(result.folders).toEqual([]);
    });

    it("should delete the real message and the D1 record with matching ids", async () => {
      await MediaRepo.insertMedia(adminContext.db, {
        provider: "telegram",
        key: "telegram/4242",
        url: "https://t.me/file/x.jpg",
        fileName: "x.jpg",
        mimeType: "image/jpeg",
        sizeInBytes: 10,
      });

      const result = await MediaService.deleteExternalFiles(adminContext, {
        providerId: "telegram",
        keys: ["telegram/4242"],
      });
      expect(result).toEqual({ deleted: 1, skipped: 0 });

      expect(TelegramChannelApi.deleteTelegramMessage).toHaveBeenCalledWith(
        expect.objectContaining({ chatId: "-100123" }),
        "4242",
      );
      expect(
        await MediaRepo.getMediaByKey(adminContext.db, "telegram/4242"),
      ).toBeUndefined();
    });

    it("should keep failed deletions in D1 and report them as skipped", async () => {
      await MediaRepo.insertMedia(adminContext.db, {
        provider: "telegram",
        key: "telegram/7777",
        url: "https://t.me/file/y.jpg",
        fileName: "y.jpg",
        mimeType: "image/jpeg",
        sizeInBytes: 10,
      });
      vi.mocked(TelegramChannelApi.deleteTelegramMessage).mockResolvedValue(
        err({ reason: "TELEGRAM_DELETE_FAILED", message: "no rights" }),
      );

      const result = await MediaService.deleteExternalFiles(adminContext, {
        providerId: "telegram",
        keys: ["telegram/7777"],
      });
      expect(result).toEqual({ deleted: 0, skipped: 1 });
      expect(
        await MediaRepo.getMediaByKey(adminContext.db, "telegram/7777"),
      ).toBeDefined();
    });

    it("should skip legacy synthetic keys (no remote message to delete)", async () => {
      await MediaRepo.insertMedia(adminContext.db, {
        provider: "telegram",
        key: "telegram/1700000000-abc.png",
        url: "https://t.me/file/legacy.jpg",
        fileName: "legacy.jpg",
        mimeType: "image/jpeg",
        sizeInBytes: 10,
      });

      const result = await MediaService.deleteExternalFiles(adminContext, {
        providerId: "telegram",
        keys: ["telegram/1700000000-abc.png"],
      });
      expect(result).toEqual({ deleted: 1, skipped: 0 });
      expect(TelegramChannelApi.deleteTelegramMessage).not.toHaveBeenCalled();
    });

    it("should refuse rename/move (messages have no paths)", async () => {
      const rename = await MediaService.updateMediaName(adminContext, {
        key: "telegram/4242",
        name: "new.png",
        providerId: "telegram",
      });
      expect(rename.error?.reason).toBe("UNSUPPORTED_PROVIDER");

      const move = await MediaService.moveMediaFile(adminContext, {
        key: "telegram/4242",
        targetFolder: "stuff",
        providerId: "telegram",
      });
      expect(move.error?.reason).toBe("UNSUPPORTED_PROVIDER");
    });
  });

  // ============================================
  // Discord — authoritative channel-history listing
  // ============================================
  describe("discord", () => {
    beforeEach(async () => {
      await seedImageHosting({
        discord: {
          botToken: "dc-token",
          channelId: "chan-1",
          proxyUrl: "",
          isNitro: false,
        },
      });
    });

    it("should list attachments from the real channel without D1 duplicates", async () => {
      await MediaRepo.insertMedia(adminContext.db, {
        provider: "discord",
        key: "9001",
        url: "https://cdn.discordapp.com/old.png",
        fileName: "old.png",
        mimeType: "image/png",
        sizeInBytes: 5,
      });
      vi.mocked(DiscordChannelApi.listDiscordAttachments).mockResolvedValue(
        ok({
          files: [
            {
              key: "9001:0",
              messageId: "9001",
              name: "old.png",
              url: "https://cdn.discordapp.com/old.png",
              mimeType: "image/png",
              sizeInBytes: 5,
            },
            {
              key: "9002:0",
              messageId: "9002",
              name: "fresh.png",
              url: "https://cdn.discordapp.com/fresh.png",
              mimeType: "image/png",
              sizeInBytes: 7,
            },
          ],
          nextBefore: null,
        }),
      );

      const result = await MediaService.listExternalDirectory(adminContext, {
        providerId: "discord",
        folder: "",
      });
      // The same attachment listed remotely must not appear twice
      expect(result.files.map((f) => f.key)).toEqual(["9001:0", "9002:0"]);
    });

    it("should delete by parsing the messageId out of the composite key", async () => {
      await MediaRepo.insertMedia(adminContext.db, {
        provider: "discord",
        key: "9002:0",
        url: "https://cdn.discordapp.com/fresh.png",
        fileName: "fresh.png",
        mimeType: "image/png",
        sizeInBytes: 7,
      });

      const result = await MediaService.deleteExternalFiles(adminContext, {
        providerId: "discord",
        keys: ["9002:0"],
      });
      expect(result).toEqual({ deleted: 1, skipped: 0 });
      expect(DiscordChannelApi.deleteDiscordMessage).toHaveBeenCalledWith(
        expect.objectContaining({ channelId: "chan-1" }),
        "9002:0",
      );
      expect(
        await MediaRepo.getMediaByKey(adminContext.db, "9002:0"),
      ).toBeUndefined();
    });

    it("should store the bare messageId as upload key", async () => {
      vi.mocked(DiscordChannelApi.uploadToDiscordChannel).mockResolvedValue(
        ok({
          url: "https://cdn.discordapp.com/up.png",
          messageId: "31337",
          fileName: "up.png",
          mimeType: "image/png",
          sizeInBytes: 9,
        }),
      );

      const file = new File(["dc"], "up.png", { type: "image/png" });
      const result = await MediaService.uploadToProvider(
        adminContext,
        { providerId: "discord", folder: "" },
        file,
      );
      expect(result.error).toBeNull();

      const stored = await MediaRepo.getMediaByKey(adminContext.db, "31337");
      expect(stored).toBeDefined();
      expect(stored?.provider).toBe("discord");
    });
  });

  // ============================================
  // HuggingFace — datasets protocol full CRUD
  // ============================================
  describe("huggingface", () => {
    beforeEach(async () => {
      await seedImageHosting({
        huggingface: HF_CONFIG,
      });
    });

    it("should list the real dataset tree with folder navigation", async () => {
      vi.mocked(
        HuggingFaceChannelApi.listHuggingFaceDirectory,
      ).mockImplementation(async (_cfg, folder) => {
        if (!folder) {
          return ok({
            files: [],
            folders: [{ key: "images/", name: "images" }],
          });
        }
        return ok({
          files: [
            {
              key: "images/a.png",
              name: "a.png",
              url: "https://huggingface.co/datasets/user/test-dataset/resolve/main/images/a.png",
              mimeType: "image/png",
              sizeInBytes: 42,
            },
          ],
          folders: [],
        });
      });

      const root = await MediaService.listExternalDirectory(adminContext, {
        providerId: "huggingface",
        folder: "",
      });
      expect(root.folders.map((f) => f.key)).toEqual(["images/"]);

      const nested = await MediaService.listExternalDirectory(adminContext, {
        providerId: "huggingface",
        folder: "images",
      });
      expect(nested.files[0].key).toBe("images/a.png");
      expect(nested.files[0].url).toContain("/resolve/main/images/a.png");
    });

    it("should rename via re-commit and rewrite the D1 record", async () => {
      await MediaRepo.insertMedia(adminContext.db, {
        provider: "huggingface",
        key: "images/old.png",
        url: "https://huggingface.co/datasets/user/test-dataset/resolve/main/images/old.png",
        fileName: "old.png",
        mimeType: "image/png",
        sizeInBytes: 10,
      });

      unwrap(
        await MediaService.updateMediaName(adminContext, {
          key: "images/old.png",
          name: "new.png",
          providerId: "huggingface",
        }),
      );

      expect(HuggingFaceChannelApi.moveHuggingFaceFile).toHaveBeenCalledWith(
        expect.objectContaining({ repo: "user/test-dataset" }),
        "images/old.png",
        "images/new.png",
      );

      const updated = await MediaRepo.getMediaByKey(
        adminContext.db,
        "images/new.png",
      );
      expect(updated).toBeDefined();
      expect(updated?.fileName).toBe("new.png");
      expect(updated?.url).toContain("/resolve/main/images/new.png");
      expect(
        await MediaRepo.getMediaByKey(adminContext.db, "images/old.png"),
      ).toBeUndefined();
    });

    it("should move a file into the target folder", async () => {
      await MediaRepo.insertMedia(adminContext.db, {
        provider: "huggingface",
        key: "images/moveme.png",
        url: "https://huggingface.co/datasets/user/test-dataset/resolve/main/images/moveme.png",
        fileName: "moveme.png",
        mimeType: "image/png",
        sizeInBytes: 10,
      });

      unwrap(
        await MediaService.moveMediaFile(adminContext, {
          key: "images/moveme.png",
          targetFolder: "archive",
          providerId: "huggingface",
        }),
      );

      expect(HuggingFaceChannelApi.moveHuggingFaceFile).toHaveBeenCalledWith(
        expect.anything(),
        "images/moveme.png",
        "archive/moveme.png",
      );
      const updated = await MediaRepo.getMediaByKey(
        adminContext.db,
        "archive/moveme.png",
      );
      expect(updated).toBeDefined();
    });

    it("should delete a folder recursively but protect linked files", async () => {
      const free = await MediaRepo.insertMedia(adminContext.db, {
        provider: "huggingface",
        key: "blog/free.png",
        url: "https://huggingface.co/datasets/user/test-dataset/resolve/main/blog/free.png",
        fileName: "free.png",
        mimeType: "image/png",
        sizeInBytes: 10,
      });
      const linked = await MediaRepo.insertMedia(adminContext.db, {
        provider: "huggingface",
        key: "blog/linked.png",
        url: "https://huggingface.co/datasets/user/test-dataset/resolve/main/blog/linked.png",
        fileName: "linked.png",
        mimeType: "image/png",
        sizeInBytes: 10,
      });
      expect(free).toBeDefined();

      const { id: postId } = await PostService.createEmptyPost(adminContext);
      await adminContext.db
        .insert(PostMediaTable)
        .values({ postId, mediaId: linked.id });

      vi.mocked(
        HuggingFaceChannelApi.listAllHuggingFacePaths,
      ).mockResolvedValue(ok(["blog/free.png", "blog/linked.png"]));

      const result = unwrap(
        await MediaService.deleteFolders(adminContext, {
          keys: ["blog/"],
          providerId: "huggingface",
        }),
      );
      expect(result).toEqual({
        deletedFolders: 1,
        deletedFiles: 1,
        skippedFiles: 1,
      });

      const deletedPaths = vi.mocked(
        HuggingFaceChannelApi.deleteHuggingFaceFiles,
      ).mock.calls[0][1];
      expect(deletedPaths).toEqual(["blog/free.png"]);

      expect(
        await MediaRepo.getMediaByKey(adminContext.db, "blog/free.png"),
      ).toBeUndefined();
      expect(
        await MediaRepo.getMediaByKey(adminContext.db, "blog/linked.png"),
      ).toBeDefined();
    });

    it("should create a folder marker at the exact path", async () => {
      const result = unwrap(
        await MediaService.createExternalFolder(adminContext, {
          providerId: "huggingface",
          name: "newdir",
          parent: "images",
        }),
      );
      expect(result).toEqual({ key: "images/newdir", name: "newdir" });
      expect(
        HuggingFaceChannelApi.createHuggingFaceFolder,
      ).toHaveBeenCalledWith(expect.anything(), "images/newdir");
    });
  });

  // ============================================
  // WebDAV — PROPFIND/MOVE full CRUD
  // ============================================
  describe("webdav", () => {
    beforeEach(async () => {
      await seedImageHosting({
        webdav: WEBDAV_CONFIG,
      });
    });

    it("should list the real server directory", async () => {
      vi.mocked(WebDavChannelApi.listWebDavDirectory).mockResolvedValue(
        ok({
          files: [
            {
              key: "photos/sun.jpg",
              name: "sun.jpg",
              url: "https://cdn-dav.example.com/photos/sun.jpg",
              mimeType: "image/jpeg",
              sizeInBytes: 88,
            },
          ],
          folders: [{ key: "photos/sub/", name: "sub" }],
        }),
      );

      const result = await MediaService.listExternalDirectory(adminContext, {
        providerId: "webdav",
        folder: "photos",
      });
      expect(result.files[0]).toMatchObject({
        key: "photos/sun.jpg",
        url: "https://cdn-dav.example.com/photos/sun.jpg",
      });
      expect(result.folders[0].key).toBe("photos/sub/");
    });

    it("should rename via MOVE and rewrite the D1 record", async () => {
      await MediaRepo.insertMedia(adminContext.db, {
        provider: "webdav",
        key: "photos/old.jpg",
        url: "https://cdn-dav.example.com/photos/old.jpg",
        fileName: "old.jpg",
        mimeType: "image/jpeg",
        sizeInBytes: 10,
      });

      unwrap(
        await MediaService.updateMediaName(adminContext, {
          key: "photos/old.jpg",
          name: "new.jpg",
          providerId: "webdav",
        }),
      );

      expect(WebDavChannelApi.moveWebDavObject).toHaveBeenCalledWith(
        expect.objectContaining({ baseUrl: "https://dav.example.com" }),
        "photos/old.jpg",
        "photos/new.jpg",
      );

      const updated = await MediaRepo.getMediaByKey(
        adminContext.db,
        "photos/new.jpg",
      );
      expect(updated?.fileName).toBe("new.jpg");
      expect(updated?.url).toBe("https://cdn-dav.example.com/photos/new.jpg");
    });

    it("should rename a folder via MOVE and rewrite all D1 keys + urls", async () => {
      await MediaRepo.insertMedia(adminContext.db, {
        provider: "webdav",
        key: "gallery/nested/pic.png",
        url: "https://cdn-dav.example.com/gallery/nested/pic.png",
        fileName: "pic.png",
        mimeType: "image/png",
        sizeInBytes: 10,
      });

      const result = unwrap(
        await MediaService.renameFolder(adminContext, {
          key: "gallery/nested/",
          name: "renamed",
          providerId: "webdav",
        }),
      );
      expect(result.key).toBe("gallery/renamed/");

      expect(WebDavChannelApi.moveWebDavObject).toHaveBeenCalledWith(
        expect.anything(),
        "gallery/nested",
        "gallery/renamed",
      );

      const updated = await MediaRepo.getMediaByKey(
        adminContext.db,
        "gallery/renamed/pic.png",
      );
      expect(updated?.url).toBe(
        "https://cdn-dav.example.com/gallery/renamed/pic.png",
      );
    });

    it("should delete files remotely first and clean up D1 afterwards", async () => {
      await MediaRepo.insertMedia(adminContext.db, {
        provider: "webdav",
        key: "tmp/doomed.png",
        url: "https://cdn-dav.example.com/tmp/doomed.png",
        fileName: "doomed.png",
        mimeType: "image/png",
        sizeInBytes: 10,
      });

      const result = await MediaService.deleteExternalFiles(adminContext, {
        providerId: "webdav",
        keys: ["tmp/doomed.png"],
      });
      expect(result).toEqual({ deleted: 1, skipped: 0 });
      expect(WebDavChannelApi.deleteWebDavPaths).toHaveBeenCalledWith(
        expect.anything(),
        ["tmp/doomed.png"],
      );
      expect(
        await MediaRepo.getMediaByKey(adminContext.db, "tmp/doomed.png"),
      ).toBeUndefined();
    });

    it("should never touch R2 storage for external providers", async () => {
      const rename = await MediaService.renameFolder(adminContext, {
        key: "gallery/unknown/",
        name: "x",
        providerId: "telegram",
      });
      expect(rename.error?.reason).toBe("UNSUPPORTED_PROVIDER");

      const del = await MediaService.deleteFolders(adminContext, {
        keys: ["gallery/unknown/"],
        providerId: "api-key-provider-x",
      });
      expect(del.error?.reason).toBe("UNSUPPORTED_PROVIDER");
    });
  });

  // ============================================
  // Provider capability flags
  // ============================================
  describe("getMediaProviders capability flags", () => {
    it("should expose delete-only channels vs full-CRUD channels correctly", async () => {
      await seedImageHosting({
        telegram: { botToken: "t", chatId: "c", proxyUrl: "" },
        discord: {
          botToken: "t",
          channelId: "c",
          proxyUrl: "",
          isNitro: false,
        },
        huggingface: HF_CONFIG,
        webdav: WEBDAV_CONFIG,
      });

      const providers = await MediaService.getMediaProviders(adminContext);
      const byId = Object.fromEntries(providers.map((p) => [p.id, p]));

      expect(byId.telegram).toMatchObject({
        canList: true,
        canDelete: true,
        canRename: false,
        canMove: false,
        canCreateFolder: false,
      });
      expect(byId.discord).toMatchObject({
        canList: true,
        canDelete: true,
        canRename: false,
        canMove: false,
        canCreateFolder: false,
      });
      expect(byId.huggingface).toMatchObject({
        canList: true,
        canDelete: true,
        canRename: true,
        canMove: true,
        canCreateFolder: true,
      });
      expect(byId.webdav).toMatchObject({
        canList: true,
        canDelete: true,
        canRename: true,
        canMove: true,
        canCreateFolder: true,
      });
    });

    it("should mark Cloudflare R2 as the default channel on a fresh deployment", async () => {
      await seedImageHosting({});

      const providers = await MediaService.getMediaProviders(adminContext);
      const byId = Object.fromEntries(providers.map((p) => [p.id, p]));

      expect(byId.r2).toBeDefined();
      expect(byId.r2?.name).toBe("Cloudflare R2");
      expect(byId.r2?.isDefault).toBe(true);
    });

    it("should move the default channel to the explicitly active provider", async () => {
      await seedImageHosting({
        activeProvider: "telegram",
        telegram: { botToken: "t", chatId: "c", proxyUrl: "" },
      });

      const providers = await MediaService.getMediaProviders(adminContext);
      const byId = Object.fromEntries(providers.map((p) => [p.id, p]));

      expect(byId.r2?.isDefault).toBe(false);
      expect(byId.telegram?.isDefault).toBe(true);
    });
  });

  // ============================================
  // 渠道大小上限（FILE_TOO_LARGE）
  // ============================================
  describe("upload size limits", () => {
    it("should reject oversized uploads before calling the channel", async () => {
      await seedImageHosting({
        telegram: {
          botToken: "bot-token",
          chatId: "-100123",
          proxyUrl: "",
          maxFileSizeMb: 1,
        },
      });

      const spy = vi.mocked(TelegramChannelApi.uploadToTelegramChannel);
      const file = new File([new Uint8Array(2 * 1024 * 1024)], "big.png", {
        type: "image/png",
      });

      const result = await MediaService.uploadToProvider(
        adminContext,
        { providerId: "telegram", folder: "" },
        file,
      );

      expect(result.error).not.toBeNull();
      expect(result.error?.reason).toBe("FILE_TOO_LARGE");
      expect(spy).not.toHaveBeenCalled();

      const stored = await MediaRepo.getMediaByKey(
        adminContext.db,
        "telegram/4242",
      );
      expect(stored).toBeUndefined();
    });

    it("should expose per-provider maxFileSizeBytes to the UI", async () => {
      await seedImageHosting({
        r2Native: { articleEnabled: true },
        telegram: {
          botToken: "t",
          chatId: "c",
          proxyUrl: "",
          maxFileSizeMb: 20,
        },
        discord: { botToken: "b", channelId: "c", proxyUrl: "", isNitro: true },
        huggingface: { token: "hf", repo: "user/repo" },
        webdav: { baseUrl: "https://dav.example.com" },
      });

      const providers = await MediaService.getMediaProviders(adminContext);
      const byId = Object.fromEntries(providers.map((p) => [p.id, p]));

      expect(byId.telegram?.maxFileSizeBytes).toBe(20 * 1024 * 1024);
      expect(byId.discord?.maxFileSizeBytes).toBe(25 * 1024 * 1024);
      expect(byId.huggingface?.maxFileSizeBytes).toBeNull();
      expect(byId.webdav?.maxFileSizeBytes).toBeNull();
    });
  });
});

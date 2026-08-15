import {
  createAdminTestContext,
  seedUser,
  waitForBackgroundTasks,
} from "tests/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as PostMediaRepo from "@/features/posts/data/post-media.data";
import * as PostService from "@/features/posts/services/posts.service";
import { unwrap } from "@/lib/errors";
import * as Storage from "./data/media.storage";
import * as MediaService from "./service/media.service";

/**
 * MediaService Tests
 *
 * R2 operations are mocked at the storage layer to avoid Miniflare R2 isolation issues.
 * These are integration tests focused on:
 * - Service layer logic
 * - DB operations (using real D1)
 * - Rollback behavior
 * - Post-Media relationships
 */
describe("MediaService", () => {
  let adminContext: ReturnType<typeof createAdminTestContext>;

  // Mock R2 storage functions
  beforeEach(async () => {
    adminContext = createAdminTestContext();
    await seedUser(adminContext.db, adminContext.session.user);

    // Mock R2 operations at storage layer to avoid Miniflare R2 isolation/serialization issues.
    // We trust the `r2-sanity.test.ts` (or equivalent verification) matches the platform behavior,
    // and here we focus on Service Logic + DB integration.

    vi.spyOn(Storage, "putToR2").mockImplementation(
      async (_env, file, _folder = "") => {
        const key = `mocked-${Date.now()}-${file.name}`;
        return {
          key,
          url: `/images/${key}`,
          fileName: file.name,
          mimeType: file.type,
          sizeInBytes: file.size,
        };
      },
    );

    vi.spyOn(Storage, "deleteFromR2").mockResolvedValue(undefined);
    vi.spyOn(Storage, "getFromR2").mockResolvedValue(null);

    // Directory / folder operations: default empty implementations.
    // Individual tests override these where they exercise the logic.
    vi.spyOn(Storage, "listR2Directory").mockImplementation(
      async () => ({ objects: [], delimitedPrefixes: [], truncated: false }) as unknown as R2Objects,
    );
    vi.spyOn(Storage, "listAllKeys").mockResolvedValue([]);
    vi.spyOn(Storage, "createFolderMarker").mockResolvedValue(undefined);
    vi.spyOn(Storage, "copyObject").mockResolvedValue(true);
    vi.spyOn(Storage, "deleteKeys").mockResolvedValue(undefined);
  });

  // ============================================
  // 上传流程 (Upload Flow)
  // ============================================
  describe("Upload Flow", () => {
    it("should upload file and create DB record", async () => {
      const file = new File(["fake image content"], "test-image.png", {
        type: "image/png",
      });

      const result = unwrap(await MediaService.upload(adminContext, { file }));

      expect(result).toMatchObject({
        fileName: "test-image.png",
        mimeType: "image/png",
      });
      expect(result.key).toContain("mocked-");
      expect(result.url).toContain("/images/");

      // Verify Storage.putToR2 was called
      expect(Storage.putToR2).toHaveBeenCalledWith(
        adminContext.env,
        file,
        "",
      );

      // Verify DB record was created
      const mediaList = await MediaService.getMediaList(adminContext, {});
      expect(mediaList.items.some((m) => m.key === result.key)).toBeTruthy();
    });

    it("should upload file into a folder", async () => {
      const file = new File(["folder content"], "in-folder.png", {
        type: "image/png",
      });

      const result = unwrap(
        await MediaService.upload(adminContext, { file, folder: "photos" }),
      );

      expect(result.fileName).toBe("in-folder.png");
      expect(Storage.putToR2).toHaveBeenCalledWith(
        adminContext.env,
        file,
        "photos",
      );
    });

    it("should rollback R2 upload when DB insert fails", async () => {
      const file = new File(["test content"], "rollback-test.png", {
        type: "image/png",
      });

      // Make putToR2 work but insertMedia fail
      const mockKey = `rollback-key-${Date.now()}`;
      vi.mocked(Storage.putToR2).mockResolvedValueOnce({
        key: mockKey,
        url: `/images/${mockKey}`,
        fileName: file.name,
        mimeType: file.type,
        sizeInBytes: file.size,
      });

      // Import and mock the repo
      const MediaRepo = await import("./data/media.data");
      vi.spyOn(MediaRepo, "insertMedia").mockRejectedValueOnce(
        new Error("DB Error"),
      );

      const result = await MediaService.upload(adminContext, { file });
      expect(result.error?.reason).toBe("MEDIA_RECORD_CREATE_FAILED");

      // Wait for rollback
      await waitForBackgroundTasks(adminContext.executionCtx);

      // Verify deleteFromR2 was called with the uploaded key
      expect(Storage.deleteFromR2).toHaveBeenCalledWith(
        adminContext.env,
        mockKey,
      );
    });

    it("should calculate correct file size", async () => {
      const content = "x".repeat(1024); // 1KB
      const file = new File([content], "sized-file.jpg", {
        type: "image/jpeg",
      });

      const result = unwrap(await MediaService.upload(adminContext, { file }));

      expect(result.sizeInBytes).toBe(1024);
    });
  });

  // ============================================
  // 删除流程 (Deletion Flow)
  // ============================================
  describe("Deletion Flow", () => {
    it("should delete from both DB and trigger R2 cleanup", async () => {
      // First upload a file
      const file = new File(["delete me"], "to-delete.png", {
        type: "image/png",
      });
      const uploaded = unwrap(
        await MediaService.upload(adminContext, { file }),
      );

      // Reset mock to track deletion call
      vi.mocked(Storage.deleteFromR2).mockClear();

      // Delete it
      unwrap(await MediaService.deleteImage(adminContext, uploaded.key));

      // Wait for R2 deletion in waitUntil
      await waitForBackgroundTasks(adminContext.executionCtx);

      // Verify DB record is gone
      const mediaList = await MediaService.getMediaList(adminContext, {});
      expect(
        mediaList.items.find((m) => m.key === uploaded.key),
      ).toBeUndefined();

      // Verify R2 deleteFromR2 was called
      expect(Storage.deleteFromR2).toHaveBeenCalledWith(
        adminContext.env,
        uploaded.key,
      );
    });
  });

  // ============================================
  // 媒体查询 (Media Queries)
  // ============================================
  describe("Media Queries", () => {
    beforeEach(async () => {
      // Upload some test files
      for (let i = 1; i <= 5; i++) {
        const file = new File([`content ${i}`], `query-test-${i}.png`, {
          type: "image/png",
        });
        unwrap(await MediaService.upload(adminContext, { file }));
      }
    });

    it("should list media with pagination", async () => {
      const result = await MediaService.getMediaList(adminContext, {
        limit: 3,
      });

      expect(result.items).toHaveLength(3);
      expect(result.nextCursor).not.toBeNull();
    });

    it("should fetch next page using cursor", async () => {
      const firstPage = await MediaService.getMediaList(adminContext, {
        limit: 3,
      });
      const secondPage = await MediaService.getMediaList(adminContext, {
        limit: 3,
        cursor: firstPage.nextCursor!,
      });

      expect(secondPage.items).toHaveLength(2); // 5 total, 3 in first page
      expect(secondPage.nextCursor).toBeNull();

      // Ensure no duplicates between pages
      const firstIds = firstPage.items.map((m) => m.id);
      const secondIds = secondPage.items.map((m) => m.id);
      expect(firstIds.some((id) => secondIds.includes(id))).toBeFalsy();
    });

    it("should search media by filename", async () => {
      // Upload a uniquely named file
      const uniqueFile = new File(["unique"], "special-unique-file.png", {
        type: "image/png",
      });
      unwrap(await MediaService.upload(adminContext, { file: uniqueFile }));

      const result = await MediaService.getMediaList(adminContext, {
        search: "special-unique",
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].fileName).toBe("special-unique-file.png");
    });

    it("should calculate total media size", async () => {
      const totalSize = await MediaService.getTotalMediaSize(adminContext);

      // 5 files with "content X" = roughly 9 bytes each
      expect(totalSize).toBeGreaterThan(0);
    });

    it("should update media filename", async () => {
      const file = new File(["rename me"], "original-name.png", {
        type: "image/png",
      });
      const uploaded = unwrap(
        await MediaService.upload(adminContext, { file }),
      );

      await MediaService.updateMediaName(adminContext, {
        key: uploaded.key,
        name: "new-fancy-name.png",
      });

      const list = await MediaService.getMediaList(adminContext, {
        search: "new-fancy-name",
      });
      expect(list.items).toHaveLength(1);
    });
  });

  // ============================================
  // 文章-媒体关联 (Post-Media Relationships)
  // ============================================
  describe("Post-Media Relationships", () => {
    it("should track media usage in posts", async () => {
      // Upload media
      const file = new File(["linked image"], "linked-image.png", {
        type: "image/png",
      });
      const media = unwrap(await MediaService.upload(adminContext, { file }));

      // Create a post
      const { id: postId } = await PostService.createEmptyPost(adminContext);

      // Sync post-media relationship
      await PostMediaRepo.syncPostMedia(adminContext.db, postId, {
        type: "doc",
        content: [
          {
            type: "image",
            attrs: { src: `/images/${media.key}` },
          },
        ],
      });

      // Check if media is in use
      const isInUse = await MediaService.isMediaInUse(adminContext, media.key);
      expect(isInUse).toBe(true);

      // Get linked posts
      const linkedPosts = await MediaService.getLinkedPosts(
        adminContext,
        media.key,
      );
      expect(linkedPosts).toHaveLength(1);
    });

    it("should return false for unused media", async () => {
      const file = new File(["unused"], "unused-image.png", {
        type: "image/png",
      });
      const media = unwrap(await MediaService.upload(adminContext, { file }));

      const isInUse = await MediaService.isMediaInUse(adminContext, media.key);
      expect(isInUse).toBe(false);
    });

    it("should batch check linked media keys", async () => {
      // Upload multiple media files
      const files = ["batch-1.png", "batch-2.png", "batch-3.png"];
      const mediaKeys: Array<string> = [];

      for (const fileName of files) {
        const file = new File(["content"], fileName, { type: "image/png" });
        const media = unwrap(await MediaService.upload(adminContext, { file }));
        mediaKeys.push(media.key);
      }

      // Link only first two to a post
      const { id: postId } = await PostService.createEmptyPost(adminContext);
      await PostMediaRepo.syncPostMedia(adminContext.db, postId, {
        type: "doc",
        content: [
          { type: "image", attrs: { src: `/images/${mediaKeys[0]}` } },
          { type: "image", attrs: { src: `/images/${mediaKeys[1]}` } },
        ],
      });

      // Batch check
      const linkedKeys = await MediaService.getLinkedMediaKeys(
        adminContext,
        mediaKeys,
      );

      expect(linkedKeys).toHaveLength(2);
      expect(linkedKeys).toContain(mediaKeys[0]);
      expect(linkedKeys).toContain(mediaKeys[1]);
      expect(linkedKeys).not.toContain(mediaKeys[2]);
    });
  });

  // ============================================
  // 目录与文件夹 (Directory & Folders)
  // ============================================
  describe("Directory & Folders", () => {
    it("should create a folder marker in R2", async () => {
      const result = unwrap(
        await MediaService.createFolder(adminContext, {
          name: "photos",
          parent: "",
        }),
      );

      expect(result).toEqual({ key: "photos/", name: "photos" });
      expect(Storage.createFolderMarker).toHaveBeenCalledWith(
        adminContext.env,
        "photos/",
      );
    });

    it("should reject invalid folder names", async () => {
      const nested = await MediaService.createFolder(adminContext, {
        name: "a/b",
        parent: "",
      });
      expect(nested.error?.reason).toBe("MEDIA_INVALID_FOLDER_NAME");

      const blank = await MediaService.createFolder(adminContext, {
        name: " ",
        parent: "",
      });
      expect(blank.error?.reason).toBe("MEDIA_INVALID_FOLDER_NAME");
    });

    it("should list a directory: folders + files at the current level", async () => {
      vi.mocked(Storage.listR2Directory).mockImplementation(
        async (_env, options = {}) => {
          const prefix = options.prefix ?? "";
          if (prefix === "photos/") {
            return {
              objects: [{ key: "photos/a.png" }, { key: "photos/b.png" }],
              delimitedPrefixes: [],
              truncated: false,
            } as unknown as R2Objects;
          }
          return {
            objects: [{ key: "root.png" }, { key: "photos/" }],
            delimitedPrefixes: ["photos/"],
            truncated: false,
          } as unknown as R2Objects;
        },
      );

      const root = await MediaService.getMediaDirectory(adminContext, {
        folder: "",
      });
      expect(root.folders.map((f) => f.name)).toEqual(["photos"]);
      expect(root.files.map((f) => f.name)).toEqual(["root.png"]);
      expect(root.files[0].key).toBe("root.png");

      const photos = await MediaService.getMediaDirectory(adminContext, {
        folder: "photos",
      });
      expect(photos.folders).toEqual([]);
      expect(photos.files.map((f) => f.name).sort()).toEqual([
        "a.png",
        "b.png",
      ]);
    });

    it("should search globally across all folders", async () => {
      vi.mocked(Storage.listAllKeys).mockResolvedValue([
        "photos/a.png",
        "photos/b.png",
        "root.png",
      ]);

      const result = await MediaService.getMediaDirectory(adminContext, {
        folder: "",
        search: "a",
      });
      expect(result.files.map((f) => f.name)).toEqual(["a.png"]);

      const none = await MediaService.getMediaDirectory(adminContext, {
        folder: "",
        search: "zzz-none",
      });
      expect(none.files).toEqual([]);
    });

    it("should rename a folder: copy objects + rewrite DB keys", async () => {
      // Seed a DB record inside the folder
      const MediaRepo = await import("./data/media.data");
      await MediaRepo.insertMedia(adminContext.db, {
        key: "photos/a.png",
        url: "/images/photos/a.png",
        fileName: "a.png",
        mimeType: "image/png",
        sizeInBytes: 100,
      });

      vi.mocked(Storage.listAllKeys).mockResolvedValue([
        "photos/a.png",
        "photos/",
      ]);

      const result = unwrap(
        await MediaService.renameFolder(adminContext, {
          key: "photos/",
          name: "gallery",
        }),
      );
      expect(result.key).toBe("gallery/");

      expect(Storage.copyObject).toHaveBeenCalledWith(
        adminContext.env,
        "photos/a.png",
        "gallery/a.png",
      );
      expect(Storage.copyObject).toHaveBeenCalledWith(
        adminContext.env,
        "photos/",
        "gallery/",
      );

      await waitForBackgroundTasks(adminContext.executionCtx);
      expect(Storage.deleteKeys).toHaveBeenCalledWith(adminContext.env, [
        "photos/a.png",
        "photos/",
      ]);

      const list = await MediaService.getMediaList(adminContext, {
        search: "a.png",
      });
      expect(list.items).toHaveLength(1);
      expect(list.items[0].key).toBe("gallery/a.png");
      expect(list.items[0].url).toBe("/images/gallery/a.png");
    });

    it("should delete a folder but skip linked files", async () => {
      const MediaRepo = await import("./data/media.data");

      // Two files in the folder; `b.png` is referenced by a post.
      await MediaRepo.insertMedia(adminContext.db, {
        key: "photos/a.png",
        url: "/images/photos/a.png",
        fileName: "a.png",
        mimeType: "image/png",
        sizeInBytes: 100,
      });
      const bMedia = await MediaRepo.insertMedia(adminContext.db, {
        key: "photos/b.png",
        url: "/images/photos/b.png",
        fileName: "b.png",
        mimeType: "image/png",
        sizeInBytes: 100,
      });

      const { id: postId } = await PostService.createEmptyPost(adminContext);
      await PostMediaRepo.syncPostMedia(adminContext.db, postId, {
        type: "doc",
        content: [{ type: "image", attrs: { src: `/images/${bMedia.key}` } }],
      });

      vi.mocked(Storage.listAllKeys).mockResolvedValue([
        "photos/a.png",
        "photos/b.png",
        "photos/",
      ]);

      const result = await MediaService.deleteFolders(adminContext, {
        keys: ["photos/"],
      });
      expect(result.data).toEqual({
        deletedFolders: 1,
        deletedFiles: 1,
        skippedFiles: 1,
      });

      await waitForBackgroundTasks(adminContext.executionCtx);
      expect(Storage.deleteKeys).toHaveBeenCalledWith(adminContext.env, [
        "photos/a.png",
        "photos/",
      ]);

      // Linked file stays, unlinked file removed
      const list = await MediaService.getMediaList(adminContext, {});
      const remainingKeys = list.items.map((m) => m.key);
      expect(remainingKeys).not.toContain("photos/a.png");
      expect(remainingKeys).toContain("photos/b.png");
    });
  });
});

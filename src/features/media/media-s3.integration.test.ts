import { createAdminTestContext, seedUser } from "tests/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CONFIG } from "@/features/config/config.schema";
import * as ConfigRepo from "@/features/config/data/config.data";
import * as PostService from "@/features/posts/services/posts.service";
import { PostMediaTable } from "@/lib/db/schema";
import * as S3Upload from "@/features/image-hosting/s3/s3-upload";
import * as MediaRepo from "./data/media.data";
import * as MediaService from "./service/media.service";
import { err, ok, unwrap } from "@/lib/errors";

/**
 * MediaService S3 media-library tests
 *
 * S3 remote calls are mocked at the s3-upload layer; D1 is real.
 * Focus: the media library stays in true sync with the real bucket 鈥? * - browsing starts at the REAL bucket root (pathPrefix visible as folder)
 * - CRUD operations hit the real storage with full bucket-relative keys
 * - files added directly in S3 show up (reverse sync)
 */
describe("MediaService S3 media library", () => {
  let adminContext: ReturnType<typeof createAdminTestContext>;

  const PUBLIC_URL = "https://cdn.example.com";

  const S3_CONFIG = {
    provider: "custom",
    endpoint: "https://s3.example.com",
    bucket: "my-bucket",
    region: "us-east-1",
    accessKeyId: "AKIA-test",
    secretAccessKey: "secret-test",
    pathPrefix: "images/blog",
    publicUrl: PUBLIC_URL,
    articleEnabled: false,
    commentEnabled: false,
  };

  beforeEach(async () => {
    adminContext = createAdminTestContext();
    await seedUser(adminContext.db, adminContext.session.user);

    await ConfigRepo.upsertSystemConfig(adminContext.db, {
      ...DEFAULT_CONFIG,
      imageHosting: {
        ...DEFAULT_CONFIG.imageHosting,
        s3: S3_CONFIG,
      },
    });

    vi.spyOn(S3Upload, "listS3Objects").mockResolvedValue(
      ok({ objects: [], prefixes: [], isTruncated: false }),
    );
    vi.spyOn(S3Upload, "listAllS3Keys").mockResolvedValue(ok([]));
    vi.spyOn(S3Upload, "deleteS3Object").mockResolvedValue(
      ok({ success: true }),
    );
    vi.spyOn(S3Upload, "deleteS3Objects").mockImplementation(async (_cfg, keys) =>
      ok({ deleted: keys.length }),
    );
    vi.spyOn(S3Upload, "moveS3Object").mockResolvedValue(
      ok({ success: true }),
    );
    vi.spyOn(S3Upload, "moveS3Objects").mockImplementation(async (_cfg, keys) =>
      ok({ moved: keys.length }),
    );
    vi.spyOn(S3Upload, "renameS3Object").mockResolvedValue(
      ok({ success: true }),
    );
    vi.spyOn(S3Upload, "uploadToS3").mockImplementation(async (_cfg, input) =>
      ok({ url: `${PUBLIC_URL}/${input.key}` }),
    );
    let uploadCounter = 0;
    vi.spyOn(S3Upload, "uploadToS3ForMediaLibrary").mockImplementation(
      async (_cfg, file, folder) => {
        uploadCounter += 1;
        const key = `${folder ? `${folder}/` : ""}mock-${uploadCounter}.png`;
        return ok({
          key,
          url: `${PUBLIC_URL}/${key}`,
          fileName: file.name,
          mimeType: file.type,
          sizeInBytes: file.size,
        });
      },
    );
  });

  // ============================================
  // 鐩綍娴忚 (Directory browsing 鈥?real bucket root)
  // ============================================
  describe("directory browsing", () => {
    it("should list the REAL bucket root: pathPrefix appears as a normal folder", async () => {
      vi.mocked(S3Upload.listS3Objects).mockImplementation(async (_cfg, options = {}) => {
        const prefix = options.prefix ?? "";
        if (prefix === "") {
          // Root of the bucket: a loose file, the configured pathPrefix
          // folder and its zero-byte marker object.
          return ok({
            objects: [
              { key: "images/blog/", size: 0, lastModified: "" },
              { key: "readme.txt", size: 12, lastModified: "" },
            ],
            prefixes: ["assets", "images"],
            isTruncated: false,
          });
        }
        if (prefix === "images/") {
          return ok({
            objects: [],
            prefixes: ["images/blog"],
            isTruncated: false,
          });
        }
        if (prefix === "images/blog/") {
          return ok({
            objects: [
              { key: "images/blog/a.png", size: 100, lastModified: "" },
              { key: "images/blog/b.jpg", size: 200, lastModified: "" },
            ],
            prefixes: [],
            isTruncated: false,
          });
        }
        return ok({ objects: [], prefixes: [], isTruncated: false });
      });

      // Root shows folders first 鈥?NOT the images inside images/blog directly
      const root = await MediaService.listExternalDirectory(adminContext, {
        providerId: "s3",
        folder: "",
      });
      expect(root.error).toBeUndefined();
      expect(root.folders.map((f) => f.key).sort()).toEqual([
        "assets/",
        "images/",
      ]);
      expect(root.folders.map((f) => f.name).sort()).toEqual([
        "assets",
        "images",
      ]);
      // Folder markers are hidden from files; only the real file remains
      expect(root.files.map((f) => f.key)).toEqual(["readme.txt"]);

      // Navigate: images -> blog
      const images = await MediaService.listExternalDirectory(adminContext, {
        providerId: "s3",
        folder: "images",
      });
      expect(images.folders.map((f) => f.key)).toEqual(["images/blog/"]);

      const blog = await MediaService.listExternalDirectory(adminContext, {
        providerId: "s3",
        folder: "images/blog",
      });
      expect(blog.folders).toEqual([]);
      expect(blog.files.map((f) => f.key).sort()).toEqual([
        "images/blog/a.png",
        "images/blog/b.jpg",
      ]);
      expect(blog.files[0].url).toBe(`${PUBLIC_URL}/images/blog/a.png`);
      expect(blog.files[0].name).toBe("a.png");

      // Listing used the raw bucket prefix (no implicit pathPrefix prepend)
      expect(S3Upload.listS3Objects).toHaveBeenCalledWith(
        expect.objectContaining({ bucket: "my-bucket" }),
        expect.objectContaining({ prefix: "", delimiter: "/" }),
      );
      expect(S3Upload.listS3Objects).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ prefix: "images/blog/", delimiter: "/" }),
      );
    });

    it("should show files uploaded directly to S3 without any D1 record (reverse sync)", async () => {
      vi.mocked(S3Upload.listS3Objects).mockResolvedValue(
        ok({
          objects: [{ key: "external-upload.png", size: 5, lastModified: "" }],
          prefixes: [],
          isTruncated: false,
        }),
      );

      const root = await MediaService.listExternalDirectory(adminContext, {
        providerId: "s3",
        folder: "",
      });
      expect(root.files).toHaveLength(1);
      expect(root.files[0]).toMatchObject({
        key: "external-upload.png",
        name: "external-upload.png",
        url: `${PUBLIC_URL}/external-upload.png`,
        sizeInBytes: 5,
      });
    });

    it("should not duplicate files that exist both remotely and in D1", async () => {
      await MediaRepo.insertMedia(adminContext.db, {
        provider: "s3",
        key: "images/blog/a.png",
        url: `${PUBLIC_URL}/images/blog/a.png`,
        fileName: "a.png",
        mimeType: "image/png",
        sizeInBytes: 100,
      });

      vi.mocked(S3Upload.listS3Objects).mockResolvedValue(
        ok({
          objects: [{ key: "images/blog/a.png", size: 100, lastModified: "" }],
          prefixes: [],
          isTruncated: false,
        }),
      );

      const result = await MediaService.listExternalDirectory(adminContext, {
        providerId: "s3",
        folder: "images/blog",
      });
      expect(result.files).toHaveLength(1);
      expect(result.files[0].key).toBe("images/blog/a.png");
    });

    it("should surface listing errors", async () => {
      vi.mocked(S3Upload.listS3Objects).mockResolvedValue(
        err({ reason: "S3_LIST_FAILED", message: "boom" }),
      );

      const result = await MediaService.listExternalDirectory(adminContext, {
        providerId: "s3",
        folder: "",
      });
      expect(result.error).toBe("boom");
    });
  });

  // ============================================
  // 涓婁紶 (Upload 鈥?WYSIWYG destination)
  // ============================================
  describe("upload", () => {
    it("should upload into the exact folder being viewed (no pathPrefix prepending)", async () => {
      const file = new File(["s3 content"], "upload.png", {
        type: "image/png",
      });

      const result = await MediaService.uploadToProvider(
        adminContext,
        { providerId: "s3", folder: "images/blog" },
        file,
      );
      expect(result.error).toBeNull();

      // The uploader receives the EXACT folder being viewed (WYSIWYG) —
      // no pathPrefix prepending, no double "images/blog/images".
      const capturedFolder = vi.mocked(S3Upload.uploadToS3ForMediaLibrary)
        .mock.calls[0][2];
      expect(capturedFolder).toBe("images/blog");

      // D1 record stores the same full key the uploader returned
      const storedKey = "images/blog/mock-1.png";
      const stored = await MediaRepo.getMediaByKey(
        adminContext.db,
        storedKey,
      );
      expect(stored).toBeDefined();
      expect(stored?.provider).toBe("s3");
      expect(stored?.key).not.toContain("images/blog/images");
      expect(stored?.url).toBe(`${PUBLIC_URL}/images/blog/mock-1.png`);
    });
  });

  // ============================================
  // 鍒犻櫎 (Delete 鈥?real storage + D1)
  // ============================================
  describe("delete", () => {
    it("should delete the real S3 object and the D1 record with the SAME key", async () => {
      await MediaRepo.insertMedia(adminContext.db, {
        provider: "s3",
        key: "images/blog/doomed.png",
        url: `${PUBLIC_URL}/images/blog/doomed.png`,
        fileName: "doomed.png",
        mimeType: "image/png",
        sizeInBytes: 10,
      });

      const result = await MediaService.deleteExternalFiles(adminContext, {
        providerId: "s3",
        keys: ["images/blog/doomed.png"],
      });
      expect(result.deleted).toBe(1);

      // Real storage receives the exact full key (no double pathPrefix)
      expect(S3Upload.deleteS3Objects).toHaveBeenCalledWith(
        expect.objectContaining({ bucket: "my-bucket" }),
        ["images/blog/doomed.png"],
      );

      const stored = await MediaRepo.getMediaByKey(
        adminContext.db,
        "images/blog/doomed.png",
      );
      expect(stored).toBeUndefined();
    });

    it("should delete unlinked files + folder markers, keep linked files", async () => {
      await MediaRepo.insertMedia(adminContext.db, {
        provider: "s3",
        key: "images/blog/free.png",
        url: `${PUBLIC_URL}/images/blog/free.png`,
        fileName: "free.png",
        mimeType: "image/png",
        sizeInBytes: 10,
      });
      const linked = await MediaRepo.insertMedia(adminContext.db, {
        provider: "s3",
        key: "images/blog/linked.png",
        url: `${PUBLIC_URL}/images/blog/linked.png`,
        fileName: "linked.png",
        mimeType: "image/png",
        sizeInBytes: 10,
      });

      const { id: postId } = await PostService.createEmptyPost(adminContext);
      // Link the S3 media to the post directly (post-media extraction only
      // maps /images/ R2 URLs, so we insert the relation ourselves).
      await adminContext.db
        .insert(PostMediaTable)
        .values({ postId, mediaId: linked.id });

      vi.mocked(S3Upload.listAllS3Keys).mockResolvedValue(
        ok([
          "images/blog/",
          "images/blog/free.png",
          "images/blog/linked.png",
        ]),
      );

      const result = unwrap(
        await MediaService.deleteFolders(adminContext, {
          keys: ["images/blog/"],
          providerId: "s3",
        }),
      );
      expect(result).toEqual({
        deletedFolders: 1,
        deletedFiles: 1,
        skippedFiles: 1,
      });

      const deletedKeys = vi.mocked(S3Upload.deleteS3Objects).mock.calls[0][1];
      expect(deletedKeys.sort()).toEqual([
        "images/blog/",
        "images/blog/free.png",
      ]);

      expect(
        await MediaRepo.getMediaByKey(adminContext.db, "images/blog/free.png"),
      ).toBeUndefined();
      expect(
        await MediaRepo.getMediaByKey(adminContext.db, "images/blog/linked.png"),
      ).toBeDefined();
    });
  });

  // ============================================
  // 閲嶅懡鍚?/ 绉诲姩 (Rename / Move)
  // ============================================
  describe("rename & move", () => {
    it("should rename the real object and rewrite the D1 record", async () => {
      await MediaRepo.insertMedia(adminContext.db, {
        provider: "s3",
        key: "images/blog/old.png",
        url: `${PUBLIC_URL}/images/blog/old.png`,
        fileName: "old.png",
        mimeType: "image/png",
        sizeInBytes: 10,
      });

      unwrap(
        await MediaService.updateMediaName(adminContext, {
          key: "images/blog/old.png",
          name: "new.png",
          providerId: "s3",
        }),
      );

      expect(S3Upload.renameS3Object).toHaveBeenCalledWith(
        expect.objectContaining({ bucket: "my-bucket" }),
        "images/blog/old.png",
        "images/blog/new.png",
      );

      const updated = await MediaRepo.getMediaByKey(
        adminContext.db,
        "images/blog/new.png",
      );
      expect(updated).toBeDefined();
      expect(updated?.fileName).toBe("new.png");
      expect(updated?.url).toBe(`${PUBLIC_URL}/images/blog/new.png`);
    });

    it("should move the real object to the target folder", async () => {
      await MediaRepo.insertMedia(adminContext.db, {
        provider: "s3",
        key: "images/blog/moveme.png",
        url: `${PUBLIC_URL}/images/blog/moveme.png`,
        fileName: "moveme.png",
        mimeType: "image/png",
        sizeInBytes: 10,
      });

      unwrap(
        await MediaService.moveMediaFile(adminContext, {
          key: "images/blog/moveme.png",
          targetFolder: "assets",
          providerId: "s3",
        }),
      );

      expect(S3Upload.moveS3Object).toHaveBeenCalledWith(
        expect.objectContaining({ bucket: "my-bucket" }),
        "images/blog/moveme.png",
        "assets/moveme.png",
      );

      const updated = await MediaRepo.getMediaByKey(
        adminContext.db,
        "assets/moveme.png",
      );
      expect(updated).toBeDefined();
      expect(updated?.url).toBe(`${PUBLIC_URL}/assets/moveme.png`);
    });

    it("should rename a folder in real storage and rewrite D1 keys + urls", async () => {
      await MediaRepo.insertMedia(adminContext.db, {
        provider: "s3",
        key: "images/blog/nested/deep.png",
        url: `${PUBLIC_URL}/images/blog/nested/deep.png`,
        fileName: "deep.png",
        mimeType: "image/png",
        sizeInBytes: 10,
      });

      vi.mocked(S3Upload.listAllS3Keys).mockResolvedValue(
        ok(["images/blog/nested/", "images/blog/nested/deep.png"]),
      );

      const result = unwrap(
        await MediaService.renameFolder(adminContext, {
          key: "images/blog/nested/",
          name: "renamed",
          providerId: "s3",
        }),
      );
      expect(result.key).toBe("images/blog/renamed/");

      expect(S3Upload.moveS3Objects).toHaveBeenCalledWith(
        expect.objectContaining({ bucket: "my-bucket" }),
        [
          { oldKey: "images/blog/nested/", newKey: "images/blog/renamed/" },
          {
            oldKey: "images/blog/nested/deep.png",
            newKey: "images/blog/renamed/deep.png",
          },
        ],
      );

      const updated = await MediaRepo.getMediaByKey(
        adminContext.db,
        "images/blog/renamed/deep.png",
      );
      expect(updated).toBeDefined();
      expect(updated?.url).toBe(`${PUBLIC_URL}/images/blog/renamed/deep.png`);
    });
  });

  // ============================================
  // 鏂板缓鏂囦欢澶?(Create folder 鈥?real marker object)
  // ============================================
  describe("create folder", () => {
    it("should create a real folder marker at the exact path", async () => {
      const result = unwrap(
        await MediaService.createExternalFolder(adminContext, {
          providerId: "s3",
          name: "newdir",
          parent: "images/blog",
        }),
      );
      expect(result).toEqual({ key: "images/blog/newdir/", name: "newdir" });

      const captured = vi.mocked(S3Upload.uploadToS3).mock.calls[0][1];
      expect(captured.key).toBe("images/blog/newdir/");
    });
  });
});

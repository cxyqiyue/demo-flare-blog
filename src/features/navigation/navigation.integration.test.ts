import { beforeEach, describe, expect, it } from "vitest";
import * as NavigationService from "./navigation.service";
import { app } from "@/lib/hono";
import { createAdminTestContext, testRequest } from "tests/test-utils";

describe("NavigationService", () => {
  let adminContext: ReturnType<typeof createAdminTestContext>;

  beforeEach(() => {
    adminContext = createAdminTestContext();
  });

  describe("Public Data", () => {
    it("should return seeded search engines with Bing as default", async () => {
      const data = await NavigationService.getNavigationPublicData(adminContext);

      expect(data.engines.length).toBeGreaterThanOrEqual(14);
      const bing = data.engines.find(
        (engine) => engine.domain === "www.bing.com",
      );
      expect(bing).toBeDefined();
      expect(bing?.isDefault).toBe(true);
    });

    it("should only return enabled search engines", async () => {
      const engine = await NavigationService.createSearchEngine(adminContext, {
        name: "Disabled Engine",
        urlTemplate: "https://disabled.example.com/?q={query}",
        domain: "disabled.example.com",
        enabled: false,
      });
      expect(engine.data).toBeDefined();

      const data = await NavigationService.getNavigationPublicData(adminContext);
      expect(
        data.engines.find((e) => e.domain === "disabled.example.com"),
      ).toBeUndefined();
    });

    it("should never expose folders or bookmarks to the public", async () => {
      await NavigationService.createFolder(adminContext, { name: "Secret" });
      await NavigationService.createBookmark(adminContext, {
        name: "Secret Bookmark",
        url: "https://secret.example.com",
      });

      const data = await NavigationService.getNavigationPublicData(adminContext);
      expect("folders" in data).toBe(false);
      expect("bookmarks" in data).toBe(false);
    });
  });

  describe("Admin Data", () => {
    it("should return all engines including disabled ones", async () => {
      await NavigationService.createSearchEngine(adminContext, {
        name: "Disabled Engine",
        urlTemplate: "https://disabled.example.com/?q={query}",
        domain: "disabled.example.com",
        enabled: false,
      });

      const data = await NavigationService.getAdminNavigationData(adminContext);
      const disabled = data.engines.find(
        (engine) => engine.domain === "disabled.example.com",
      );
      expect(disabled).toBeDefined();
      expect(disabled?.enabled).toBe(false);
    });

    it("should return folders and bookmarks", async () => {
      const folder = await NavigationService.createFolder(adminContext, {
        name: "Dev Tools",
      });
      await NavigationService.createBookmark(adminContext, {
        name: "GitHub",
        url: "https://github.com",
        folderId: folder.data!.id,
      });

      const data = await NavigationService.getAdminNavigationData(adminContext);
      const devFolder = data.folders.find((f) => f.name === "Dev Tools");
      expect(devFolder?.bookmarkCount).toBe(1);
      expect(data.bookmarks).toHaveLength(1);
      expect(data.bookmarks[0].name).toBe("GitHub");
    });
  });

  describe("Search Engines", () => {
    it("should create a search engine", async () => {
      const result = await NavigationService.createSearchEngine(adminContext, {
        name: "Test Engine",
        urlTemplate: "https://test.com/?q={query}",
        domain: "test.com",
      });

      expect(result.data?.name).toBe("Test Engine");
      expect(result.data?.isDefault).toBe(false);
    });

    it("should set the default engine and clear the previous one", async () => {
      const created = await NavigationService.createSearchEngine(adminContext, {
        name: "New Default",
        urlTemplate: "https://newdefault.com/?q={query}",
        domain: "newdefault.com",
      });

      const result = await NavigationService.setDefaultSearchEngine(adminContext, {
        id: created.data!.id,
      });
      expect(result.data?.isDefault).toBe(true);

      const data = await NavigationService.getNavigationPublicData(adminContext);
      const defaults = data.engines.filter((engine) => engine.isDefault);
      expect(defaults).toHaveLength(1);
      expect(defaults[0].domain).toBe("newdefault.com");
    });

    it("should partially update a search engine", async () => {
      const created = await NavigationService.createSearchEngine(adminContext, {
        name: "Original",
        urlTemplate: "https://original.com/?q={query}",
        domain: "original.com",
      });

      const updated = await NavigationService.updateSearchEngine(adminContext, {
        id: created.data!.id,
        name: "Renamed",
        enabled: false,
      });

      expect(updated.data?.name).toBe("Renamed");
      expect(updated.data?.enabled).toBe(false);
      expect(updated.data?.urlTemplate).toBe("https://original.com/?q={query}");
    });

    it("should promote the first remaining engine when default is deleted", async () => {
      const created = await NavigationService.createSearchEngine(adminContext, {
        name: "Temp Default",
        urlTemplate: "https://tempdefault.com/?q={query}",
        domain: "tempdefault.com",
        isDefault: true,
      });

      const result = await NavigationService.deleteSearchEngine(adminContext, {
        id: created.data!.id,
      });
      expect(result.data?.success).toBe(true);

      const data = await NavigationService.getNavigationPublicData(adminContext);
      const defaults = data.engines.filter((engine) => engine.isDefault);
      expect(defaults).toHaveLength(1);
    });

    it("should return NOT_FOUND for deleting a non-existent engine", async () => {
      const result = await NavigationService.deleteSearchEngine(adminContext, {
        id: 999999,
      });
      expect(result.error?.reason).toBe("NOT_FOUND");
    });

    it("should refuse to unset default when it is the only engine", async () => {
      // Delete all seeded engines first
      const data = await NavigationService.getAdminNavigationData(adminContext);
      for (const engine of data.engines) {
        await NavigationService.deleteSearchEngine(adminContext, { id: engine.id });
      }

      const only = await NavigationService.createSearchEngine(adminContext, {
        name: "Only One",
        urlTemplate: "https://onlyone.com/?q={query}",
        domain: "onlyone.com",
      });
      expect(only.data?.isDefault).toBe(true);

      const result = await NavigationService.updateSearchEngine(adminContext, {
        id: only.data!.id,
        isDefault: false,
      });
      expect(result.error?.reason).toBe("LAST_DEFAULT_ENGINE");
    });
  });

  describe("Folders & Bookmarks", () => {
    it("should create folder and bookmark with folder count", async () => {
      const folder = await NavigationService.createFolder(adminContext, {
        name: "Dev Tools",
      });
      const bookmark = await NavigationService.createBookmark(adminContext, {
        name: "GitHub",
        url: "https://github.com",
        folderId: folder.data!.id,
      });

      expect(bookmark.data?.name).toBe("GitHub");

      const data = await NavigationService.getAdminNavigationData(adminContext);
      const devFolder = data.folders.find((f) => f.name === "Dev Tools");
      expect(devFolder?.bookmarkCount).toBe(1);
      expect(data.bookmarks).toHaveLength(1);
      expect(data.bookmarks[0].folderId).toBe(folder.data!.id);
    });

    it("should update folder and bookmark", async () => {
      const folder = await NavigationService.createFolder(adminContext, {
        name: "Old Name",
      });
      const bookmark = await NavigationService.createBookmark(adminContext, {
        name: "Old Bookmark",
        url: "https://old.com",
        folderId: folder.data!.id,
      });

      const updatedFolder = await NavigationService.updateFolder(adminContext, {
        id: folder.data!.id,
        name: "New Name",
      });
      const updatedBookmark = await NavigationService.updateBookmark(adminContext, {
        id: bookmark.data!.id,
        name: "New Bookmark",
        url: "https://new.com",
      });

      expect(updatedFolder.data?.name).toBe("New Name");
      expect(updatedBookmark.data?.name).toBe("New Bookmark");
      expect(updatedBookmark.data?.url).toBe("https://new.com");
    });

    it("should delete a bookmark", async () => {
      const bookmark = await NavigationService.createBookmark(adminContext, {
        name: "To Delete",
        url: "https://todelete.com",
      });

      const result = await NavigationService.deleteBookmark(adminContext, {
        id: bookmark.data!.id,
      });
      expect(result.data?.success).toBe(true);

      const data = await NavigationService.getAdminNavigationData(adminContext);
      expect(data.bookmarks).toHaveLength(0);
    });

    it("should delete a folder and cascade its bookmarks", async () => {
      const folder = await NavigationService.createFolder(adminContext, {
        name: "Doomed",
      });
      await NavigationService.createBookmark(adminContext, {
        name: "Inside",
        url: "https://inside.com",
        folderId: folder.data!.id,
      });

      const result = await NavigationService.deleteFolder(adminContext, {
        id: folder.data!.id,
      });
      expect(result.data?.success).toBe(true);

      const data = await NavigationService.getAdminNavigationData(adminContext);
      expect(data.folders.find((f) => f.id === folder.data!.id)).toBeUndefined();
      expect(data.bookmarks).toHaveLength(0);
    });
  });

  describe("Batch Delete", () => {
    it("should delete multiple bookmarks at once", async () => {
      const ids = [];
      for (let i = 0; i < 3; i++) {
        const result = await NavigationService.createBookmark(adminContext, {
          name: `Bookmark ${i}`,
          url: `https://site${i}.com`,
        });
        ids.push(result.data!.id);
      }

      const result = await NavigationService.deleteBookmarks(adminContext, {
        ids: [ids[0], ids[2]],
      });
      expect(result.data?.deleted).toBe(2);

      const data = await NavigationService.getAdminNavigationData(adminContext);
      expect(data.bookmarks).toHaveLength(1);
      expect(data.bookmarks[0].id).toBe(ids[1]);
    });

    it("should delete multiple folders and cascade their bookmarks", async () => {
      const folderIds = [];
      for (let i = 0; i < 2; i++) {
        const folder = await NavigationService.createFolder(adminContext, {
          name: `Folder ${i}`,
        });
        folderIds.push(folder.data!.id);
        await NavigationService.createBookmark(adminContext, {
          name: `Bookmark ${i}`,
          url: `https://folder${i}.com`,
          folderId: folder.data!.id,
        });
      }
      await NavigationService.createBookmark(adminContext, {
        name: "Uncategorized",
        url: "https://loose.com",
      });

      const result = await NavigationService.deleteFolders(adminContext, {
        ids: folderIds,
      });
      expect(result.data?.deleted).toBe(2);

      const data = await NavigationService.getAdminNavigationData(adminContext);
      expect(data.folders).toHaveLength(0);
      expect(data.bookmarks).toHaveLength(1);
      expect(data.bookmarks[0].name).toBe("Uncategorized");
    });
  });

  describe("Import", () => {
    it("should import bookmarks grouped into folders", async () => {
      const result = await NavigationService.importBookmarks(adminContext, {
        items: [
          {
            folderName: "News",
            bookmarks: [
              { name: "BBC", url: "https://www.bbc.com" },
              { name: "CNN", url: "https://www.cnn.com" },
            ],
          },
          {
            bookmarks: [{ name: "GitHub", url: "https://github.com" }],
          },
        ],
        replace: false,
      });

      expect(result.data?.imported).toBe(3);

      const data = await NavigationService.getAdminNavigationData(adminContext);
      const news = data.folders.find((f) => f.name === "News");
      expect(news?.bookmarkCount).toBe(2);
      expect(data.bookmarks.some((b) => b.folderId === null)).toBe(true);
    });

    it("should not create duplicate folders when folder name already exists", async () => {
      const folder = await NavigationService.createFolder(adminContext, {
        name: "Existing",
      });

      await NavigationService.importBookmarks(adminContext, {
        items: [
          {
            folderName: "Existing",
            bookmarks: [{ name: "Site", url: "https://site.com" }],
          },
        ],
        replace: false,
      });

      const data = await NavigationService.getAdminNavigationData(adminContext);
      const existing = data.folders.filter((f) => f.name === "Existing");
      expect(existing).toHaveLength(1);
      expect(existing[0].id).toBe(folder.data!.id);
      expect(existing[0].bookmarkCount).toBe(1);
    });

    it("should replace all existing data when replace is true", async () => {
      await NavigationService.createFolder(adminContext, { name: "Old Folder" });
      await NavigationService.createBookmark(adminContext, {
        name: "Old Bookmark",
        url: "https://old.com",
      });

      await NavigationService.importBookmarks(adminContext, {
        items: [
          {
            folderName: "Fresh",
            bookmarks: [{ name: "Fresh", url: "https://fresh.com" }],
          },
        ],
        replace: true,
      });

      const data = await NavigationService.getAdminNavigationData(adminContext);
      expect(data.folders).toHaveLength(1);
      expect(data.folders[0].name).toBe("Fresh");
      expect(data.bookmarks).toHaveLength(1);
      expect(data.bookmarks[0].name).toBe("Fresh");
    });
  });
});

describe("Navigation Favicon Route", () => {
  it("returns 400 when domain is missing", async () => {
    const res = await testRequest(app, "/api/navigation/favicon");
    expect(res.status).toBe(400);
  });

  it("returns 400 for an invalid domain", async () => {
    const res = await testRequest(app, "/api/navigation/favicon?domain=bad%20domain");
    expect(res.status).toBe(400);
  });
});

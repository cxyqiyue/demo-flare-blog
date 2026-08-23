import { useMemo, useState } from "react";
import type { NavigationPublicData } from "../navigation.schema";

type Folder = NavigationPublicData["folders"][number];
type Bookmark = NavigationPublicData["bookmarks"][number];

/** 当前层级网格里的一项：文件夹卡片或书签卡片 */
export type NavigationGridItem =
  | { kind: "folder"; folder: Folder }
  | { kind: "bookmark"; bookmark: Bookmark };

/**
 * 导航页共享交互状态：引擎切换、搜索提交、目录式浏览（进入文件夹/返回根目录）、
 * 同级内容按屏幕度量自动分页。
 * 双主题页面组件通过此 hook 保持一致的交互逻辑。
 *
 * 根目录 = 文件夹卡片（按 sortOrder）+ 未分类书签卡片；
 * 进入文件夹后 = 该文件夹内的书签卡片。每层独立分页。
 */
export function useNavigationPageState(
  data: NavigationPublicData,
  pageSize: number,
) {
  const engines = data.engines;
  const defaultEngine =
    engines.find((engine) => engine.isDefault) ?? engines[0];

  const [selectedEngineId, setSelectedEngineId] = useState<number | undefined>(
    defaultEngine?.id,
  );
  const [query, setQuery] = useState("");
  const [activeFolderId, setActiveFolderId] = useState<number | null>(null);
  const [page, setPage] = useState(1);

  const selectedEngine =
    engines.find((engine) => engine.id === selectedEngineId) ??
    defaultEngine ??
    engines[0];

  /** 当前层级的全部条目（未分页） */
  const levelItems = useMemo<NavigationGridItem[]>(() => {
    const sortedBookmarks = [...data.bookmarks].sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );
    if (activeFolderId === null) {
      const folders = [...data.folders]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((folder): NavigationGridItem => ({ kind: "folder", folder }));
      const uncategorized = sortedBookmarks
        .filter((bookmark) => bookmark.folderId === null)
        .map((bookmark): NavigationGridItem => ({ kind: "bookmark", bookmark }));
      return [...folders, ...uncategorized];
    }
    return sortedBookmarks
      .filter((bookmark) => bookmark.folderId === activeFolderId)
      .map((bookmark): NavigationGridItem => ({ kind: "bookmark", bookmark }));
  }, [data.folders, data.bookmarks, activeFolderId]);

  const currentFolder =
    activeFolderId === null
      ? null
      : (data.folders.find((folder) => folder.id === activeFolderId) ?? null);

  // 目录切换或 pageSize 变化时收敛页码，避免空页
  const total = levelItems.length;
  const effectivePageSize = Math.max(1, pageSize);
  const totalPages = Math.max(1, Math.ceil(total / effectivePageSize));
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const pageItems = levelItems.slice(
    (currentPage - 1) * effectivePageSize,
    currentPage * effectivePageSize,
  );

  const submitSearch = () => {
    const keyword = query.trim();
    if (!selectedEngine || !keyword) return;
    const url = selectedEngine.urlTemplate.replace(
      "{query}",
      encodeURIComponent(keyword),
    );
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const selectEngine = (id: number) => {
    setSelectedEngineId(id);
  };

  const enterFolder = (folderId: number) => {
    setActiveFolderId(folderId);
    setPage(1);
  };

  const backToRoot = () => {
    setActiveFolderId(null);
    setPage(1);
  };

  return {
    engines,
    selectedEngine,
    selectEngine,
    query,
    setQuery,
    submitSearch,
    folders: data.folders,
    bookmarks: data.bookmarks,
    currentFolder,
    enterFolder,
    backToRoot,
    pageItems,
    page: currentPage,
    pageSize: effectivePageSize,
    total,
    hasPrevPage: currentPage > 1,
    hasNextPage: currentPage < totalPages,
    onPageChange: setPage,
  };
}

export type NavigationPageState = ReturnType<typeof useNavigationPageState>;

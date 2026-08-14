import { useMemo, useState } from "react";
import type { NavigationPublicData } from "../navigation.schema";

const BOOKMARKS_PER_PAGE = 12;

/**
 * 导航页共享交互状态：引擎切换、搜索提交、文件夹筛选、书签分页。
 * 双主题页面组件通过此 hook 保持一致的交互逻辑。
 */
export function useNavigationPageState(data: NavigationPublicData) {
  const engines = data.engines;
  const defaultEngine = engines.find((engine) => engine.isDefault) ?? engines[0];

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

  const filteredBookmarks = useMemo(() => {
    if (activeFolderId === null) return data.bookmarks;
    return data.bookmarks.filter(
      (bookmark) => bookmark.folderId === activeFolderId,
    );
  }, [data.bookmarks, activeFolderId]);

  const total = filteredBookmarks.length;
  const totalPages = Math.max(1, Math.ceil(total / BOOKMARKS_PER_PAGE));
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const pageItems = filteredBookmarks.slice(
    (currentPage - 1) * BOOKMARKS_PER_PAGE,
    currentPage * BOOKMARKS_PER_PAGE,
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

  const selectFolder = (folderId: number | null) => {
    setActiveFolderId(folderId);
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
    activeFolderId,
    selectFolder,
    totalBookmarks: data.bookmarks.length,
    pageItems,
    page: currentPage,
    pageSize: BOOKMARKS_PER_PAGE,
    total,
    hasPrevPage: currentPage > 1,
    hasNextPage: currentPage < totalPages,
    onPageChange: setPage,
  };
}

export type NavigationPageState = ReturnType<typeof useNavigationPageState>;

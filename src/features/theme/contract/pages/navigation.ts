import type { NavigationPublicData } from "@/features/navigation/navigation.schema";

export interface NavigationPageProps {
  /** 导航页数据（引擎、文件夹、书签；非管理员浏览时仅包含引擎） */
  data: NavigationPublicData;
  /** 当前浏览者是否为管理员（用于展示管理入口提示） */
  isAdmin: boolean;
  /** 是否展示书签区域（书签仅管理员可见，数据加载完成后为 true） */
  showBookmarks: boolean;
}

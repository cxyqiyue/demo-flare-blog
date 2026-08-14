import type { NavigationPublicData } from "@/features/navigation/navigation.schema";

export interface NavigationPageProps {
  /** 导航页公开数据（引擎、文件夹、书签） */
  data: NavigationPublicData;
  /** 当前浏览者是否为管理员（用于展示管理入口提示） */
  isAdmin: boolean;
}

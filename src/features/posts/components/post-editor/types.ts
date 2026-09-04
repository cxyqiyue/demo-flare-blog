import type { JSONContent } from "@tiptap/react";
import type { PostStatus, PostVisibility } from "@/lib/db/schema";

export interface PostEditorData {
  title: string;
  summary: string;
  slug: string;
  status: PostStatus;
  readTimeInMinutes: number;
  contentJson: JSONContent | null;
  publishedAt: Date | null;
  pinnedAt: Date | null;
  tagIds: Array<number>;
  skillId: number | null;
  /** 作者用户 ID（超级管理员可修改归属；普通管理员只读） */
  authorId: string | null;
  /** 作者昵称（由 authorId 实时派生，用于展示） */
  author: string | null;
  isSynced: boolean;
  hasPublicCache: boolean;
  visibility: PostVisibility;
  /** 明文访问密码（仅编辑器内持有，服务端加密后落库） */
  password: string;
  passwordChannel: string;
  /** 密码获取提示（可选填写的文本提示，前台密码弹窗展示） */
  passwordHint: string;
}

export interface PostEditorProps {
  initialData: PostEditorData & { id: number };
  /** 当前登录用户是否为超级管理员（决定作者字段是否可编辑） */
  canEditAuthor?: boolean;
  /** 可选：可被选为作者的账号列表（由服务端提供，供超级管理员选择） */
  authorCandidates?: Array<{ id: string; name: string; email: string }>;
  onSave: (data: PostEditorData) => Promise<void>;
}

export type SaveStatus = "SYNCED" | "SAVING" | "PENDING" | "ERROR";

export const defaultPostData: PostEditorData = {
  title: "",
  summary: "",
  slug: "",
  status: "draft",
  readTimeInMinutes: 1,
  contentJson: null,
  publishedAt: null,
  pinnedAt: null,
  tagIds: [],
  skillId: null,
  authorId: null,
  author: null,
  isSynced: true,
  hasPublicCache: false,
  visibility: "public",
  password: "",
  passwordChannel: "",
  passwordHint: "",
};

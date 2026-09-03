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
  isSynced: boolean;
  hasPublicCache: boolean;
  visibility: PostVisibility;
  /** 明文访问密码（仅编辑器内持有，服务端加密后落库） */
  password: string;
  passwordChannel: string;
}

export interface PostEditorProps {
  initialData: PostEditorData & { id: number };
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
  isSynced: true,
  hasPublicCache: false,
  visibility: "public",
  password: "",
  passwordChannel: "",
};

import type { FieldErrors, UseFormRegister } from "react-hook-form";
import type {
  FriendLinkWithUser,
  SubmitFriendLinkInput,
} from "@/features/friend-links/friend-links.schema";
import type { FriendLinksConfig } from "@/features/config/config.schema";

export interface FriendLinksPageProps {
  links: Array<Omit<FriendLinkWithUser, "createdAt" | "updatedAt">>;
  /** 本站信息（展示给申请者的博主/站点元信息） */
  siteInfo: NonNullable<FriendLinksConfig["siteInfo"]>;
  /** 申请须知（Markdown 文本，最多 5 条，按序逐行渲染） */
  applyRules: Array<{ id: string; content: string }>;
}

export interface MyFriendLink {
  id: number;
  siteName: string;
  siteUrl: string;
  status: "pending" | "approved" | "rejected";
  rejectionReason: string | null;
  createdAt: Date | string;
}

export interface FriendLinkSubmitFormData {
  register: UseFormRegister<SubmitFriendLinkInput>;
  errors: FieldErrors<SubmitFriendLinkInput>;
  handleSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>;
  isSubmitting: boolean;
}

export interface SubmitFriendLinkPageProps {
  myLinks: Array<MyFriendLink>;
  form: FriendLinkSubmitFormData;
}

import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddFriendLinkModal } from "@/features/friend-links/components/admin/add-friend-link-modal";
import { FriendLinkModerationTable } from "@/features/friend-links/components/admin/friend-link-moderation-table";
import { FriendLinksConfigEditor } from "@/features/friend-links/components/admin/friend-links-config-editor";
import { requireSuperAdminRoute } from "@/lib/auth/route-guards";
import type { FriendLinkStatus } from "@/lib/db/schema";
import { isFuwari } from "@/lib/theme-mode";
import { m } from "@/paraglide/messages";

const searchSchema = z.object({
  status: z
    .enum(["pending", "approved", "rejected", "ALL"])
    .optional()
    .default("pending")
    .catch("pending"),
  page: z.number().optional().default(1).catch(1),
});

export const Route = createFileRoute("/admin/friend-links/")({
  ssr: false,
  validateSearch: searchSchema,
  beforeLoad: requireSuperAdminRoute,
  component: FriendLinksAdminPage,
  loader: () => {
    return {
      title: m.friend_links_admin_title(),
    };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData?.title,
      },
    ],
  }),
});

function FuwariFriendLinksAdminPage({
  tabs,
  status,
  currentStatus,
  page,
  handleStatusChange,
  onAdd,
  showAddModal,
  onCloseAddModal,
}: {
  tabs: Array<{ key: string; label: string }>;
  status: string;
  currentStatus: FriendLinkStatus | undefined;
  page: number;
  handleStatusChange: (value: string) => void;
  onAdd: () => void;
  showAddModal: boolean;
  onCloseAddModal: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      {/* Header card: title + add button + status tabs */}
      <div className="fuwari-card-base p-4 sm:p-5 md:p-6 space-y-5 fuwari-onload-animation">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div className="ml-6 min-w-0">
            <h1 className="relative text-xl sm:text-2xl font-bold fuwari-text-90">
              <span
                className="absolute -left-4 top-[6px] w-1 h-5 rounded-md"
                style={{ backgroundColor: "var(--fuwari-primary)" }}
              />
              {m.friend_links_admin_title()}
            </h1>
            <p className="text-sm fuwari-text-50 mt-1.5">
              {m.friend_links_admin_tag()}
            </p>
          </div>

          <Button
            onClick={onAdd}
            className="h-10 px-4 text-sm font-bold active:scale-95 transition-all"
          >
            <Plus size={16} strokeWidth={1.5} className="mr-1.5" />
            {m.friend_links_add_btn()}
          </Button>
        </div>

        <Tabs value={status} onValueChange={handleStatusChange}>
          <TabsList className="no-scrollbar">
            {tabs.map((tab) => (
              <TabsTrigger key={tab.key} value={tab.key}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div
        className="fuwari-onload-animation"
        style={{ animationDelay: "100ms" }}
      >
        <FriendLinkModerationTable status={currentStatus} page={page} />
      </div>

      {/* 本站信息 & 申请须知 */}
      <section
        className="flex flex-col gap-4 fuwari-onload-animation"
        style={{ animationDelay: "180ms" }}
      >
        <div className="fuwari-card-base p-4 sm:p-5 md:p-6">
          <h2 className="relative text-lg font-bold fuwari-text-90 ml-6">
            <span
              className="absolute -left-4 top-[5.5px] w-1 h-4 rounded-md"
              style={{ backgroundColor: "var(--fuwari-primary)" }}
            />
            {m.friend_links_site_info_section_title()}
          </h2>
          <p className="text-sm fuwari-text-50 mt-1.5 ml-6">
            {m.friend_links_site_info_section_tag()}
          </p>
        </div>

        <FriendLinksConfigEditor />
      </section>

      {/* Add Friend Link Modal */}
      <AddFriendLinkModal isOpen={showAddModal} onClose={onCloseAddModal} />
    </div>
  );
}

function FriendLinksAdminPage() {
  const { status, page } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [showAddModal, setShowAddModal] = useState(false);

  const handleStatusChange = (newStatus: string) => {
    navigate({
      search: (prev: ReturnType<typeof Route.useSearch>) => ({
        ...prev,
        status: newStatus as FriendLinkStatus | "ALL",
        page: 1,
      }),
    });
  };

  const currentStatus: FriendLinkStatus | undefined =
    status === "ALL" ? undefined : status;

  const tabs = [
    { key: "pending", label: m.friend_links_tab_pending() },
    { key: "approved", label: m.friend_links_tab_approved() },
    { key: "rejected", label: m.friend_links_tab_rejected() },
    { key: "ALL", label: m.friend_links_tab_all() },
  ];

  if (isFuwari) {
    return (
      <FuwariFriendLinksAdminPage
        tabs={tabs}
        status={status}
        currentStatus={currentStatus}
        page={page}
        handleStatusChange={handleStatusChange}
        onAdd={() => setShowAddModal(true)}
        showAddModal={showAddModal}
        onCloseAddModal={() => setShowAddModal(false)}
      />
    );
  }

  return (
    <div className="space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 border-b border-border/30 pb-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-serif font-medium tracking-tight text-foreground">
            {m.friend_links_admin_title()}
          </h1>
          <div className="flex items-center gap-2">
            <p className="text-xs font-mono tracking-widest text-muted-foreground uppercase">
              {m.friend_links_admin_tag()}
            </p>
          </div>
        </div>

        <Button
          onClick={() => setShowAddModal(true)}
          className="rounded-none bg-foreground text-background hover:bg-foreground/90 font-mono text-[10px] uppercase tracking-widest h-9 px-4"
        >
          <Plus size={14} className="mr-2" />
          {m.friend_links_add_btn()}
        </Button>
      </div>

      <div className="space-y-8">
        {/* Navigation & Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <nav className="flex items-center gap-8 overflow-x-auto overscroll-x-contain no-scrollbar max-w-full">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => handleStatusChange(tab.key)}
                className={`
                  relative shrink-0 text-[10px] uppercase tracking-[0.2em] transition-all whitespace-nowrap font-mono
                  ${
                    status === tab.key
                      ? "text-foreground font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }
                `}
              >
                {status === tab.key ? `[ ${tab.label} ]` : tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content Area */}
        <div className="min-h-100">
          <FriendLinkModerationTable status={currentStatus} page={page} />
        </div>

        {/* 本站信息 & 申请须知 */}
        <div className="pt-14 border-t border-border/30">
          <div className="mb-8 space-y-1">
            <h2 className="font-serif text-2xl font-medium tracking-tight text-foreground">
              {m.friend_links_site_info_section_title()}
            </h2>
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              {m.friend_links_site_info_section_tag()}
            </p>
          </div>
          <FriendLinksConfigEditor />
        </div>
      </div>

      {/* Add Friend Link Modal */}
      <AddFriendLinkModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
      />
    </div>
  );
}

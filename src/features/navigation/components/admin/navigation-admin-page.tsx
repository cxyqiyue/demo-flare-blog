import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getNavigationOwnerAccountsFn } from "@/features/navigation/api/navigation.admin.api";
import { sessionQuery } from "@/features/auth/queries";
import { m } from "@/paraglide/messages";
import { BookmarkManager } from "./bookmark-manager";
import { EngineManager } from "./engine-manager";

export function NavigationAdminPage() {
  const [activeTab, setActiveTab] = useState<"engines" | "bookmarks">(
    "engines",
  );
  const [selectedOwnerId, setSelectedOwnerId] = useState<string | undefined>(
    undefined,
  );

  const { data: session } = useQuery(sessionQuery);
  const isSuperAdmin = session?.user.isSuperAdmin === true;
  const myId = session?.user.id;

  // 仅超管需要账号列表来切换查看账号；普通管理员始终管理自己账号
  const { data: ownerAccounts, isPending: accountsPending } = useQuery({
    queryKey: ["navigation", "owner-accounts"],
    queryFn: () => getNavigationOwnerAccountsFn(),
    enabled: isSuperAdmin,
  });

  const ownerId = isSuperAdmin ? selectedOwnerId : undefined;

  const tabs = [
    { key: "engines" as const, label: m.navigation_admin_tab_engines() },
    { key: "bookmarks" as const, label: m.navigation_admin_tab_bookmarks() },
  ];

  return (
    <div className="space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 border-b border-border/30 pb-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-serif font-medium tracking-tight text-foreground">
            {m.navigation_admin_title()}
          </h1>
          <div className="flex items-center gap-2">
            <p className="text-xs font-mono tracking-widest text-muted-foreground uppercase">
              {m.navigation_admin_tag()}
            </p>
          </div>
        </div>

        {/* 账号（owner）选择器：仅超管可见 */}
        {isSuperAdmin && (
          <div className="flex items-center gap-3">
            <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
              {m.navigation_admin_account_label()}
            </label>
            <select
              value={selectedOwnerId ?? myId ?? ""}
              onChange={(e) => {
                const value = e.target.value;
                if (value === "__self__") {
                  setSelectedOwnerId(undefined);
                } else {
                  setSelectedOwnerId(value);
                }
              }}
              className="bg-background border border-border/50 px-3 py-2 text-sm focus:border-foreground/60 focus:outline-none transition-colors min-w-52"
            >
              {accountsPending ? (
                <option value="">{m.navigation_admin_account_switch()}…</option>
              ) : (
                <>
                  <option value="__self__">
                    {m.navigation_admin_account_my()} ({myAccountName(ownerAccounts, myId)})
                  </option>
                  {ownerAccounts
                    ?.filter((account) => account.id !== myId)
                    .map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name} ({account.email})
                      </option>
                    ))}
                </>
              )}
            </select>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <nav className="flex items-center gap-8 overflow-x-auto overscroll-x-contain no-scrollbar max-w-full">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`
                relative shrink-0 text-[10px] uppercase tracking-[0.2em] transition-all whitespace-nowrap font-mono
                ${
                  activeTab === tab.key
                    ? "text-foreground font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }
              `}
            >
              {activeTab === tab.key ? `[ ${tab.label} ]` : tab.label}
            </button>
          ))}
        </nav>
        {ownerId && <span className="text-xs font-mono text-muted-foreground">→</span>}
      </div>

      {/* Content */}
      <div className="min-h-100">
        {activeTab === "engines" ? (
          <EngineManager ownerId={ownerId} />
        ) : (
          <BookmarkManager ownerId={ownerId} />
        )}
      </div>
    </div>
  );
}

function myAccountName(
  ownerAccounts: { id: string; name: string; email: string }[] | undefined,
  myId?: string,
): string {
  if (!myId) return "";
  const mine = ownerAccounts?.find((account) => account.id === myId);
  return mine ? `${mine.name}` : "";
}

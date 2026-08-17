import { useState } from "react";
import { m } from "@/paraglide/messages";
import { BookmarkManager } from "./bookmark-manager";
import { EngineManager } from "./engine-manager";

export function NavigationAdminPage() {
  const [activeTab, setActiveTab] = useState<"engines" | "bookmarks">(
    "engines",
  );

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
      </div>

      {/* Content */}
      <div className="min-h-100">
        {activeTab === "engines" ? <EngineManager /> : <BookmarkManager />}
      </div>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { UserManagementTable } from "@/features/users/components/admin/user-management-table";
import { requireSuperAdminRoute } from "@/lib/auth/route-guards";
import { m } from "@/paraglide/messages";

const searchSchema = z.object({
  search: z.string().optional(),
  page: z.number().optional().default(1).catch(1),
});

export const Route = createFileRoute("/admin/users/")({
  ssr: false,
  validateSearch: searchSchema,
  beforeLoad: requireSuperAdminRoute,
  component: UsersAdminPage,
  loader: () => {
    return {
      title: m.users_admin_title(),
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

function UsersAdminPage() {
  const { search, page } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [searchInput, setSearchInput] = useState(search || "");

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== search) {
        navigate({
          search: (prev: ReturnType<typeof Route.useSearch>) => ({
            ...prev,
            search: searchInput || undefined,
            page: 1, // Reset page on search
          }),
        });
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchInput, navigate, search]);

  return (
    <div className="space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 border-b border-border/30 pb-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-serif font-medium tracking-tight text-foreground">
            {m.users_admin_title()}
          </h1>
          <div className="flex items-center gap-2">
            <p className="text-xs font-mono tracking-widest text-muted-foreground uppercase">
              {m.users_admin_tag()}
            </p>
          </div>
        </div>

        {/* User Search */}
        <div className="relative w-full md:w-64 group">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground w-3.5 h-3.5 transition-colors group-focus-within:text-foreground" />
          <Input
            placeholder={m.users_search_placeholder()}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9 h-9 border-b border-border/50 bg-transparent rounded-none font-mono text-xs focus:border-foreground transition-all"
          />
        </div>
      </div>

      {/* Content Area */}
      <div className="min-h-100">
        <UserManagementTable search={search} page={page} />
      </div>
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import {
  Loader2,
  ShieldAlert,
  ShieldCheck,
  UserCog,
  UserX,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { Button } from "@/components/ui/button";
import ConfirmationModal from "@/components/ui/confirmation-modal";
import { formatDate } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { useAdminUsers } from "../../hooks/use-users";
import { adminUsersQuery } from "../../queries";
import type { UserAdminItem } from "../../users.schema";

interface UserManagementTableProps {
  search?: string;
  page?: number;
}

const PAGE_SIZE = 20;
const routeApi = getRouteApi("/admin/users/");

export const UserManagementTable = ({
  search,
  page = 1,
}: UserManagementTableProps) => {
  const navigate = routeApi.useNavigate();
  const {
    data: response,
    isLoading,
    isError,
  } = useQuery(
    adminUsersQuery({
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
      search,
    }),
  );

  if (isLoading) {
    return (
      <div className="py-24 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !response) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-muted-foreground font-serif italic gap-4 border-t border-border">
        <ShieldAlert size={40} strokeWidth={1} className="opacity-30" />
        <p>{m.users_admin_load_fail()}</p>
      </div>
    );
  }

  if (response.items.length === 0) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-muted-foreground font-serif italic gap-4 border-t border-border">
        <UserCog size={40} strokeWidth={1} className="opacity-20" />
        <p>{m.users_empty()}</p>
      </div>
    );
  }

  const totalPages = Math.ceil(response.total / PAGE_SIZE);

  return (
    <div className="space-y-6">
      {/* List Header (Desktop) */}
      <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 border-b border-border/30 items-center bg-muted/5">
        <div className="col-span-3 text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
          {m.users_th_user()}
        </div>
        <div className="col-span-2 text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
          {m.users_th_role()}
        </div>
        <div className="col-span-2 text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
          {m.users_th_status()}
        </div>
        <div className="col-span-1 text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
          {m.users_th_comments()}
        </div>
        <div className="col-span-2 text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
          {m.users_th_joined()}
        </div>
        <div className="col-span-2 text-right text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
          {m.users_th_actions()}
        </div>
      </div>

      {/* Items List */}
      <div className="divide-y divide-border/30">
        {response.items.map((item) => (
          <UserRow key={item.id} item={item} actor={response.currentUser} />
        ))}
      </div>

      {/* Pagination */}
      <div className="pt-12 px-2 border-t border-border/30">
        <AdminPagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={response.total}
          itemsPerPage={PAGE_SIZE}
          currentPageItemCount={response.items.length}
          onPageChange={(newPage) =>
            navigate({
              search: ((prev: Record<string, unknown>) => ({
                ...prev,
                page: newPage,
              })) as never,
            })
          }
        />
      </div>
    </div>
  );
};

// ============ Row ============

const UserRow = ({
  item,
  actor,
}: {
  item: UserAdminItem;
  actor: { id: string; isSuperAdmin: boolean };
}) => {
  const isSelf = item.id === actor.id;
  const actorIsSuper = actor.isSuperAdmin;

  const canManage =
    !item.isSuperAdmin && (actorIsSuper || item.role !== "admin");

  const [isOpen, setIsOpen] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showBanModal, setShowBanModal] = useState(false);
  const [showUnbanModal, setShowUnbanModal] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const { setRole, ban, unban, isSettingRole, isBanning, isUnbanning } =
    useAdminUsers();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isLoading = isSettingRole || isBanning || isUnbanning;
  const isAdmin = item.role === "admin";
  const isBanned = item.banned;

  return (
    <div
      ref={menuRef}
      className="group transition-all duration-500 hover:bg-muted/10"
    >
      {/* Desktop Row */}
      <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-6 items-center hover:bg-accent/5 transition-colors">
        <div className="col-span-3 flex items-center gap-3 overflow-hidden min-w-0">
          <div className="w-8 h-8 rounded-none bg-muted/20 flex items-center justify-center border border-border/30 shrink-0">
            {item.image ? (
              <img src={item.image} className="w-full h-full object-cover" />
            ) : (
              <span className="text-[10px] font-mono">
                {item.name.slice(0, 1) || "?"}
              </span>
            )}
          </div>
          <div className="min-w-0 space-y-0.5">
            <div className="text-xs font-serif font-medium truncate">
              {item.name}
              {isSelf && (
                <span className="ml-2 text-[9px] font-mono text-muted-foreground">
                  ({m.users_self()})
                </span>
              )}
            </div>
            <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest truncate">
              {item.email}
            </div>
          </div>
        </div>

        <div className="col-span-2">
          <RoleBadge isSuperAdmin={item.isSuperAdmin} isAdmin={isAdmin} />
        </div>

        <div className="col-span-2">
          <StatusBadge isBanned={isBanned} />
        </div>

        <div className="col-span-1 text-xs font-mono text-muted-foreground">
          {item.totalComments}
        </div>

        <div className="col-span-2 text-[10px] font-mono text-muted-foreground">
          {formatDate(item.createdAt).split(" ")[0]}
        </div>

        <div className="col-span-2 flex justify-end">
          <RowActions
            item={item}
            canManage={canManage}
            isOpen={isOpen}
            setIsOpen={setIsOpen}
            onRole={() => {
              setIsOpen(false);
              setShowRoleModal(true);
            }}
            onBan={() => {
              setIsOpen(false);
              setShowBanModal(true);
            }}
            onUnban={() => {
              setIsOpen(false);
              setShowUnbanModal(true);
            }}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* Mobile Row */}
      <div className="md:hidden p-6 space-y-4">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-none bg-muted flex items-center justify-center border border-border shrink-0">
              {item.image ? (
                <img src={item.image} className="w-full h-full object-cover" />
              ) : (
                <span className="text-[10px] font-mono">
                  {item.name.slice(0, 1) || "?"}
                </span>
              )}
            </div>
            <div>
              <div className="text-xs font-bold font-serif tracking-tight">
                {item.name}
              </div>
              <div className="text-[9px] font-mono text-muted-foreground uppercase">
                {item.email}
              </div>
            </div>
          </div>
          <StatusBadge isBanned={isBanned} />
        </div>

        <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
          <RoleBadge isSuperAdmin={item.isSuperAdmin} isAdmin={isAdmin} />
          <span>·</span>
          <span>{m.users_mobile_comments({ count: item.totalComments })}</span>
          <span>·</span>
          <span>{formatDate(item.createdAt).split(" ")[0]}</span>
        </div>

        <div className="flex justify-end pt-4 border-t border-border/30">
          <RowActions
            item={item}
            canManage={canManage}
            isOpen={isOpen}
            setIsOpen={setIsOpen}
            onRole={() => {
              setIsOpen(false);
              setShowRoleModal(true);
            }}
            onBan={() => {
              setIsOpen(false);
              setShowBanModal(true);
            }}
            onUnban={() => {
              setIsOpen(false);
              setShowUnbanModal(true);
            }}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* Role Modal */}
      <ConfirmationModal
        isOpen={showRoleModal}
        onClose={() => setShowRoleModal(false)}
        onConfirm={() => {
          setRole(
            {
              data: {
                userId: item.id,
                role: isAdmin ? "user" : "admin",
              },
            },
            { onSuccess: () => setShowRoleModal(false) },
          );
        }}
        title={isAdmin ? m.users_set_user_title() : m.users_set_admin_title()}
        message={
          isAdmin
            ? m.users_set_user_message({ name: item.name })
            : m.users_set_admin_message({ name: item.name })
        }
        confirmLabel={m.users_set_role_confirm()}
        isLoading={isSettingRole}
      />

      {/* Ban Modal */}
      <BanModal
        isOpen={showBanModal}
        onClose={() => setShowBanModal(false)}
        onConfirm={(reason) => {
          ban(
            { data: { userId: item.id, reason } },
            { onSuccess: () => setShowBanModal(false) },
          );
        }}
        isLoading={isBanning}
        userName={item.name}
      />

      {/* Unban Modal */}
      <ConfirmationModal
        isOpen={showUnbanModal}
        onClose={() => setShowUnbanModal(false)}
        onConfirm={() => {
          unban(
            { data: { userId: item.id } },
            { onSuccess: () => setShowUnbanModal(false) },
          );
        }}
        title={m.users_unban_modal_title()}
        message={m.users_unban_modal_desc({ name: item.name })}
        confirmLabel={m.users_unban_modal_confirm()}
        isLoading={isUnbanning}
      />
    </div>
  );
};

// ============ Actions Dropdown ============

const RowActions = ({
  item,
  canManage,
  isOpen,
  setIsOpen,
  onRole,
  onBan,
  onUnban,
  isLoading,
}: {
  item: UserAdminItem;
  canManage: boolean;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onRole: () => void;
  onBan: () => void;
  onUnban: () => void;
  isLoading: boolean;
}) => {
  if (!canManage) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-auto px-2 text-[10px] font-mono text-muted-foreground rounded-none pointer-events-none opacity-60"
      >
        <span>[ {m.users_protected()} ]</span>
      </Button>
    );
  }

  const isAdmin = item.role === "admin";
  const isBanned = item.banned;

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-auto px-2 text-[10px] font-mono text-muted-foreground hover:text-foreground rounded-none gap-1"
        disabled={isLoading}
        onClick={() => setIsOpen(!isOpen)}
        title={m.users_action_btn()}
      >
        {isLoading ? (
          <Loader2 size={12} className="animate-spin" />
        ) : (
          <span>[ {m.users_action_btn()} ]</span>
        )}
      </Button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-background border border-border/30 z-50 p-1 animate-in fade-in zoom-in-95 duration-200">
          <div className="space-y-0.5">
            <button
              onClick={onRole}
              className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-mono text-left hover:bg-muted/10 transition-colors text-foreground group"
            >
              <span>
                {isAdmin
                  ? m.users_action_set_user()
                  : m.users_action_set_admin()}
              </span>
              <ShieldCheck className="h-3 w-3 opacity-0 group-hover:opacity-100" />
            </button>
          </div>

          <div className="h-px bg-border/30 my-1" />

          {isBanned ? (
            <button
              onClick={onUnban}
              className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-mono text-left hover:bg-muted/10 transition-colors text-foreground group"
            >
              <span>{m.users_action_unban()}</span>
              <ShieldCheck className="h-3 w-3 opacity-0 group-hover:opacity-100" />
            </button>
          ) : (
            <button
              onClick={onBan}
              className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-mono text-left hover:bg-red-500/10 text-red-500 transition-colors group"
            >
              <span>{m.users_action_ban()}</span>
              <UserX className="h-3 w-3 opacity-0 group-hover:opacity-100" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ============ Badges ============

const RoleBadge = ({
  isSuperAdmin,
  isAdmin,
}: {
  isSuperAdmin: boolean;
  isAdmin: boolean;
}) => {
  if (isSuperAdmin) {
    return (
      <div className="font-mono text-[9px] uppercase tracking-widest text-amber-500">
        [{m.users_role_super()}]
      </div>
    );
  }
  return (
    <div
      className={`font-mono text-[9px] uppercase tracking-widest ${
        isAdmin ? "text-foreground" : "text-muted-foreground"
      }`}
    >
      [{isAdmin ? m.users_role_admin() : m.users_role_user()}]
    </div>
  );
};

const StatusBadge = ({ isBanned }: { isBanned: boolean }) => {
  return (
    <div
      className={`font-mono text-[9px] uppercase tracking-widest ${
        isBanned ? "text-red-500" : "text-foreground"
      }`}
    >
      [{isBanned ? m.users_status_banned() : m.users_status_active()}]
    </div>
  );
};

// ============ Ban Modal ============

const BanModal = ({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
  userName,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason?: string) => void;
  isLoading: boolean;
  userName: string;
}) => {
  const [reason, setReason] = useState("");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-background border border-border/30 p-8 max-w-md w-full mx-4 animate-in fade-in zoom-in-95 duration-200">
        <h3 className="text-lg font-serif font-medium mb-2">
          {m.users_ban_modal_title()}
        </h3>
        <p className="text-sm text-muted-foreground mb-6">
          {m.users_ban_modal_desc({ name: userName })}
        </p>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
              {m.users_ban_modal_label()}
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-transparent border border-border/50 px-3 py-2 text-sm font-sans focus:border-foreground focus:outline-none transition-colors resize-none"
              rows={3}
              placeholder={m.users_ban_modal_placeholder()}
              maxLength={500}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="ghost"
              onClick={onClose}
              className="font-mono text-[10px] uppercase tracking-widest rounded-none"
            >
              {m.common_cancel()}
            </Button>
            <Button
              onClick={() => onConfirm(reason || undefined)}
              disabled={isLoading}
              className="rounded-none bg-red-600 text-white hover:bg-red-700 font-mono text-[10px] uppercase tracking-widest"
            >
              {isLoading ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                m.users_ban_modal_confirm()
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

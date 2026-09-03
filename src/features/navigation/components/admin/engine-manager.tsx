import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import ConfirmationModal from "@/components/ui/confirmation-modal";
import { EngineFormModal } from "@/features/navigation/components/admin/navigation-modals";
import { useFaviconSource } from "@/features/navigation/components/favicon";
import {
  useAdminNavigation,
  useAdminNavigationData,
} from "@/features/navigation/hooks/use-navigation";
import type {
  CreateSearchEngineFormValues,
  NavigationPublicData,
} from "@/features/navigation/navigation.schema";
import { m } from "@/paraglide/messages";

type Engine = NavigationPublicData["engines"][number];

export function EngineManager({ ownerId }: { ownerId?: string }) {
  const { data, isPending } = useAdminNavigationData(ownerId);
  const { createEngine, updateEngine, deleteEngine, setDefaultEngine } =
    useAdminNavigation(ownerId);

  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Engine | null>(null);
  const [deleting, setDeleting] = useState<Engine | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const engines = data?.engines ?? [];

  const handleSetDefault = async (id: number) => {
    setBusyId(id);
    await setDefaultEngine({ data: { id } });
    setBusyId(null);
  };

  const handleToggleEnabled = async (engine: Engine) => {
    setBusyId(engine.id);
    await updateEngine({ data: { id: engine.id, enabled: !engine.enabled } });
    setBusyId(null);
  };

  const handleSubmit = async (
    input: CreateSearchEngineFormValues,
  ): Promise<boolean> => {
    const result = editing
      ? await updateEngine({ data: { id: editing.id, ...input } })
      : await createEngine({ data: input });
    return !!result.data;
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusyId(deleting.id);
    await deleteEngine({ data: { id: deleting.id } });
    setBusyId(null);
    setDeleting(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button
          onClick={() => setShowAdd(true)}
          className="rounded-none bg-foreground text-background hover:bg-foreground/90 font-mono text-xs uppercase tracking-widest gap-2"
        >
          <Plus size={14} />
          {m.navigation_admin_add_engine()}
        </Button>
      </div>

      <div className="border border-border/30 divide-y divide-border/30">
        {isPending ? (
          <div className="py-16 flex justify-center">
            <Loader2 className="animate-spin text-muted-foreground" size={24} />
          </div>
        ) : engines.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            {m.navigation_admin_empty_engines()}
          </div>
        ) : (
          engines.map((engine) => (
            <EngineRow
              key={engine.id}
              engine={engine}
              busy={busyId === engine.id}
              onEdit={() => setEditing(engine)}
              onDelete={() => setDeleting(engine)}
              onSetDefault={() => handleSetDefault(engine.id)}
              onToggleEnabled={() => handleToggleEnabled(engine)}
            />
          ))
        )}
      </div>

      <EngineFormModal
        isOpen={showAdd || editing !== null}
        onClose={() => {
          setShowAdd(false);
          setEditing(null);
        }}
        onSubmit={handleSubmit}
        initialData={editing ?? undefined}
        hasExisting={engines.length > 0}
      />

      <ConfirmationModal
        isOpen={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title={m.navigation_admin_confirm_delete_title()}
        message={m.navigation_admin_confirm_delete_desc()}
        confirmLabel={m.navigation_admin_confirm_delete()}
        isDanger
      />
    </div>
  );
}

interface EngineRowProps {
  engine: Engine;
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
  onToggleEnabled: () => void;
}

function EngineRow({
  engine,
  busy,
  onEdit,
  onDelete,
  onSetDefault,
  onToggleEnabled,
}: EngineRowProps) {
  const favicon = useFaviconSource(engine.domain, engine.iconUrl);

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 group hover:bg-muted/40 transition-colors">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-8 h-8 rounded-md overflow-hidden border border-border/40 flex items-center justify-center shrink-0">
          {favicon.hasIcon ? (
            <img
              src={favicon.src}
              alt=""
              className="w-full h-full object-cover"
              onError={favicon.onError}
            />
          ) : (
            <span className="text-[9px] font-medium text-muted-foreground">
              {engine.name.slice(0, 1)}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{engine.name}</span>
            {engine.isDefault && (
              <span className="shrink-0 text-[10px] font-mono uppercase tracking-wider border border-foreground/30 text-foreground px-1.5 py-0.5">
                {m.navigation_admin_engine_default()}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate font-mono">
            {engine.urlTemplate}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {busy ? (
          <Loader2 size={14} className="animate-spin text-muted-foreground" />
        ) : (
          <>
            {!engine.isDefault && (
              <button
                onClick={onSetDefault}
                className="hidden md:inline-flex text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground px-2 py-1 transition-colors"
              >
                {m.navigation_admin_engine_set_default()}
              </button>
            )}
            <Checkbox
              checked={engine.enabled}
              onCheckedChange={onToggleEnabled}
              title={m.navigation_field_enabled()}
            />
            <button
              onClick={onEdit}
              className="p-2 text-muted-foreground hover:text-foreground transition-colors"
              title={m.navigation_admin_edit()}
            >
              <Pencil size={13} strokeWidth={1.5} />
            </button>
            <button
              onClick={onDelete}
              className="p-2 text-muted-foreground hover:text-red-500 transition-colors"
              title={m.navigation_admin_delete()}
            >
              <Trash2 size={13} strokeWidth={1.5} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

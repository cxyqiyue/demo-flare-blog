import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Search, Wand2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import ConfirmationModal from "@/components/ui/confirmation-modal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createSkillFn,
  deleteSkillFn,
  importSkillsFn,
  updateSkillFn,
} from "@/features/skills/api/skills.api";
import {
  SKILLS_KEYS,
  skillsAdminQueryOptions,
} from "@/features/skills/queries";
import { m } from "@/paraglide/messages";

export function SkillManager() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [skillToDelete, setSkillToDelete] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [skillToEdit, setSkillToEdit] = useState<{
    id: number;
    name: string;
    description: string;
  } | null>(null);
  const [markdown, setMarkdown] = useState("");

  const queryClient = useQueryClient();

  const { data: skills = [], isLoading } = useQuery(skillsAdminQueryOptions());

  const filteredSkills = useMemo(() => {
    return skills.filter((skill) =>
      skill.name.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [skills, searchTerm]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: SKILLS_KEYS.admin });

  const createSkillMutation = useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      createSkillFn({
        data: { name: data.name, description: data.description },
      }),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(m.skills_manager_name_exists());
        return;
      }
      invalidate();
      setIsCreating(false);
      setNewName("");
      setNewDescription("");
      toast.success(m.skills_manager_created());
    },
  });

  const updateSkillMutation = useMutation({
    mutationFn: (data: { id: number; name?: string; description?: string }) =>
      updateSkillFn({
        data: {
          id: data.id,
          data: { name: data.name, description: data.description },
        },
      }),
    onSuccess: (result) => {
      if (result.error) {
        const reason = result.error.reason;
        switch (reason) {
          case "SKILL_NOT_FOUND":
            toast.error(m.skills_manager_not_found());
            return;
          case "SKILL_NAME_ALREADY_EXISTS":
            toast.error(m.skills_manager_name_exists());
            return;
          default: {
            reason satisfies never;
            toast.error(m.skills_manager_unknown_error());
            return;
          }
        }
      }
      invalidate();
      setSkillToEdit(null);
      toast.success(m.skills_manager_updated());
    },
  });

  const deleteSkillMutation = useMutation({
    mutationFn: (id: number) => deleteSkillFn({ data: { id } }),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(m.skills_manager_delete_fail());
        return;
      }
      invalidate();
      setSkillToDelete(null);
      toast.success(m.skills_manager_deleted());
    },
  });

  const importSkillMutation = useMutation({
    mutationFn: (markdownText: string) =>
      importSkillsFn({ data: { markdown: markdownText } }),
    onSuccess: (result) => {
      invalidate();
      setMarkdown("");
      toast.success(m.skills_manager_import_done(), {
        description: m.skills_manager_import_result({
          created: String(result.created),
          skipped: String(result.skipped.length),
        }),
      });
    },
    onError: () => {
      toast.error(m.skills_manager_import_error());
    },
  });

  const activeCount = skills.filter((skill) => skill.postCount > 0).length;
  const emptyCount = skills.filter((skill) => skill.postCount === 0).length;

  return (
    <div className="space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-border/30">
        <div className="space-y-1">
          <h1 className="text-3xl font-serif font-medium tracking-tight">
            {m.skills_manager_title()}
          </h1>
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
            {m.skills_manager_subtitle()}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="relative group w-full md:w-64">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-foreground transition-colors"
              size={14}
            />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={m.skills_manager_search_placeholder()}
              className="pl-9 h-9 bg-transparent border-b border-border/50 rounded-none focus:border-foreground focus:ring-0 pr-0 transition-all font-mono text-xs"
            />
          </div>
          <Button
            onClick={() => setIsCreating(true)}
            size="sm"
            className="h-9 px-4 text-[10px] uppercase tracking-[0.2em] font-medium rounded-none gap-2 bg-foreground text-background hover:bg-foreground/90"
          >
            <Wand2 size={12} />
            {m.skills_manager_new_skill()}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: m.skills_manager_stat_total(), value: skills.length },
          { label: m.skills_manager_stat_active(), value: activeCount },
          { label: m.skills_manager_stat_empty(), value: emptyCount },
        ].map((stat, i) => (
          <div
            key={i}
            className="p-6 border border-border/30 bg-background/50 hover:bg-accent/5 transition-colors group"
          >
            <div className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground font-mono mb-2 group-hover:text-foreground transition-colors">
              {stat.label}
            </div>
            <div className="text-3xl font-serif text-foreground">
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Create Row */}
      {isCreating && (
        <div className="space-y-3 border border-border/30 bg-muted/5 p-4 animate-in slide-in-from-top-2 duration-300">
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-sm font-mono text-emerald-500 font-bold">
              {">"}
            </span>
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
              {m.skills_manager_inline_new()}
            </span>
            <div className="flex-1">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={m.skills_manager_inline_placeholder()}
                className="w-full bg-transparent border-none outline-none font-mono text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={createSkillMutation.isPending || !newName.trim()}
                onClick={() =>
                  createSkillMutation.mutate({
                    name: newName.trim(),
                    description: newDescription.trim() || undefined,
                  })
                }
                className="h-8 text-[10px] uppercase font-mono tracking-widest hover:text-emerald-500 hover:bg-emerald-500/10 rounded-none"
              >
                {createSkillMutation.isPending
                  ? m.skills_manager_inline_creating()
                  : `[ ${m.skills_manager_inline_confirm()} ]`}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setIsCreating(false);
                  setNewName("");
                  setNewDescription("");
                }}
                className="h-8 text-[10px] uppercase font-mono tracking-widest text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-none"
              >
                [ {m.skills_manager_inline_cancel()} ]
              </Button>
            </div>
          </div>
          <input
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder={m.skills_manager_inline_desc_placeholder()}
            className="w-full bg-transparent border-none outline-none font-mono text-xs text-muted-foreground"
          />
        </div>
      )}

      {/* Markdown Import */}
      <div className="border border-border/30 bg-background/50 p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="space-y-1">
            <h5 className="text-sm font-medium text-foreground">
              {m.skills_manager_import_title()}
            </h5>
            <p className="text-xs text-muted-foreground">
              {m.skills_manager_import_desc()}
            </p>
          </div>
          <FileText size={16} className="text-muted-foreground/40" />
        </div>
        <Textarea
          value={markdown}
          onChange={(e) => setMarkdown(e.target.value)}
          rows={6}
          placeholder={m.skills_manager_import_placeholder()}
          className="w-full rounded-none border border-border/30 bg-muted/10 px-4 py-3 text-sm font-mono text-foreground focus-visible:border-border/60"
        />
        <Button
          type="button"
          onClick={() => importSkillMutation.mutate(markdown)}
          disabled={importSkillMutation.isPending || !markdown.trim()}
          className="mt-4 h-9 px-4 text-[10px] uppercase tracking-[0.2em] font-medium rounded-none bg-foreground text-background hover:bg-foreground/90 disabled:opacity-40"
        >
          {importSkillMutation.isPending
            ? m.skills_manager_import_loading()
            : m.skills_manager_import_btn()}
        </Button>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block bg-background border border-border/30">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-border/30 bg-muted/5">
                <th className="px-6 py-3 font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground font-normal">
                  {m.skills_manager_col_name()}
                </th>
                <th className="px-6 py-3 font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground font-normal hidden lg:table-cell">
                  {m.skills_manager_col_desc()}
                </th>
                <th className="px-6 py-3 font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground font-normal">
                  {m.skills_manager_col_posts()}
                </th>
                <th className="px-6 py-3 font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground font-normal hidden lg:table-cell">
                  {m.skills_manager_col_created()}
                </th>
                <th className="px-6 py-3 font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground font-normal text-right">
                  {m.skills_manager_col_actions()}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-6">
                      <div className="h-4 w-32 bg-accent rounded-none" />
                    </td>
                    <td className="px-6 py-6 hidden lg:table-cell">
                      <div className="h-4 w-56 bg-accent rounded-none" />
                    </td>
                    <td className="px-6 py-6">
                      <div className="h-4 w-12 bg-accent rounded-none" />
                    </td>
                    <td className="px-6 py-6 hidden lg:table-cell">
                      <div className="h-4 w-24 bg-accent rounded-none" />
                    </td>
                    <td className="px-6 py-6">
                      <div className="h-4 w-16 bg-accent rounded-none ml-auto" />
                    </td>
                  </tr>
                ))
              ) : filteredSkills.length > 0 ? (
                filteredSkills.map((skill) => (
                  <tr
                    key={skill.id}
                    className="group hover:bg-muted/5 transition-colors duration-200"
                  >
                    <td className="px-6 py-4 font-medium">
                      {skillToEdit?.id === skill.id ? (
                        <InlineSkillEditForm
                          initialName={skill.name}
                          initialDescription={skill.description ?? ""}
                          isSubmitting={updateSkillMutation.isPending}
                          onCancel={() => setSkillToEdit(null)}
                          onSubmit={(data) =>
                            updateSkillMutation.mutate({
                              id: skill.id,
                              name: data.name,
                              description: data.description,
                            })
                          }
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          <Wand2
                            size={12}
                            className="text-muted-foreground/30"
                          />
                          <span className="text-foreground tracking-tight font-mono text-sm">
                            {skill.name}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 hidden lg:table-cell">
                      <span className="text-xs text-muted-foreground/80 line-clamp-2">
                        {skill.description || "—"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs text-muted-foreground">
                        {skill.postCount}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-[10px] text-muted-foreground/60 font-mono hidden lg:table-cell">
                      {new Date(skill.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[10px] font-mono text-muted-foreground hover:text-foreground hover:bg-muted/30 rounded-none"
                          onClick={() =>
                            setSkillToEdit({
                              id: skill.id,
                              name: skill.name,
                              description: skill.description ?? "",
                            })
                          }
                        >
                          [ {m.skills_manager_edit()} ]
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[10px] font-mono text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-none"
                          onClick={() =>
                            setSkillToDelete({ id: skill.id, name: skill.name })
                          }
                        >
                          [ {m.skills_manager_delete()} ]
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-24 text-center space-y-4">
                    <Search size={24} className="opacity-20 mx-auto" />
                    <div className="text-muted-foreground font-serif text-sm italic">
                      {m.skills_manager_no_match()}
                    </div>
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => setSearchTerm("")}
                      className="text-[10px] uppercase tracking-widest h-auto p-0 text-muted-foreground hover:text-foreground"
                    >
                      [ {m.skills_manager_clear_search()} ]
                    </Button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-4">
        {isLoading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="p-4 border border-border/30 bg-background animate-pulse space-y-3"
            >
              <div className="h-4 w-24 bg-accent rounded" />
              <div className="h-3 w-40 bg-accent rounded" />
            </div>
          ))
        ) : filteredSkills.length > 0 ? (
          filteredSkills.map((skill) => (
            <div
              key={skill.id}
              className="p-4 border border-border/30 bg-background space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Wand2
                      size={14}
                      className="text-muted-foreground/50 shrink-0"
                    />
                    <span className="font-medium text-foreground break-all">
                      {skill.name}
                    </span>
                  </div>
                  {skill.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {skill.description}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="text-xs font-mono font-bold text-foreground">
                    {skill.postCount}
                  </span>
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
                    {m.skills_manager_mobile_posts()}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-border/30 pt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
                  onClick={() =>
                    setSkillToEdit({
                      id: skill.id,
                      name: skill.name,
                      description: skill.description ?? "",
                    })
                  }
                >
                  [ {m.skills_manager_edit()} ]
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-red-500"
                  onClick={() =>
                    setSkillToDelete({ id: skill.id, name: skill.name })
                  }
                >
                  [ {m.skills_manager_delete()} ]
                </Button>
              </div>
            </div>
          ))
        ) : (
          <div className="p-8 text-center border border-border/30 bg-background text-muted-foreground">
            <span className="text-xs font-serif italic">
              {m.skills_manager_no_match()}
            </span>
          </div>
        )}
      </div>

      <ConfirmationModal
        isOpen={!!skillToDelete}
        onClose={() => setSkillToDelete(null)}
        onConfirm={() =>
          skillToDelete && deleteSkillMutation.mutate(skillToDelete.id)
        }
        title={m.skills_manager_delete_title()}
        message={
          skillToDelete
            ? m.skills_manager_delete_desc({ skillName: skillToDelete.name })
            : ""
        }
        confirmLabel={m.skills_manager_delete_confirm()}
        isLoading={deleteSkillMutation.isPending}
      />
    </div>
  );
}

function InlineSkillEditForm({
  initialName,
  initialDescription,
  isSubmitting,
  onCancel,
  onSubmit,
}: {
  initialName: string;
  initialDescription: string;
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmit: (data: { name: string; description: string }) => void;
}) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);

  return (
    <div className="space-y-2 animate-in fade-in duration-200">
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-7 flex-1 border-0 border-b border-foreground rounded-none focus-visible:ring-0 px-1 bg-transparent font-mono text-sm outline-none"
        />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          disabled={isSubmitting || !name.trim()}
          onClick={() =>
            onSubmit({ name: name.trim(), description: description.trim() })
          }
          className="h-6 w-6 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10"
        >
          <FileText size={14} />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={onCancel}
          className="h-6 w-6 text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
        >
          <X size={14} />
        </Button>
      </div>
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder={m.skills_manager_inline_desc_placeholder()}
        className="w-full border-0 border-b border-border/30 rounded-none px-1 bg-transparent font-mono text-xs text-muted-foreground outline-none focus:border-foreground"
      />
    </div>
  );
}

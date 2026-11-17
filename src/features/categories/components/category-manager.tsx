import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import ConfirmationModal from "@/components/ui/confirmation-modal";
import { Input } from "@/components/ui/input";
import { createCategoryFn, deleteCategoryFn, updateCategoryFn } from "../api";
import { categoriesQueryOptions } from "../queries";

export function CategoryManager() {
  const client = useQueryClient();
  const query = useQuery(categoriesQueryOptions);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<{
    id: number;
    name: string;
    postCount: number;
  } | null>(null);
  const mutation = useMutation({
    mutationFn: async (action: "save" | "delete") => {
      if (action === "delete" && deleting)
        await deleteCategoryFn({ data: { id: deleting.id } });
      else if (editing) await updateCategoryFn({ data: { id: editing, name } });
      else await createCategoryFn({ data: { name } });
    },
    onSuccess: async () => {
      setName("");
      setEditing(null);
      setDeleting(null);
      await client.invalidateQueries({ queryKey: ["categories"] });
      await client.invalidateQueries({ queryKey: ["posts"] });
    },
  });
  return (
    <section className="space-y-4 rounded-2xl border border-border/60 bg-card p-5 md:p-6">
      <h2 className="text-xl font-semibold">分类管理</h2>
      <p className="text-sm text-muted-foreground">
        每篇文章最多选择一个分类，标签可以多选。
      </p>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate("save");
        }}
      >
        <label className="min-w-0 flex-1 space-y-2 text-sm">
          <span>分类名称</span>
          <Input
            value={name}
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </label>
        <Button type="submit" disabled={mutation.isPending || !name.trim()}>
          {editing ? "保存分类" : "新增分类"}
        </Button>
        {editing ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setEditing(null);
              setName("");
            }}
          >
            取消
          </Button>
        ) : null}
      </form>
      {mutation.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {mutation.error.message}
        </p>
      ) : null}
      {query.isError ? (
        <Button variant="outline" onClick={() => query.refetch()}>
          加载失败，重试
        </Button>
      ) : (
        <ul className="divide-y divide-border/50">
          {query.data?.map((category) => (
            <li
              key={category.id}
              className="flex flex-wrap items-center gap-3 py-3"
            >
              <span className="min-w-0 flex-1 break-words">
                {category.name}{" "}
                <span className="text-xs text-muted-foreground">
                  {category.postCount} 篇公开文章
                </span>
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={mutation.isPending}
                onClick={() => {
                  setEditing(category.id);
                  setName(category.name);
                }}
              >
                重命名
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-destructive"
                disabled={mutation.isPending}
                onClick={() => setDeleting(category)}
              >
                删除
              </Button>
            </li>
          ))}
        </ul>
      )}
      <ConfirmationModal
        isOpen={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          await mutation.mutateAsync("delete");
        }}
        title="删除分类"
        message={`删除“${deleting?.name ?? ""}”后，${deleting?.postCount ?? 0} 篇公开文章将失去该分类，文章内容仍会保留。`}
        confirmLabel="删除分类"
        isLoading={mutation.isPending}
      />
    </section>
  );
}

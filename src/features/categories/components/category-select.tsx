import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Plus } from "lucide-react";
import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { m } from "@/paraglide/messages";
import { createCategoryFn } from "../api";
import {
  categoriesAdminQueryOptions,
  categoriesQueryOptions,
} from "../queries";

export function CategorySelect({
  value,
  onChange,
  canCreate,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  canCreate: boolean;
}) {
  const labelId = useId();
  const details = useRef<HTMLDetailsElement>(null);
  const queryClient = useQueryClient();
  const query = useQuery(categoriesAdminQueryOptions);
  const [search, setSearch] = useState("");
  const name = search.trim();
  const categories = query.data ?? [];
  const matches = categories.filter((category) =>
    category.name.toLowerCase().includes(name.toLowerCase()),
  );

  function select(id: number | null) {
    onChange(id);
    setSearch("");
    if (details.current?.open) {
      details.current.open = false;
      details.current.querySelector("summary")?.focus();
    }
  }

  const creation = useMutation({
    mutationFn: async (newName: string) => {
      const category = await createCategoryFn({ data: { name: newName } });
      if (!category) throw new Error(m.editor_category_create_error());
      return category;
    },
    onSuccess: async (category) => {
      const queryKey = categoriesAdminQueryOptions.queryKey;
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData(queryKey, (previous = []) =>
        [...previous.filter(({ id }) => id !== category.id), category].sort(
          (a, b) => a.name.localeCompare(b.name),
        ),
      );
      select(category.id);
      void queryClient.invalidateQueries({
        queryKey: categoriesQueryOptions.queryKey,
      });
    },
  });

  const canSubmit =
    canCreate &&
    query.isSuccess &&
    name.length > 0 &&
    !creation.isPending &&
    !categories.some(
      (category) => category.name.toLowerCase() === name.toLowerCase(),
    );

  return (
    <div className="min-w-0 space-y-2">
      <details
        ref={details}
        className="group rounded-xl border border-border bg-background"
      >
        <summary
          id={labelId}
          className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm [&::-webkit-details-marker]:hidden"
        >
          <span className="min-w-0 wrap-anywhere">
            {m.editor_category_label()} ·{" "}
            {categories.find((category) => category.id === value)?.name ??
              (value === null ? m.editor_category_none() : `#${value}`)}
          </span>
          <ChevronDown
            size={16}
            aria-hidden="true"
            className="shrink-0 group-open:rotate-180"
          />
        </summary>
        <div className="space-y-2 border-t border-border p-2">
          <div className="flex flex-wrap gap-2">
            <Input
              aria-label={m.editor_category_search()}
              placeholder={
                canCreate
                  ? m.editor_category_search_create()
                  : m.editor_category_search()
              }
              value={search}
              maxLength={80}
              disabled={creation.isPending}
              className="min-h-11 min-w-0 flex-1 basis-48"
              onChange={(event) => {
                creation.reset();
                setSearch(event.target.value);
              }}
            />
            {canCreate ? (
              <Button
                type="button"
                className="min-h-11"
                disabled={!canSubmit}
                onClick={() => creation.mutate(name)}
              >
                <Plus size={16} aria-hidden="true" />
                {m.editor_category_create()}
              </Button>
            ) : null}
          </div>
          {creation.isError ? (
            <p role="alert" className="text-sm text-destructive">
              {m.editor_category_create_error()}
            </p>
          ) : null}
          {query.isError ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => void query.refetch()}
            >
              {m.editor_category_load_error()}
            </Button>
          ) : null}
          {query.isPending ? (
            <p role="status" className="px-2 text-sm text-muted-foreground">
              {m.editor_category_loading()}
            </p>
          ) : null}
          <ul
            aria-labelledby={labelId}
            className="max-h-52 overflow-y-auto overscroll-contain"
          >
            {[{ id: null, name: m.editor_category_none() }, ...matches].map(
              (category) => (
                <li key={category.id ?? "none"}>
                  <button
                    type="button"
                    aria-pressed={value === category.id}
                    disabled={creation.isPending}
                    onClick={() => {
                      creation.reset();
                      select(category.id);
                    }}
                    className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-2 text-left text-sm hover:bg-muted aria-pressed:bg-muted"
                  >
                    <span className="min-w-0 wrap-anywhere">
                      {category.name}
                    </span>
                    {value === category.id ? (
                      <Check
                        size={16}
                        aria-hidden="true"
                        className="shrink-0"
                      />
                    ) : null}
                  </button>
                </li>
              ),
            )}
          </ul>
        </div>
      </details>
    </div>
  );
}

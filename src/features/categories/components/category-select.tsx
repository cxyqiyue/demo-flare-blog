import { useQuery } from "@tanstack/react-query";
import { categoriesAdminQueryOptions } from "../queries";

export function CategorySelect({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  const query = useQuery(categoriesAdminQueryOptions);
  return (
    <label className="flex flex-col gap-2 text-sm font-medium">
      分类
      <select
        value={value ?? ""}
        disabled={query.isPending || query.isError}
        onChange={(event) =>
          onChange(event.target.value ? Number(event.target.value) : null)
        }
        className="min-h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
      >
        <option value="">未分类</option>
        {query.data?.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>
      {query.isError ? (
        <button
          type="button"
          className="text-left text-destructive"
          onClick={() => query.refetch()}
        >
          分类加载失败，点击重试
        </button>
      ) : null}
    </label>
  );
}

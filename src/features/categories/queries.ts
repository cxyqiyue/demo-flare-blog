import { queryOptions } from "@tanstack/react-query";
import { getCategoriesAdminFn, getCategoriesFn } from "./api";

export const categoriesQueryOptions = queryOptions({
  queryKey: ["categories"],
  queryFn: () => getCategoriesFn(),
  staleTime: 30_000,
});
export const categoriesAdminQueryOptions = queryOptions({
  queryKey: ["categories", "admin"],
  queryFn: () => getCategoriesAdminFn(),
  staleTime: 30_000,
});

import { useQuery } from "@tanstack/react-query";
import { getArticleImageHostingConfigFn } from "@/features/image-hosting/api/image-hosting.api";

const ARTICLE_IMAGE_HOSTING_CONFIG_KEY = [
  "image-hosting",
  "article-config",
] as const;

export function useArticleImageHostingConfig() {
  const { data } = useQuery({
    queryKey: ARTICLE_IMAGE_HOSTING_CONFIG_KEY,
    queryFn: getArticleImageHostingConfigFn,
    staleTime: 60_000,
  });

  return { enabled: data?.enabled ?? false };
}

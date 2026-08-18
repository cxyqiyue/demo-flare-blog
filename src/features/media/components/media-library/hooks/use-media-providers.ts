import { useQuery } from "@tanstack/react-query";
import { getMediaProvidersFn } from "@/features/media/api/media.api";
import type { MediaProvider } from "@/features/media/media.schema";

const MEDIA_PROVIDERS_KEY = ["media", "providers"] as const;

export function useMediaProviders() {
  const { data: providers = [], isLoading } = useQuery({
    queryKey: MEDIA_PROVIDERS_KEY,
    queryFn: getMediaProvidersFn,
    staleTime: 60_000,
  });

  return { providers, isLoading };
}

export function findProvider(
  providers: MediaProvider[],
  id: string,
): MediaProvider | undefined {
  return providers.find((p) => p.id === id);
}

export function canManageFiles(provider: MediaProvider | undefined): boolean {
  return provider?.canList === true;
}

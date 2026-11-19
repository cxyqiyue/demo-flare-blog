import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CHALLENGE_KEYS } from "@/features/challenge/queries";
import {
  updateSystemConfigFn,
  updateSystemConfigSectionFn,
} from "@/features/config/api/config.api";
import { CONFIG_KEYS, systemConfigQuery } from "@/features/config/queries";

const MEDIA_PROVIDERS_KEY = ["media", "providers"] as const;

export function useSystemSetting() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery(systemConfigQuery);

  const invalidateMediaProviders = () =>
    queryClient.invalidateQueries({ queryKey: MEDIA_PROVIDERS_KEY });

  const saveMutation = useMutation({
    mutationFn: updateSystemConfigFn,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: CONFIG_KEYS.system }),
        queryClient.invalidateQueries({ queryKey: CONFIG_KEYS.site }),
        queryClient.removeQueries({ queryKey: CHALLENGE_KEYS.fullSiteLocked }),
        invalidateMediaProviders(),
      ]);
    },
  });

  const saveSectionMutation = useMutation({
    mutationFn: updateSystemConfigSectionFn,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: CONFIG_KEYS.system }),
        queryClient.invalidateQueries({ queryKey: CONFIG_KEYS.site }),
        queryClient.removeQueries({ queryKey: CHALLENGE_KEYS.fullSiteLocked }),
        invalidateMediaProviders(),
      ]);
    },
  });

  return {
    settings: data,
    isLoading,
    saveSettings: saveMutation.mutateAsync,
    saveSettingsSection: saveSectionMutation.mutateAsync,
  };
}

import * as ConfigService from "@/features/config/service/config.service";

export interface TurnstileServerConfig {
  enabled: boolean;
  siteKey: string;
  secretKey: string;
}

export interface TurnstileClientConfig {
  enabled: boolean;
  siteKey: string;
}

export async function getTurnstileConfig(
  context: DbContext & { executionCtx: ExecutionContext },
): Promise<TurnstileServerConfig> {
  const config = await ConfigService.getSystemConfig(context);
  const turnstile = config.challenge?.turnstile;
  return {
    enabled: !!turnstile?.enabled,
    siteKey: turnstile?.siteKey?.trim() ?? "",
    secretKey: turnstile?.secretKey?.trim() ?? "",
  };
}

export function isTurnstileReady(config: TurnstileServerConfig): boolean {
  return config.enabled && !!config.siteKey && !!config.secretKey;
}

export async function getTurnstileClientConfig(
  context: DbContext & { executionCtx: ExecutionContext },
): Promise<TurnstileClientConfig> {
  const { enabled, siteKey } = await getTurnstileConfig(context);
  return { enabled, siteKey };
}

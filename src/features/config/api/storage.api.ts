import { createServerFn } from "@tanstack/react-start";
import {
  getKvWriteState,
  KV_WRITE_SAFE_LIMIT,
} from "@/features/cache/kv-write-guard";
import { adminMiddleware } from "@/lib/middlewares";

export const getStorageStatusFn = createServerFn()
  .middleware([adminMiddleware])
  .handler(async ({ context }) => {
    const state = await getKvWriteState(context.env);
    return {
      kv: {
        limit: KV_WRITE_SAFE_LIMIT,
        count: state.count,
        autoDisabled: state.autoDisabled,
        userDisabled: state.userDisabled,
        enabled: state.allowed,
      },
    };
  });

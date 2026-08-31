import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { TaskProgressTable } from "@/lib/db/schema";

/**
 * 导入/导出任务进度存储。
 * 以 D1 task_progress 表为权威（无 KV 配额限制）；读取时若无 D1 数据，
 * 再回退读取存量 KV（兼容部署前已启动的历史任务）。
 */

export type TaskProgressType = "export" | "import";

export interface TaskProgressRecord {
  taskId: string;
  type: TaskProgressType;
  progressJson: string;
  updatedAt: Date;
}

export async function saveTaskProgress(
  env: Env,
  taskId: string,
  type: TaskProgressType,
  progressJson: string,
): Promise<void> {
  const db = getDb(env);
  await db
    .insert(TaskProgressTable)
    .values({ taskId, type, progressJson })
    .onConflictDoUpdate({
      target: [TaskProgressTable.taskId],
      set: { progressJson, type },
    })
    .run();
}

export async function deleteTaskProgress(
  env: Env,
  taskId: string,
): Promise<void> {
  const db = getDb(env);
  await db
    .delete(TaskProgressTable)
    .where(eq(TaskProgressTable.taskId, taskId))
    .run();
}

export async function getTaskProgress(
  env: Env,
  taskId: string,
): Promise<TaskProgressRecord | null> {
  const db = getDb(env);
  const row = await db.query.TaskProgressTable.findFirst({
    where: (t, { eq }) => eq(t.taskId, taskId),
  });
  if (!row) return null;
  return {
    taskId: row.taskId,
    type: row.type as TaskProgressType,
    progressJson: row.progressJson,
    updatedAt: row.updatedAt,
  };
}

import {
  generateKey,
  normalizeFolderPath,
} from "@/features/media/utils/media.utils";

export async function putToR2(env: Env, image: File, folder = "") {
  const key = generateKey(image.name, folder);
  const contentType = image.type;
  const url = `/images/${key}`;

  await env.R2.put(key, image.stream(), {
    httpMetadata: {
      contentType,
    },
    customMetadata: {
      originalName: image.name,
    },
  });

  return {
    key,
    url,
    fileName: image.name,
    mimeType: contentType,
    sizeInBytes: image.size,
  };
}

export async function deleteFromR2(env: Env, key: string) {
  await env.R2.delete(key);
}

export async function getFromR2(env: Env, key: string) {
  return await env.R2.get(key);
}

/**
 * Upload a site asset (favicon, theme images) to R2 with a fixed key.
 * No DB record; overwrites in place on re-upload.
 */
export async function putSiteAsset(
  env: Env,
  file: File,
  assetPath: string,
): Promise<{ key: string; url: string }> {
  const key = `asset/${assetPath}`;
  await env.R2.put(key, file.stream(), {
    httpMetadata: {
      contentType: file.type,
    },
  });
  return { key, url: `/images/${key}` };
}

export interface R2DirectoryListOptions {
  prefix?: string;
  cursor?: string;
  limit?: number;
}

/**
 * List a directory level in R2: files become `objects`, sub-folders become
 * `delimitedPrefixes` (keys that end with `/`).
 */
export async function listR2Directory(
  env: Env,
  options: R2DirectoryListOptions = {},
): Promise<R2Objects> {
  return await env.R2.list({
    prefix: options.prefix,
    delimiter: "/",
    cursor: options.cursor,
    limit: options.limit,
    include: ["httpMetadata", "customMetadata"],
  });
}

/**
 * Return every object key under `prefix` (paginating through truncated lists).
 */
export async function listAllKeys(env: Env, prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let cursor: string | undefined;
  do {
    const result = await env.R2.list({ prefix, cursor });
    keys.push(...result.objects.map((o) => o.key));
    cursor = result.truncated ? result.cursor : undefined;
  } while (cursor);
  return keys;
}

/**
 * Create an empty folder marker object (key ends with `/`). It shows up as a
 * `delimitedPrefix` in directory listings but never as a file.
 */
export async function createFolderMarker(env: Env, folderKey: string) {
  await env.R2.put(folderKey, "", {
    customMetadata: { isFolder: "1" },
  });
}

/**
 * Copy a single object to a new key, preserving metadata.
 */
export async function copyObject(
  env: Env,
  sourceKey: string,
  targetKey: string,
): Promise<boolean> {
  const object = await env.R2.get(sourceKey);
  if (!object) return false;
  await env.R2.put(targetKey, object.body, {
    httpMetadata: object.httpMetadata,
    customMetadata: object.customMetadata,
  });
  return true;
}

/**
 * Delete a set of keys in one batch.
 */
export async function deleteKeys(env: Env, keys: string[]) {
  if (keys.length === 0) return;
  await env.R2.delete(keys);
}

/**
 * Normalize a folder key so it always ends with a trailing slash.
 */
export function normalizeFolderKey(folder: string): string {
  const base = normalizeFolderPath(folder);
  return base ? `${base}/` : "";
}

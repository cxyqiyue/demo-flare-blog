import type { HuggingFaceChannel } from "@/features/image-hosting/image-hosting.schema";
import { err, ok, type Result } from "@/lib/errors";

/**
 * HuggingFace channel client.
 *
 * The configured repo is used as a DATASET repo and every remote operation
 * goes through the documented Hub commit/tree APIs (same protocol as
 * CloudFlare-ImgBed): preupload -> LFS batch or direct ndjson commit for
 * uploads, `deletedFile` commits for deletes, `/tree/main` for listings.
 * This keeps the media library in true sync with the real repository —
 * files committed outside the blog show up, deleted files disappear.
 */

const HF_BASE = "https://huggingface.co";
/** Files above this size are rejected before hitting the Hub (blog cap is 10MB). */
const MAX_DIRECT_COMMIT_BYTES = 10 * 1024 * 1024;

export interface HuggingFaceUploadResult {
  /** Real repo path of the stored file (durable key) */
  key: string;
  url: string;
  fileName: string;
  mimeType: string;
  sizeInBytes: number;
}

export interface HuggingFaceListedFile {
  key: string;
  name: string;
  url: string;
  mimeType: string;
  sizeInBytes: number;
}

interface HfError {
  reason: string;
  message: string;
}

function hfHeaders(
  config: HuggingFaceChannel,
  extra?: Record<string, string>,
): Record<string, string> {
  const headers: Record<string, string> = { ...(extra ?? {}) };
  const token = config.token?.trim();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export function buildHfResolveUrl(repo: string, path: string): string {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${HF_BASE}/datasets/${repo}/resolve/main/${encoded}`;
}

async function readError(response: Response): Promise<string> {
  const text = await response.text();
  if (!text) return `HuggingFace request failed (${response.status})`;
  try {
    const parsed = JSON.parse(text) as unknown;
    if (typeof parsed === "object" && parsed !== null) {
      const errBody = parsed as Record<string, unknown>;
      if (typeof errBody.error === "string" && errBody.error) {
        return errBody.error;
      }
      if (typeof errBody.message === "string" && errBody.message) {
        return errBody.message;
      }
    }
  } catch {
    // fall through to raw text
  }
  return text.slice(0, 300);
}

function splitRepoId(repo: string): { owner: string; name: string } {
  const idx = repo.indexOf("/");
  if (idx === -1) return { owner: "", name: repo };
  return { owner: repo.slice(0, idx), name: repo.slice(idx + 1) };
}

/**
 * Create the dataset repo when it does not exist yet (409 = already exists).
 */
export async function ensureHuggingFaceRepo(
  config: HuggingFaceChannel,
): Promise<Result<{ success: boolean }, HfError>> {
  const repo = config.repo?.trim();
  const token = config.token?.trim();
  if (!repo || !token) {
    return err({
      reason: "HUGGINGFACE_NOT_CONFIGURED",
      message: "HuggingFace token and repo are required",
    });
  }

  try {
    const check = await fetch(`${HF_BASE}/api/datasets/${repo}`, {
      headers: hfHeaders(config),
    });
    if (check.ok) return ok({ success: true });

    const { name } = splitRepoId(repo);
    const create = await fetch(`${HF_BASE}/api/repos/create`, {
      method: "POST",
      headers: hfHeaders(config, { "Content-Type": "application/json" }),
      body: JSON.stringify({
        name,
        type: "dataset",
        private: config.isPrivate ?? false,
      }),
    });
    if (create.ok || create.status === 409) {
      return ok({ success: true });
    }
    return err({
      reason: "HUGGINGFACE_REPO_CREATE_FAILED",
      message: await readError(create),
    });
  } catch (error) {
    return err({
      reason: "HUGGINGFACE_REPO_CREATE_FAILED",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x4000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function commitNdjson(
  config: HuggingFaceChannel,
  lines: Array<Record<string, unknown>>,
  summary: string,
): Promise<Result<{ success: boolean }, HfError>> {
  const repo = config.repo!.trim();
  const body = [
    JSON.stringify({ key: "header", value: { summary } }),
    ...lines.map((line) => JSON.stringify(line)),
  ].join("\n");

  const response = await fetch(`${HF_BASE}/api/datasets/${repo}/commit/main`, {
    method: "POST",
    headers: hfHeaders(config, { "Content-Type": "application/x-ndjson" }),
    body,
  });

  if (!response.ok) {
    return err({
      reason: "HUGGINGFACE_COMMIT_FAILED",
      message: await readError(response),
    });
  }
  return ok({ success: true });
}

async function uploadViaLfs(
  config: HuggingFaceChannel,
  filePath: string,
  content: ArrayBuffer,
): Promise<Result<{ success: boolean }, HfError>> {
  const repo = config.repo!.trim();
  const oid = toHex(await crypto.subtle.digest("SHA-256", content));
  const size = content.byteLength;

  const batchResp = await fetch(
    `${HF_BASE}/datasets/${repo}.git/info/lfs/objects/batch`,
    {
      method: "POST",
      headers: hfHeaders(config, {
        Accept: "application/vnd.git-lfs+json",
        "Content-Type": "application/vnd.git-lfs+json",
      }),
      body: JSON.stringify({
        operation: "upload",
        transfers: ["basic"],
        hash_algo: "sha_256",
        ref: { name: "main" },
        objects: [{ oid, size }],
      }),
    },
  );

  if (!batchResp.ok) {
    return err({
      reason: "HUGGINGFACE_LFS_FAILED",
      message: await readError(batchResp),
    });
  }

  const batch = (await batchResp.json()) as {
    objects?: Array<{
      actions?: {
        upload?: { href: string; header?: Record<string, string> };
      };
    }>;
  };
  const uploadAction = batch.objects?.[0]?.actions?.upload;
  if (!uploadAction) {
    return err({
      reason: "HUGGINGFACE_LFS_FAILED",
      message: "LFS batch response did not include an upload action",
    });
  }

  // Multipart uploads are not needed at the blog's 10MB cap; bail out
  // explicitly instead of silently corrupting the object.
  if (uploadAction.header?.chunk_size) {
    return err({
      reason: "HUGGINGFACE_LFS_FAILED",
      message: "File requires multipart LFS upload which is not supported",
    });
  }

  const putHeaders: Record<string, string> = {
    ...(uploadAction.header ?? {}),
    "Content-Type": "application/octet-stream",
  };
  const putResp = await fetch(uploadAction.href, {
    method: "PUT",
    headers: putHeaders,
    body: content,
  });
  if (!putResp.ok) {
    return err({
      reason: "HUGGINGFACE_LFS_FAILED",
      message: `LFS upload failed with status ${putResp.status}`,
    });
  }

  return commitNdjson(
    config,
    [
      {
        key: "lfsFile",
        value: { path: filePath, algo: "sha256", size, oid },
      },
    ],
    `Upload ${filePath}`,
  );
}

/**
 * Upload a file into the exact repo path being viewed (WYSIWYG).
 * Small files go through a direct ndjson commit; LFS-flagged files go
 * through the LFS batch protocol. Returns the real repo path as key.
 */
export async function uploadToHuggingFaceChannel(
  config: HuggingFaceChannel,
  file: File,
  folder: string,
): Promise<Result<HuggingFaceUploadResult, HfError>> {
  const token = config.token?.trim();
  const repo = config.repo?.trim();
  if (!token || !repo) {
    return err({
      reason: "HUGGINGFACE_NOT_CONFIGURED",
      message: "HuggingFace token and repo are required",
    });
  }
  if (file.size > MAX_DIRECT_COMMIT_BYTES) {
    return err({
      reason: "HUGGINGFACE_UPLOAD_FAILED",
      message: "File exceeds the 10MB limit for HuggingFace uploads",
    });
  }

  try {
    const ensured = await ensureHuggingFaceRepo(config);
    if (ensured.error) return ensured;

    const ext = file.name.includes(".")
      ? file.name.split(".").pop()!.toLowerCase()
      : "png";
    const fileName = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const filePath = folder ? `${folder}/${fileName}` : fileName;

    const content = await file.arrayBuffer();

    // Ask the Hub how this file must be stored (regular commit vs LFS).
    const preupload = await fetch(
      `${HF_BASE}/api/datasets/${repo}/preupload/main`,
      {
        method: "POST",
        headers: hfHeaders(config, { "Content-Type": "application/json" }),
        body: JSON.stringify({
          files: [
            {
              path: filePath,
              size: content.byteLength,
              sample: arrayBufferToBase64(content.slice(0, 512)),
            },
          ],
        }),
      },
    );

    let useLfs = false;
    if (preupload.ok) {
      const data = (await preupload.json()) as {
        files?: Array<{ uploadMode?: string; path?: string }>;
      };
      const entry =
        data.files?.find((f) => f.path === filePath) ?? data.files?.[0];
      useLfs = entry?.uploadMode === "lfs";
    }

    if (useLfs) {
      const lfsResult = await uploadViaLfs(config, filePath, content);
      if (lfsResult.error) return lfsResult;
    } else {
      const direct = await commitNdjson(
        config,
        [
          {
            key: "file",
            value: {
              path: filePath,
              content: arrayBufferToBase64(content),
              encoding: "base64",
            },
          },
        ],
        `Upload ${filePath}`,
      );
      if (direct.error) return direct;
    }

    return ok({
      key: filePath,
      url: buildHfResolveUrl(repo, filePath),
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      sizeInBytes: file.size,
    });
  } catch (error) {
    return err({
      reason: "HUGGINGFACE_UPLOAD_FAILED",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * List one directory level of the real dataset repo via the tree API.
 * Dotfiles (.gitkeep folder markers) are hidden from the listing.
 */
export async function listHuggingFaceDirectory(
  config: HuggingFaceChannel,
  folder: string,
): Promise<
  Result<
    {
      files: HuggingFaceListedFile[];
      folders: Array<{ key: string; name: string }>;
    },
    HfError
  >
> {
  const token = config.token?.trim();
  const repo = config.repo?.trim();
  if (!token || !repo) {
    return err({
      reason: "HUGGINGFACE_NOT_CONFIGURED",
      message: "HuggingFace token and repo are required",
    });
  }

  try {
    const encodedPath = folder
      ? folder.split("/").map(encodeURIComponent).join("/")
      : "";
    const url = `${HF_BASE}/api/datasets/${repo}/tree/main${encodedPath ? `/${encodedPath}` : ""}`;
    const response = await fetch(url, { headers: hfHeaders(config) });

    // A missing path simply means an empty (not yet created) folder.
    if (response.status === 404) {
      return ok({ files: [], folders: [] });
    }
    if (!response.ok) {
      return err({
        reason: "HUGGINGFACE_LIST_FAILED",
        message: await readError(response),
      });
    }

    const entries = (await response.json()) as Array<{
      type: string;
      path: string;
      size?: number;
    }>;

    const files: HuggingFaceListedFile[] = [];
    const folders: Array<{ key: string; name: string }> = [];

    for (const entry of entries) {
      const name = entry.path.split("/").pop() ?? entry.path;
      if (name.startsWith(".")) continue;

      if (entry.type === "file") {
        files.push({
          key: entry.path,
          name,
          url: buildHfResolveUrl(repo, entry.path),
          mimeType: guessMimeFromName(name),
          sizeInBytes: entry.size ?? 0,
        });
      } else if (entry.type === "directory") {
        folders.push({ key: `${entry.path}/`, name });
      }
    }

    return ok({ files, folders });
  } catch (error) {
    return err({
      reason: "HUGGINGFACE_LIST_FAILED",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Recursively collect every file path under a prefix (folder operations).
 */
export async function listAllHuggingFacePaths(
  config: HuggingFaceChannel,
  prefix: string,
): Promise<Result<string[], HfError>> {
  const token = config.token?.trim();
  const repo = config.repo?.trim();
  if (!token || !repo) {
    return err({
      reason: "HUGGINGFACE_NOT_CONFIGURED",
      message: "HuggingFace token and repo are required",
    });
  }

  try {
    const paths: string[] = [];
    let cursor: string | undefined;

    do {
      const encodedPrefix = prefix
        .split("/")
        .map(encodeURIComponent)
        .join("/");
      const url = new URL(
        `${HF_BASE}/api/datasets/${repo}/tree/main${encodedPrefix ? `/${encodedPrefix}` : ""}`,
      );
      url.searchParams.set("recursive", "true");
      if (cursor) url.searchParams.set("cursor", cursor);

      const response = await fetch(url.toString(), {
        headers: hfHeaders(config),
      });
      if (response.status === 404) break;
      if (!response.ok) {
        return err({
          reason: "HUGGINGFACE_LIST_FAILED",
          message: await readError(response),
        });
      }

      const entries = (await response.json()) as Array<{
        type: string;
        path: string;
      }>;
      for (const entry of entries) {
        if (entry.type === "file") paths.push(entry.path);
      }

      cursor = response.headers.get("x-repo-tree-cursor") ?? undefined;
      if (entries.length < 1000) cursor = undefined;
    } while (cursor);

    return ok(paths);
  } catch (error) {
    return err({
      reason: "HUGGINGFACE_LIST_FAILED",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Delete files from the repo with `deletedFile` commits (batched).
 */
export async function deleteHuggingFaceFiles(
  config: HuggingFaceChannel,
  paths: string[],
): Promise<Result<{ deleted: number }, HfError>> {
  const token = config.token?.trim();
  const repo = config.repo?.trim();
  if (!token || !repo) {
    return err({
      reason: "HUGGINGFACE_NOT_CONFIGURED",
      message: "HuggingFace token and repo are required",
    });
  }
  if (paths.length === 0) return ok({ deleted: 0 });

  try {
    const CHUNK = 50;
    let deleted = 0;
    for (let i = 0; i < paths.length; i += CHUNK) {
      const chunk = paths.slice(i, i + CHUNK);
      const result = await commitNdjson(
        config,
        chunk.map((path) => ({
          key: "deletedFile",
          value: { path },
        })),
        `Delete ${chunk.length} file(s) via media library`,
      );
      if (result.error) return result;
      deleted += chunk.length;
    }
    return ok({ deleted });
  } catch (error) {
    return err({
      reason: "HUGGINGFACE_DELETE_FAILED",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Move/rename one file inside the repo: re-commit the content under the
 * new path, then delete the old object. The Hub has no native move API.
 */
export async function moveHuggingFaceFile(
  config: HuggingFaceChannel,
  fromPath: string,
  toPath: string,
): Promise<Result<{ success: boolean }, HfError>> {
  const token = config.token?.trim();
  const repo = config.repo?.trim();
  if (!token || !repo) {
    return err({
      reason: "HUGGINGFACE_NOT_CONFIGURED",
      message: "HuggingFace token and repo are required",
    });
  }

  try {
    const encoded = fromPath.split("/").map(encodeURIComponent).join("/");
    const response = await fetch(
      `${HF_BASE}/datasets/${repo}/resolve/main/${encoded}`,
      { headers: hfHeaders(config) },
    );
    if (!response.ok) {
      return err({
        reason: "HUGGINGFACE_MOVE_FAILED",
        message: `Failed to read source file (${response.status})`,
      });
    }
    const content = await response.arrayBuffer();

    const created = await commitNdjson(
      config,
      [
        {
          key: "file",
          value: {
            path: toPath,
            content: arrayBufferToBase64(content),
            encoding: "base64",
          },
        },
      ],
      `Move ${fromPath} to ${toPath}`,
    );
    if (created.error) return created;

    const removed = await deleteHuggingFaceFiles(config, [fromPath]);
    if (removed.error) return removed;

    return ok({ success: true });
  } catch (error) {
    return err({
      reason: "HUGGINGFACE_MOVE_FAILED",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Create a visible folder by committing a `.gitkeep` marker file.
 */
export async function createHuggingFaceFolder(
  config: HuggingFaceChannel,
  folderPath: string,
): Promise<Result<{ success: boolean }, HfError>> {
  const token = config.token?.trim();
  const repo = config.repo?.trim();
  if (!token || !repo) {
    return err({
      reason: "HUGGINGFACE_NOT_CONFIGURED",
      message: "HuggingFace token and repo are required",
    });
  }

  try {
    const ensured = await ensureHuggingFaceRepo(config);
    if (ensured.error) return ensured;

    return await commitNdjson(
      config,
      [
        {
          key: "file",
          value: {
            path: `${folderPath}/.gitkeep`,
            content: "",
            encoding: "base64",
          },
        },
      ],
      `Create folder ${folderPath}`,
    );
  } catch (error) {
    return err({
      reason: "HUGGINGFACE_FOLDER_CREATE_FAILED",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export function guessMimeFromName(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    avif: "image/avif",
  };
  return map[ext] ?? "application/octet-stream";
}

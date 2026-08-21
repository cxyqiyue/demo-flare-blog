import type { WebDAVChannel } from "@/features/image-hosting/image-hosting.schema";
import { err, ok, type Result } from "@/lib/errors";
import { guessMimeFromName } from "@/features/image-hosting/channels/huggingface";

/**
 * WebDAV channel client.
 *
 * Every operation talks to the real WebDAV server (PROPFIND / MKCOL /
 * PUT / DELETE / MOVE), so the media library is a faithful view of the
 * remote filesystem: files uploaded outside the blog show up and
 * removed files disappear.
 */

export interface WebDavUploadResult {
  /** Real server path of the stored file (durable key) */
  key: string;
  url: string;
  fileName: string;
  mimeType: string;
  sizeInBytes: number;
}

export interface WebDavListedFile {
  key: string;
  name: string;
  url: string;
  mimeType: string;
  sizeInBytes: number;
}

interface DavError {
  reason: string;
  message: string;
}

function normalizeBase(config: WebDAVChannel): string {
  return config.baseUrl!.trim().replace(/\/+$/, "");
}

export function buildWebDavUrl(config: WebDAVChannel, path: string): string {
  const base = normalizeBase(config);
  const encoded = path
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
  return encoded ? `${base}/${encoded}` : base;
}

export function buildWebDavPublicUrl(
  config: WebDAVChannel,
  path: string,
): string {
  const configured = config.publicUrl?.trim();
  const base = (configured || normalizeBase(config)).replace(/\/+$/, "");
  const encoded = path
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
  return `${base}/${encoded}`;
}

function authHeaders(config: WebDAVChannel): Record<string, string> {
  const headers: Record<string, string> = {};
  if (config.username) {
    headers.Authorization = `Basic ${btoa(`${config.username}:${config.password || ""}`)}`;
  }
  return headers;
}

async function readErrorText(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.slice(0, 300) || `WebDAV request failed (${response.status})`;
  } catch {
    return `WebDAV request failed (${response.status})`;
  }
}

/**
 * MKCOL every missing segment of a folder path. 405 = already exists.
 */
export async function ensureWebDavFolder(
  config: WebDAVChannel,
  folderPath: string,
): Promise<Result<{ success: boolean }, DavError>> {
  if (!config.baseUrl?.trim()) {
    return err({
      reason: "WEBDAV_NOT_CONFIGURED",
      message: "WebDAV base URL is required",
    });
  }

  const segments = folderPath.split("/").filter(Boolean);
  let current = "";

  try {
    for (const segment of segments) {
      current = current ? `${current}/${segment}` : segment;
      const response = await fetch(buildWebDavUrl(config, current), {
        method: "MKCOL",
        headers: authHeaders(config),
      });
      if (
        !response.ok &&
        response.status !== 201 &&
        response.status !== 204 &&
        response.status !== 405
      ) {
        return err({
          reason: "WEBDAV_FOLDER_CREATE_FAILED",
          message: await readErrorText(response),
        });
      }
    }
    return ok({ success: true });
  } catch (error) {
    return err({
      reason: "WEBDAV_FOLDER_CREATE_FAILED",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Upload a file to the exact server path being viewed (WYSIWYG).
 */
export async function uploadToWebDavChannel(
  config: WebDAVChannel,
  file: File,
  folder: string,
): Promise<Result<WebDavUploadResult, DavError>> {
  if (!config.baseUrl?.trim()) {
    return err({
      reason: "WEBDAV_NOT_CONFIGURED",
      message: "WebDAV base URL is required",
    });
  }

  try {
    if (folder && config.createDirectory !== false) {
      const ensured = await ensureWebDavFolder(config, folder);
      if (ensured.error) return ensured;
    }

    const ext = file.name.includes(".")
      ? file.name.split(".").pop()!.toLowerCase()
      : "png";
    const fileName = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const filePath = folder ? `${folder}/${fileName}` : fileName;

    const body = await file.arrayBuffer();
    const response = await fetch(buildWebDavUrl(config, filePath), {
      method: "PUT",
      headers: {
        ...authHeaders(config),
        "Content-Type": file.type || "application/octet-stream",
      },
      body,
    });

    if (!response.ok && response.status !== 201 && response.status !== 204) {
      return err({
        reason: "WEBDAV_UPLOAD_FAILED",
        message: await readErrorText(response),
      });
    }

    return ok({
      key: filePath,
      url: buildWebDavPublicUrl(config, filePath),
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      sizeInBytes: file.size,
    });
  } catch (error) {
    return err({
      reason: "WEBDAV_UPLOAD_FAILED",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

interface ParsedPropEntry {
  href: string;
  isCollection: boolean;
  contentLength: number;
  contentType?: string;
}

function parseMultiStatus(xml: string): ParsedPropEntry[] {
  const entries: ParsedPropEntry[] = [];
  const blocks = xml.split(/<[\w-]*:?response\b/i).slice(1);

  for (const block of blocks) {
    const hrefMatch = block.match(/<[\w-]*:?href[^>]*>([^<]+)<\/[\w-]*:?href>/i);
    if (!hrefMatch) continue;

    entries.push({
      href: decodeURIComponent(hrefMatch[1]),
      isCollection:
        /<[\w-]*:?resourcetype[^>]*>\s*<[\w-]*:?collection\s*\/?>/i.test(block),
      contentLength:
        parseInt(
          block.match(/<[\w-]*:?getcontentlength[^>]*>(\d+)</i)?.[1] ?? "0",
          10,
        ) || 0,
      contentType: block.match(
        /<[\w-]*:?getcontenttype[^>]*>([^<]+)</i,
      )?.[1],
    });
  }

  return entries;
}

/**
 * List one directory level via PROPFIND (Depth: 1).
 */
export async function listWebDavDirectory(
  config: WebDAVChannel,
  folder: string,
): Promise<
  Result<
    {
      files: WebDavListedFile[];
      folders: Array<{ key: string; name: string }>;
    },
    DavError
  >
> {
  if (!config.baseUrl?.trim()) {
    return err({
      reason: "WEBDAV_NOT_CONFIGURED",
      message: "WebDAV base URL is required",
    });
  }

  try {
    const targetUrl = buildWebDavUrl(config, folder);
    const response = await fetch(targetUrl, {
      method: "PROPFIND",
      headers: { ...authHeaders(config), Depth: "1" },
    });

    // A missing collection behaves like an empty folder.
    if (response.status === 404) {
      return ok({ files: [], folders: [] });
    }
    if (!response.ok && response.status !== 207) {
      return err({
        reason: "WEBDAV_LIST_FAILED",
        message: await readErrorText(response),
      });
    }

    const xml = await response.text();
    const selfPath = decodeURIComponent(new URL(targetUrl).pathname).replace(
      /\/+$/,
      "",
    );

    const files: WebDavListedFile[] = [];
    const folders: Array<{ key: string; name: string }> = [];

    for (const entry of parseMultiStatus(xml)) {
      const entryPath = entry.href.replace(/\/+$/, "");
      if (!entryPath || entryPath === selfPath) continue;

      const name = entryPath.split("/").pop() ?? entryPath;
      if (!name) continue;

      const relKey = folder ? `${folder}/${name}` : name;

      if (entry.isCollection) {
        folders.push({ key: `${relKey}/`, name });
      } else {
        files.push({
          key: relKey,
          name,
          url: config.publicUrl?.trim()
            ? buildWebDavPublicUrl(config, relKey)
            : entry.href,
          mimeType: entry.contentType || guessMimeFromName(name),
          sizeInBytes: entry.contentLength,
        });
      }
    }

    return ok({ files, folders });
  } catch (error) {
    return err({
      reason: "WEBDAV_LIST_FAILED",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Recursively collect every file path under a prefix by walking
 * Depth:1 PROPFINDs (avoids relying on Depth:infinity support).
 */
export async function listAllWebDavFilePaths(
  config: WebDAVChannel,
  prefix: string,
): Promise<Result<string[], DavError>> {
  if (!config.baseUrl?.trim()) {
    return err({
      reason: "WEBDAV_NOT_CONFIGURED",
      message: "WebDAV base URL is required",
    });
  }

  try {
    const filePaths: string[] = [];
    const queue: string[] = [prefix];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const listing = await listWebDavDirectory(config, current);
      if (listing.error) return listing;

      for (const file of listing.data.files) {
        filePaths.push(file.key);
      }
      for (const sub of listing.data.folders) {
        queue.push(sub.key.replace(/\/+$/, ""));
      }
    }

    return ok(filePaths);
  } catch (error) {
    return err({
      reason: "WEBDAV_LIST_FAILED",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Delete one or many paths. Deleting a missing object counts as success.
 */
export async function deleteWebDavPaths(
  config: WebDAVChannel,
  paths: string[],
): Promise<Result<{ deleted: number; failed: string[] }, DavError>> {
  if (!config.baseUrl?.trim()) {
    return err({
      reason: "WEBDAV_NOT_CONFIGURED",
      message: "WebDAV base URL is required",
    });
  }

  const failed: string[] = [];

  try {
    for (const path of paths) {
      try {
        const response = await fetch(buildWebDavUrl(config, path), {
          method: "DELETE",
          headers: authHeaders(config),
        });
        if (
          response.ok ||
          response.status === 404 ||
          response.status === 204
        ) {
          continue;
        }
        failed.push(path);
      } catch {
        failed.push(path);
      }
    }

    if (failed.length > 0) {
      return err({
        reason: "WEBDAV_DELETE_FAILED",
        message: `Failed to delete ${failed.length} item(s)`,
      });
    }
    return ok({ deleted: paths.length, failed });
  } catch (error) {
    return err({
      reason: "WEBDAV_DELETE_FAILED",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * MOVE a file or collection to a new path (rename/move/folder rename).
 * Destination parents are created first; existing targets are overwritten.
 */
export async function moveWebDavObject(
  config: WebDAVChannel,
  fromPath: string,
  toPath: string,
): Promise<Result<{ success: boolean }, DavError>> {
  if (!config.baseUrl?.trim()) {
    return err({
      reason: "WEBDAV_NOT_CONFIGURED",
      message: "WebDAV base URL is required",
    });
  }

  try {
    const parent = toPath.includes("/") ? toPath.slice(0, toPath.lastIndexOf("/")) : "";
    if (parent && config.createDirectory !== false) {
      const ensured = await ensureWebDavFolder(config, parent);
      if (ensured.error) return ensured;
    }

    const response = await fetch(buildWebDavUrl(config, fromPath), {
      method: "MOVE",
      headers: {
        ...authHeaders(config),
        Destination: buildWebDavUrl(config, toPath),
        Overwrite: "T",
      },
    });

    if (
      !response.ok &&
      response.status !== 201 &&
      response.status !== 204
    ) {
      return err({
        reason: "WEBDAV_MOVE_FAILED",
        message: await readErrorText(response),
      });
    }
    return ok({ success: true });
  } catch (error) {
    return err({
      reason: "WEBDAV_MOVE_FAILED",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

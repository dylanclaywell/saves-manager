import { readdir, stat } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

export interface BrowseEntry {
  name: string;
  /** Forward-slash path relative to the mount root */
  relPath: string;
  isDirectory: boolean;
  sizeBytes?: number;
  mtimeMs?: number;
}

export interface BrowseResult {
  mountPath: string;
  relPath: string;
  /** Path segments from the mount root to the current directory */
  breadcrumbs: { name: string; relPath: string }[];
  entries: BrowseEntry[];
}

/**
 * List the contents of a directory inside a mounted device, with breadcrumbs.
 * `relPath` is the forward-slash path relative to `mountPath`. The result
 * refuses to escape the mount root.
 */
export async function browseDir(mountPath: string, relPath: string): Promise<BrowseResult> {
  const root = resolve(mountPath);
  const requested = resolve(root, relPath.replace(/^[\\/]+/, "").split("/").join(sep));
  // Refuse path traversal. `relative` returns "" when requested === root,
  // and a leading ".." (or an absolute path on Windows) when requested escapes
  // root. This handles drive-root mounts like "E:\\" where `root + sep` would
  // be "E:\\\\" — never matching descendants like "E:\\ACTIVITY".
  const rel = relative(root, requested);
  const inside =
    rel === "" ||
    (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel));
  const safe = inside ? requested : root;
  const safeRel = relative(root, safe).split(sep).join("/");

  const dirents = await readdir(safe, { withFileTypes: true });
  const entries: BrowseEntry[] = [];
  for (const d of dirents) {
    const fullPath = join(safe, d.name);
    let isDirectory = d.isDirectory();
    let sizeBytes: number | undefined;
    let mtimeMs: number | undefined;
    try {
      const s = await stat(fullPath);
      isDirectory = s.isDirectory();
      if (!isDirectory) sizeBytes = s.size;
      mtimeMs = s.mtimeMs;
    } catch {
      continue;
    }
    entries.push({
      name: d.name,
      relPath: [safeRel, d.name].filter(Boolean).join("/"),
      isDirectory,
      sizeBytes,
      mtimeMs,
    });
  }

  entries.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });

  const breadcrumbs: { name: string; relPath: string }[] = [{ name: "/", relPath: "" }];
  if (safeRel) {
    const parts = safeRel.split("/");
    let acc = "";
    for (const p of parts) {
      acc = acc ? `${acc}/${p}` : p;
      breadcrumbs.push({ name: p, relPath: acc });
    }
  }

  return { mountPath: root, relPath: safeRel, breadcrumbs, entries };
}

import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { CORES } from "./cores";

export interface ActivityEntry {
  /** Lowercased, punctuation-stripped name used as the join key when aggregating
      across devices. */
  normalizedName: string;
  /** The prettiest filename-derived label we've seen for this game. */
  displayName: string;
  /** RetroArch core directory name (parent folder of the .lrtl file). */
  core: string;
  /** Human-friendly system/platform derived from the core, if known. */
  system?: string;
  runtimeSeconds: number;
  playCount: number;
  /** ISO timestamp parsed from the .lrtl's `last_played` field. */
  lastPlayedAt?: string;
  /** Path of the source .lrtl, relative to the logs dir, using forward slashes. */
  sourceFile: string;
  /** mtime of the .lrtl in ms — used by the cache layer for incremental refresh. */
  sourceMtimeMs: number;
}

export interface ScanResult {
  entries: ActivityEntry[];
  /** Files we attempted to read but failed to parse, with the underlying reason. */
  errors: { sourceFile: string; reason: string }[];
}

/** Raw shape we accept from a `.lrtl` file. RetroArch writes all values as strings. */
interface RawLrtl {
  version?: string;
  runtime?: string;       // "H:MM:SS"
  last_played?: string;   // "YYYY-MM-DD HH:MM:SS"
  play_count?: string;
  state_slot?: string;
}

const ROM_EXTENSIONS = new Set([
  ".gba", ".gb", ".gbc", ".nes", ".fds", ".unf", ".unif",
  ".smc", ".sfc", ".swc", ".fig",
  ".sms", ".gg", ".gen", ".md", ".smd", ".bin",
  ".iso", ".cue", ".chd", ".img", ".pbp",
  ".nds", ".3ds", ".cia",
  ".z64", ".n64", ".v64",
  ".pce", ".sgx",
  ".ws", ".wsc",
  ".ngp", ".ngc",
  ".a26", ".a78", ".lnx", ".col",
  ".rom", ".zip", ".7z", ".rar",
]);

/** Parse "H:MM:SS" or "HH:MM:SS" into seconds. Returns 0 on bad input. */
function parseRuntime(raw: string | undefined): number {
  if (!raw) return 0;
  const parts = raw.split(":").map((s) => Number.parseInt(s, 10));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return 0;
  const [h, m, s] = parts;
  return h * 3600 + m * 60 + s;
}

/** Parse "YYYY-MM-DD HH:MM:SS" (naive local) into an ISO string. */
function parseLastPlayed(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/.exec(raw);
  if (!match) return undefined;
  const [, y, mo, d, h, mi, s] = match;
  const dt = new Date(
    Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s),
  );
  if (Number.isNaN(dt.getTime())) return undefined;
  return dt.toISOString();
}

/** Strip the `.lrtl` extension and any trailing known ROM extension. */
function deriveDisplayName(filename: string): string {
  let name = filename.endsWith(".lrtl") ? filename.slice(0, -".lrtl".length) : filename;
  const lastDot = name.lastIndexOf(".");
  if (lastDot > 0) {
    const ext = name.slice(lastDot).toLowerCase();
    if (ROM_EXTENSIONS.has(ext)) name = name.slice(0, lastDot);
  }
  return name;
}

/** Normalize a display name into a join key:
 *  - lowercase
 *  - strip parenthetical and bracketed tags (regions, revs, dump flags)
 *  - replace non-alphanumeric runs with a single space, then trim. */
export function normalizeGameName(display: string): string {
  return display
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export interface LrtlFileRef {
  core: string;
  filename: string;
  absPath: string;
  /** Forward-slash path relative to the logs dir (e.g. "mGBA/Pokemon Emerald.lrtl"). */
  sourceFile: string;
  mtimeMs: number;
}

/** Stat every `<logsDir>/<core>/*.lrtl` file without reading any contents. Cheap
 *  enough to call every scan — supports the cache's mtime-based skip. */
export async function enumerateLrtlFiles(logsDir: string): Promise<LrtlFileRef[]> {
  let coreDirs: string[];
  try {
    const entries = await readdir(logsDir, { withFileTypes: true });
    coreDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch (err) {
    throw new Error(`Cannot read RetroArch activity dir "${logsDir}": ${(err as Error).message}`);
  }

  const out: LrtlFileRef[] = [];
  for (const core of coreDirs) {
    const coreAbs = join(logsDir, core);
    let files;
    try {
      files = await readdir(coreAbs, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const f of files) {
      if (!f.isFile() || !f.name.toLowerCase().endsWith(".lrtl")) continue;
      const absPath = join(coreAbs, f.name);
      let mtimeMs = 0;
      try {
        mtimeMs = (await stat(absPath)).mtimeMs;
      } catch {
        continue;
      }
      out.push({
        core,
        filename: f.name,
        absPath,
        sourceFile: `${core}/${f.name}`,
        mtimeMs,
      });
    }
  }
  return out;
}

/** Parse a single `.lrtl` into an `ActivityEntry`, or push an error and return null. */
export async function parseLrtl(
  ref: LrtlFileRef,
  errors: { sourceFile: string; reason: string }[],
): Promise<ActivityEntry | null> {
  let raw: RawLrtl;
  try {
    const content = await readFile(ref.absPath, "utf8");
    raw = JSON.parse(content) as RawLrtl;
  } catch (err) {
    errors.push({ sourceFile: ref.sourceFile, reason: (err as Error).message });
    return null;
  }
  const displayName = deriveDisplayName(ref.filename);
  const normalizedName = normalizeGameName(displayName);
  if (!normalizedName) {
    errors.push({ sourceFile: ref.sourceFile, reason: "empty normalized name" });
    return null;
  }
  return {
    normalizedName,
    displayName,
    core: ref.core,
    system: CORES[ref.core]?.displaySystem,
    runtimeSeconds: parseRuntime(raw.runtime),
    playCount: raw.play_count ? Math.max(0, Number.parseInt(raw.play_count, 10) || 0) : 0,
    lastPlayedAt: parseLastPlayed(raw.last_played),
    sourceFile: ref.sourceFile,
    sourceMtimeMs: ref.mtimeMs,
  };
}

/** Walk `<logsDir>/<core>/*.lrtl` and parse every entry. Used when no prior cache exists. */
export async function scanLogsDir(logsDir: string): Promise<ScanResult> {
  const errors: { sourceFile: string; reason: string }[] = [];
  const refs = await enumerateLrtlFiles(logsDir);
  const entries: ActivityEntry[] = [];
  for (const ref of refs) {
    const entry = await parseLrtl(ref, errors);
    if (entry) entries.push(entry);
  }
  return { entries, errors };
}

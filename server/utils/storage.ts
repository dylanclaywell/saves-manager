import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import envPaths from "env-paths";
import type { ConfigFile } from "./types";

const paths = envPaths("savesmanager", { suffix: "" });
export const CONFIG_DIR = paths.config;
export const CONFIG_PATH = join(CONFIG_DIR, "config.json");
export const BACKUP_DIR = join(paths.data, "backups");

const EMPTY_CONFIG: ConfigFile = {
  version: 1,
  devices: [],
  profiles: [],
  virtualMounts: [],
};

export async function loadConfig(): Promise<ConfigFile> {
  if (!existsSync(CONFIG_PATH)) {
    return structuredClone(EMPTY_CONFIG);
  }
  const raw = await readFile(CONFIG_PATH, "utf8");
  const parsed = JSON.parse(raw) as ConfigFile;
  // Defensive: fill in missing arrays if the file is from an older shape
  parsed.devices ??= [];
  parsed.profiles ??= [];
  parsed.virtualMounts ??= [];
  parsed.version ??= 1;
  return parsed;
}

export async function saveConfig(cfg: ConfigFile): Promise<void> {
  await mkdir(dirname(CONFIG_PATH), { recursive: true });
  const tmp = `${CONFIG_PATH}.tmp`;
  await writeFile(tmp, JSON.stringify(cfg, null, 2), "utf8");
  await rename(tmp, CONFIG_PATH);
}

export async function ensureBackupDir(): Promise<string> {
  await mkdir(BACKUP_DIR, { recursive: true });
  return BACKUP_DIR;
}

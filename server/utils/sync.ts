import { copyFile, mkdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, dirname, join, sep } from "node:path";
import { ensureBackupDir } from "./storage";
import type { Profile, SlotKey } from "./types";

export interface SyncPlan {
  source: ResolvedSlot;
  destination: ResolvedSlot;
}

export interface ResolvedSlot {
  slotKey: SlotKey;
  deviceId: string;
  deviceNickname: string;
  mountPath: string;
  /** Absolute filesystem path. For directory slots, this is the directory
      itself; the actual file is determined at transfer time. */
  absolutePath: string;
  /** Stored path relative to the device root (forward slashes). */
  fileRelPath: string;
  /** True iff the slot is configured to receive a file into a folder, with
      the filename derived from the other side at transfer time. */
  directoryMode: boolean;
  /** For file slots: whether the file exists.
      For directory slots: whether the directory exists. */
  exists: boolean;
  sizeBytes?: number;
  mtimeMs?: number;
}

export async function resolveSlot(
  profile: Profile,
  slotKey: SlotKey,
  mountPath: string,
  deviceNickname: string,
): Promise<ResolvedSlot> {
  const slot = profile[slotKey];
  if (!slot) {
    throw new Error(`Profile "${profile.name}" has no ${slotKey} configured`);
  }
  const absolutePath = join(mountPath, slot.fileRelPath.split("/").join(sep));
  const directoryMode = slot.isDirectory === true;
  const result: ResolvedSlot = {
    slotKey,
    deviceId: slot.deviceId,
    deviceNickname,
    mountPath,
    absolutePath,
    fileRelPath: slot.fileRelPath,
    directoryMode,
    exists: existsSync(absolutePath),
  };
  if (result.exists && !directoryMode) {
    try {
      const s = await stat(absolutePath);
      result.sizeBytes = s.size;
      result.mtimeMs = s.mtimeMs;
    } catch {
      // ignore
    }
  }
  return result;
}

export interface TransferResult {
  bytesCopied: number;
  destinationPath: string;
  backupPath?: string;
}

/**
 * Copy source.absolutePath to destination.absolutePath. If the destination
 * already exists, first move a timestamped copy into the user's data dir so
 * the user can recover from an accidental overwrite.
 *
 * If the destination slot is directoryMode, the destination filename is
 * derived from the source basename. The source must always be a real file.
 */
export async function transfer(source: ResolvedSlot, destination: ResolvedSlot): Promise<TransferResult> {
  if (source.directoryMode) {
    throw new Error(
      `Source slot (${source.deviceNickname}) is configured as a folder — pick a specific file in that slot, or transfer in the other direction.`,
    );
  }
  if (!source.exists) {
    throw new Error(
      `Source file does not exist on ${source.deviceNickname}: ${source.absolutePath}`,
    );
  }

  const destinationFilePath = destination.directoryMode
    ? join(destination.absolutePath, basename(source.absolutePath))
    : destination.absolutePath;

  if (source.absolutePath === destinationFilePath) {
    throw new Error("Source and destination resolve to the same path; refusing to copy.");
  }

  await mkdir(dirname(destinationFilePath), { recursive: true });

  let backupPath: string | undefined;
  if (existsSync(destinationFilePath)) {
    backupPath = await backupFile(destination, destinationFilePath);
  }

  await copyFile(source.absolutePath, destinationFilePath);
  const s = await stat(destinationFilePath);
  return { bytesCopied: s.size, destinationPath: destinationFilePath, backupPath };
}

async function backupFile(slot: ResolvedSlot, absoluteFilePath: string): Promise<string> {
  const backupRoot = await ensureBackupDir();
  const stamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .replace("Z", "");
  const safeNickname = slot.deviceNickname.replace(/[^a-zA-Z0-9._-]+/g, "_");
  const safeRel = basename(absoluteFilePath).replace(/[\\/]+/g, "__");
  const backupName = `${stamp}__${safeNickname}__${safeRel}`;
  const backupPath = join(backupRoot, backupName);
  await copyFile(absoluteFilePath, backupPath);
  return backupPath;
}

export function describeSlotResolved(s: ResolvedSlot): string {
  if (s.directoryMode) {
    return `${s.deviceNickname}:/${s.fileRelPath}/ (folder — file created at transfer time)`;
  }
  const size = s.sizeBytes !== undefined ? ` (${s.sizeBytes} bytes)` : "";
  const when = s.mtimeMs ? `, modified ${new Date(s.mtimeMs).toLocaleString()}` : "";
  return s.exists
    ? `${s.deviceNickname}:/${s.fileRelPath}${size}${when}`
    : `${s.deviceNickname}:/${s.fileRelPath} (missing)`;
}

export function pickDirection(
  bySlot: Record<SlotKey, ResolvedSlot>,
): { source: SlotKey; destination: SlotKey } | undefined {
  const a = bySlot.slotA;
  const b = bySlot.slotB;
  // A directory-mode slot can never be a source — it has no file yet.
  const aCanSource = !a.directoryMode && a.exists;
  const bCanSource = !b.directoryMode && b.exists;
  if (aCanSource && !bCanSource) return { source: "slotA", destination: "slotB" };
  if (bCanSource && !aCanSource) return { source: "slotB", destination: "slotA" };
  return undefined;
}

export function newerOf(a: ResolvedSlot, b: ResolvedSlot): SlotKey | undefined {
  if (a.mtimeMs && b.mtimeMs) {
    if (a.mtimeMs > b.mtimeMs) return "slotA";
    if (b.mtimeMs > a.mtimeMs) return "slotB";
  }
  return undefined;
}

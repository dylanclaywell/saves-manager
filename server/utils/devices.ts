import { exec } from "node:child_process";
import { readdir, stat, statfs } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { MountedDevice, VirtualMount } from "./types";

const execAsync = promisify(exec);

/** List devices the OS currently has mounted that look plausibly "external". */
export async function listMountedDevices(): Promise<MountedDevice[]> {
  switch (platform()) {
    case "win32":
      return listWindowsDevices();
    case "darwin":
      return listMacDevices();
    default:
      return listLinuxDevices();
  }
}

// ---------- Windows ----------

interface PsVolume {
  DriveLetter: string | null;
  FileSystemLabel: string | null;
  DriveType: string | number | null;
  Size: number | null;
  SizeRemaining: number | null;
}

async function listWindowsDevices(): Promise<MountedDevice[]> {
  // Get-Volume returns DriveType as a friendly string in PS 5.1+ ("Removable",
  // "Fixed", "Network", "CDROM", "Unknown"). We pull everything and filter below.
  const script =
    "Get-Volume | Select-Object DriveLetter, FileSystemLabel, DriveType, Size, SizeRemaining | ConvertTo-Json -Compress";
  let stdout: string;
  try {
    const result = await execAsync(`powershell -NoProfile -Command "${script}"`, {
      windowsHide: true,
      maxBuffer: 4 * 1024 * 1024,
    });
    stdout = result.stdout.trim();
  } catch {
    return [];
  }
  if (!stdout) return [];

  let parsed: PsVolume | PsVolume[];
  try {
    parsed = JSON.parse(stdout) as PsVolume | PsVolume[];
  } catch {
    return [];
  }
  const volumes = Array.isArray(parsed) ? parsed : [parsed];

  return volumes
    .filter((v) => typeof v.DriveLetter === "string" && v.DriveLetter.length === 1)
    .map<MountedDevice>((v) => ({
      mountPath: `${v.DriveLetter}:\\`,
      label: v.FileSystemLabel ?? undefined,
      driveType: typeof v.DriveType === "string" ? v.DriveType : undefined,
      sizeBytes: v.Size ?? undefined,
      freeBytes: v.SizeRemaining ?? undefined,
    }));
}

// ---------- macOS ----------

async function listMacDevices(): Promise<MountedDevice[]> {
  const root = "/Volumes";
  if (!existsSync(root)) return [];
  const entries = await readdir(root, { withFileTypes: true });
  const out: MountedDevice[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
    const mountPath = join(root, entry.name);
    out.push({
      mountPath,
      label: entry.name,
      driveType: "Volume",
      ...(await safeStatfs(mountPath)),
    });
  }
  return out;
}

// ---------- Linux ----------

async function listLinuxDevices(): Promise<MountedDevice[]> {
  const candidates: string[] = [];
  const user = process.env.USER || process.env.LOGNAME;
  if (user) {
    candidates.push(`/media/${user}`, `/run/media/${user}`);
  }
  candidates.push("/media", "/mnt");

  const out: MountedDevice[] = [];
  const seen = new Set<string>();
  for (const root of candidates) {
    if (!existsSync(root)) continue;
    let entries;
    try {
      entries = await readdir(root, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
      const mountPath = join(root, entry.name);
      if (seen.has(mountPath)) continue;
      seen.add(mountPath);
      // Heuristic: skip empty mount-point dirs (no media inserted)
      try {
        const st = await stat(mountPath);
        if (!st.isDirectory()) continue;
      } catch {
        continue;
      }
      out.push({
        mountPath,
        label: entry.name,
        driveType: "Removable",
        ...(await safeStatfs(mountPath)),
      });
    }
  }
  // Also include the user's home so testing without removable media is possible.
  if (out.length === 0 && existsSync(homedir())) {
    out.push({
      mountPath: homedir(),
      label: "home",
      driveType: "Fixed",
      ...(await safeStatfs(homedir())),
    });
  }
  return out;
}

async function safeStatfs(p: string): Promise<{ sizeBytes?: number; freeBytes?: number }> {
  try {
    const s = await statfs(p);
    return { sizeBytes: s.blocks * s.bsize, freeBytes: s.bfree * s.bsize };
  } catch {
    return {};
  }
}

/**
 * Build a MountedDevice entry for a user-configured folder. The folder must
 * already exist; size/free figures reflect the underlying host filesystem.
 */
export async function describeVirtualMount(
  path: string,
  label?: string,
): Promise<MountedDevice | null> {
  if (!existsSync(path)) return null;
  return {
    mountPath: path,
    label,
    driveType: "Virtual",
    ...(await safeStatfs(path)),
  };
}

/**
 * Physical (OS-reported) mounts merged with the configured virtual mounts.
 * Physical entries win on duplicate paths.
 */
export async function listAllMounts(virtualMounts: VirtualMount[]): Promise<MountedDevice[]> {
  const physical = await listMountedDevices();
  const seen = new Set(physical.map((m) => m.mountPath));
  const out = [...physical];
  for (const v of virtualMounts) {
    if (seen.has(v.path)) continue;
    const md = await describeVirtualMount(v.path, v.label);
    if (md) out.push(md);
  }
  return out;
}

/** Format a byte count as a short human-readable string. */
export function formatBytes(n?: number): string {
  if (n === undefined || n === null || Number.isNaN(n)) return "?";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

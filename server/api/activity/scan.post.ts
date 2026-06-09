import { existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { listAllMounts } from "../../utils/devices";
import { readMarker } from "../../utils/deviceId";
import { loadConfig } from "../../utils/storage";
import {
  deviceCacheKey,
  refreshCache,
  virtualMountCacheKey,
  type RefreshSummary,
} from "../../utils/activityCache";

type SourceKind = "device" | "virtualMount";

interface ScanTarget {
  cacheKey: string;
  sourceKind: SourceKind;
  sourceLabel: string;
  absLogsDir: string;
}

interface ScanResultRow {
  cacheKey: string;
  sourceKind: SourceKind;
  sourceLabel: string;
  summary?: RefreshSummary;
  error?: string;
  skippedReason?: string;
}

async function isDir(p: string): Promise<boolean> {
  if (!existsSync(p)) return false;
  try {
    return (await stat(p)).isDirectory();
  } catch {
    return false;
  }
}

export default defineEventHandler(async (event) => {
  const body = await readBody<{ cacheKey?: string }>(event);
  const onlyKey = body?.cacheKey?.trim() || undefined;

  const cfg = await loadConfig();
  const mounts = await listAllMounts(cfg.virtualMounts);

  // Build a deviceId → current mount path lookup by reading markers.
  const deviceMountPaths = new Map<string, string>();
  for (const m of mounts) {
    const marker = await readMarker(m.mountPath);
    if (marker?.id) deviceMountPaths.set(marker.id, m.mountPath);
  }

  // Collect every configured scan target.
  const targets: ScanTarget[] = [];
  const unreachable: ScanResultRow[] = [];

  for (const dev of cfg.devices) {
    if (!dev.retroarchActivityDir) continue;
    const mountPath = deviceMountPaths.get(dev.id);
    if (!mountPath) {
      unreachable.push({
        cacheKey: deviceCacheKey(dev.id),
        sourceKind: "device",
        sourceLabel: dev.nickname,
        skippedReason: "device not currently mounted",
      });
      continue;
    }
    targets.push({
      cacheKey: deviceCacheKey(dev.id),
      sourceKind: "device",
      sourceLabel: dev.nickname,
      absLogsDir: join(mountPath, dev.retroarchActivityDir),
    });
  }

  for (const vm of cfg.virtualMounts) {
    if (!vm.retroarchActivityDir) continue;
    const absVm = resolve(vm.path);
    const cacheKey = virtualMountCacheKey(absVm);
    targets.push({
      cacheKey,
      sourceKind: "virtualMount",
      sourceLabel: vm.label || vm.path,
      absLogsDir: join(absVm, vm.retroarchActivityDir),
    });
  }

  const filtered = onlyKey ? targets.filter((t) => t.cacheKey === onlyKey) : targets;
  const filteredUnreachable = onlyKey
    ? unreachable.filter((u) => u.cacheKey === onlyKey)
    : unreachable;

  const results: ScanResultRow[] = [...filteredUnreachable];
  for (const t of filtered) {
    if (!(await isDir(t.absLogsDir))) {
      results.push({
        cacheKey: t.cacheKey,
        sourceKind: t.sourceKind,
        sourceLabel: t.sourceLabel,
        error: `logs folder not found at ${t.absLogsDir}`,
      });
      continue;
    }
    try {
      const summary = await refreshCache(t.cacheKey, t.absLogsDir);
      results.push({
        cacheKey: t.cacheKey,
        sourceKind: t.sourceKind,
        sourceLabel: t.sourceLabel,
        summary,
      });
    } catch (err) {
      results.push({
        cacheKey: t.cacheKey,
        sourceKind: t.sourceKind,
        sourceLabel: t.sourceLabel,
        error: (err as Error).message,
      });
    }
  }

  return { results };
});

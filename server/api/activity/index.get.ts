import { resolve } from "node:path";
import { loadConfig } from "../../utils/storage";
import {
  deviceCacheKey,
  listAllCaches,
  virtualMountCacheKey,
} from "../../utils/activityCache";
import type { ActivityEntry } from "../../utils/retroarchActivity";
import { CORES } from "../../utils/cores";
import { hasThumbnail } from "../../utils/thumbnails";

interface PerDevice {
  cacheKey: string;
  sourceKind: "device" | "virtualMount";
  sourceLabel: string;
  runtimeSeconds: number;
  playCount: number;
  lastPlayedAt?: string;
}

interface AggregatedGame {
  normalizedName: string;
  displayName: string;
  system?: string;
  cores: string[];
  /** libretro-thumbnails repo names this game's cores could pull box art from. */
  libretroDbNames: string[];
  totalSeconds: number;
  totalPlayCount: number;
  lastPlayedAt?: string;
  /** True when a cached thumbnail exists on the server for this game. */
  hasThumbnail: boolean;
  perDevice: PerDevice[];
}

interface DeviceSummary {
  cacheKey: string;
  sourceKind: "device" | "virtualMount";
  sourceLabel: string;
  configured: boolean;
  cacheExists: boolean;
  lastScannedAt?: string;
  retroarchActivityDir?: string;
  entryCount?: number;
}

export default defineEventHandler(async () => {
  const cfg = await loadConfig();
  const caches = await listAllCaches();

  // Map cacheKey → human-readable label + sourceKind for both real devices and
  // virtual mounts. Needed to attach a friendly label to each per-device breakdown.
  const sourceByCacheKey = new Map<
    string,
    { sourceLabel: string; sourceKind: "device" | "virtualMount"; retroarchActivityDir?: string }
  >();
  for (const dev of cfg.devices) {
    sourceByCacheKey.set(deviceCacheKey(dev.id), {
      sourceLabel: dev.nickname,
      sourceKind: "device",
      retroarchActivityDir: dev.retroarchActivityDir,
    });
  }
  for (const vm of cfg.virtualMounts) {
    sourceByCacheKey.set(virtualMountCacheKey(resolve(vm.path)), {
      sourceLabel: vm.label || vm.path,
      sourceKind: "virtualMount",
      retroarchActivityDir: vm.retroarchActivityDir,
    });
  }

  const games = new Map<string, AggregatedGame>();

  function fold(entry: ActivityEntry, perDev: PerDevice): void {
    const existing = games.get(entry.normalizedName);
    const candidateDbNames = CORES[entry.core]?.libretroDbNames ?? [];
    if (!existing) {
      games.set(entry.normalizedName, {
        normalizedName: entry.normalizedName,
        displayName: entry.displayName,
        system: entry.system,
        cores: [entry.core],
        libretroDbNames: [...candidateDbNames],
        totalSeconds: perDev.runtimeSeconds,
        totalPlayCount: perDev.playCount,
        lastPlayedAt: perDev.lastPlayedAt,
        hasThumbnail: false, // populated after the fold loop
        perDevice: [perDev],
      });
      return;
    }
    existing.totalSeconds += perDev.runtimeSeconds;
    existing.totalPlayCount += perDev.playCount;
    if (
      perDev.lastPlayedAt &&
      (!existing.lastPlayedAt || perDev.lastPlayedAt > existing.lastPlayedAt)
    ) {
      existing.lastPlayedAt = perDev.lastPlayedAt;
    }
    if (!existing.cores.includes(entry.core)) existing.cores.push(entry.core);
    for (const db of candidateDbNames) {
      if (!existing.libretroDbNames.includes(db)) existing.libretroDbNames.push(db);
    }
    if (!existing.system && entry.system) existing.system = entry.system;
    // Prefer the longest displayName as the "prettiest" (usually carries region tags).
    if (entry.displayName.length > existing.displayName.length) {
      existing.displayName = entry.displayName;
    }
    existing.perDevice.push(perDev);
  }

  for (const cache of caches) {
    const src = sourceByCacheKey.get(cache.cacheKey);
    const sourceLabel = src?.sourceLabel ?? cache.cacheKey;
    const sourceKind = src?.sourceKind ?? "device";
    for (const entry of cache.entries) {
      fold(entry, {
        cacheKey: cache.cacheKey,
        sourceKind,
        sourceLabel,
        runtimeSeconds: entry.runtimeSeconds,
        playCount: entry.playCount,
        lastPlayedAt: entry.lastPlayedAt,
      });
    }
  }

  // Fill in `hasThumbnail` from disk for every aggregated game (one stat per game).
  for (const game of games.values()) {
    game.hasThumbnail = await hasThumbnail(game.normalizedName);
  }

  // Default sort: most recently played first, then by total seconds desc.
  const sortedGames = [...games.values()].sort((a, b) => {
    if (a.lastPlayedAt && b.lastPlayedAt) {
      if (a.lastPlayedAt > b.lastPlayedAt) return -1;
      if (a.lastPlayedAt < b.lastPlayedAt) return 1;
    } else if (a.lastPlayedAt) {
      return -1;
    } else if (b.lastPlayedAt) {
      return 1;
    }
    return b.totalSeconds - a.totalSeconds;
  });

  // Device summary: every configured source PLUS any cache files whose source has
  // since been removed (so the user knows there's stale data sitting around).
  const cachesByKey = new Map(caches.map((c) => [c.cacheKey, c]));
  const summaries: DeviceSummary[] = [];
  const seenKeys = new Set<string>();

  for (const dev of cfg.devices) {
    const key = deviceCacheKey(dev.id);
    seenKeys.add(key);
    const cache = cachesByKey.get(key);
    summaries.push({
      cacheKey: key,
      sourceKind: "device",
      sourceLabel: dev.nickname,
      configured: Boolean(dev.retroarchActivityDir),
      cacheExists: Boolean(cache),
      lastScannedAt: cache?.scannedAt,
      retroarchActivityDir: dev.retroarchActivityDir,
      entryCount: cache?.entries.length,
    });
  }
  for (const vm of cfg.virtualMounts) {
    const key = virtualMountCacheKey(resolve(vm.path));
    seenKeys.add(key);
    const cache = cachesByKey.get(key);
    summaries.push({
      cacheKey: key,
      sourceKind: "virtualMount",
      sourceLabel: vm.label || vm.path,
      configured: Boolean(vm.retroarchActivityDir),
      cacheExists: Boolean(cache),
      lastScannedAt: cache?.scannedAt,
      retroarchActivityDir: vm.retroarchActivityDir,
      entryCount: cache?.entries.length,
    });
  }
  for (const cache of caches) {
    if (seenKeys.has(cache.cacheKey)) continue;
    summaries.push({
      cacheKey: cache.cacheKey,
      sourceKind: "device",
      sourceLabel: "(removed source)",
      configured: false,
      cacheExists: true,
      lastScannedAt: cache.scannedAt,
      entryCount: cache.entries.length,
    });
  }

  return { games: sortedGames, devices: summaries };
});

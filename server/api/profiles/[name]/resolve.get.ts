import { basename } from "node:path";
import { loadConfig } from "../../../utils/storage";
import { findProfile, findDevice, profileIsReady } from "../../../utils/profiles";
import { listAllMounts } from "../../../utils/devices";
import { readMarker } from "../../../utils/deviceId";
import { resolveSlot } from "../../../utils/sync";
import type { SlotKey } from "../../../utils/types";

export default defineEventHandler(async (event) => {
  const name = getRouterParam(event, "name");
  if (!name) throw createError({ statusCode: 400, statusMessage: "name required" });
  const decoded = decodeURIComponent(name);
  const cfg = await loadConfig();
  const profile = findProfile(cfg, decoded);
  if (!profile) throw createError({ statusCode: 404, statusMessage: "profile not found" });

  const mounts = await listAllMounts(cfg.virtualMounts);
  const mountByDeviceId = new Map<string, string>();
  for (const m of mounts) {
    const marker = await readMarker(m.mountPath);
    if (marker) mountByDeviceId.set(marker.id, m.mountPath);
  }

  const ready = profileIsReady(profile);

  async function resolveOne(slotKey: SlotKey) {
    const slot = profile[slotKey];
    if (!slot) return null;
    const device = findDevice(cfg, slot.deviceId) ?? null;
    const mountPath = mountByDeviceId.get(slot.deviceId);
    if (!mountPath || !device) {
      return {
        slotKey,
        deviceId: slot.deviceId,
        deviceNickname: device?.nickname ?? "(unknown device)",
        mounted: false,
        fileRelPath: slot.fileRelPath,
        directoryMode: slot.isDirectory === true,
        exists: false,
      };
    }
    const resolved = await resolveSlot(profile, slotKey, mountPath, device.nickname);
    return { ...resolved, mounted: true };
  }

  const slotA = await resolveOne("slotA");
  const slotB = await resolveOne("slotB");

  // If one side is a directory slot and the other side has a real file,
  // the filename that will be created on the directory side is the basename
  // of the file side. Pre-compute it server-side so the UI can quote it.
  function pendingFor(self: typeof slotA, other: typeof slotA): string | null {
    if (!self || !other) return null;
    if (!self.directoryMode) return null;
    if (other.directoryMode) return null;
    if (!other.fileRelPath) return null;
    return basename(other.fileRelPath);
  }

  return {
    name: profile.name,
    ready,
    slotA: slotA ? { ...slotA, pendingFileName: pendingFor(slotA, slotB) } : null,
    slotB: slotB ? { ...slotB, pendingFileName: pendingFor(slotB, slotA) } : null,
  };
});

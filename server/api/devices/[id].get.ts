import { listAllMounts } from "../../utils/devices";
import { readMarker } from "../../utils/deviceId";
import { findDevice } from "../../utils/profiles";
import { loadConfig } from "../../utils/storage";
import { deviceCacheKey } from "../../utils/activityCache";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, statusMessage: "id required" });

  const cfg = await loadConfig();
  const dev = findDevice(cfg, id);
  if (!dev) throw createError({ statusCode: 404, statusMessage: "device not found" });

  // Find this device's current mount, if any, by reading markers from each mount.
  const mounts = await listAllMounts(cfg.virtualMounts);
  let currentMountPath: string | undefined;
  for (const m of mounts) {
    const marker = await readMarker(m.mountPath);
    if (marker?.id === id) {
      currentMountPath = m.mountPath;
      break;
    }
  }

  // Every profile slot that references this device — drives the "Save slots" section.
  const slots: {
    profileName: string;
    slotKey: "slotA" | "slotB";
    fileRelPath: string;
    isDirectory?: boolean;
  }[] = [];
  for (const p of cfg.profiles) {
    for (const key of ["slotA", "slotB"] as const) {
      const slot = p[key];
      if (slot && slot.deviceId === id) {
        slots.push({
          profileName: p.name,
          slotKey: key,
          fileRelPath: slot.fileRelPath,
          isDirectory: slot.isDirectory,
        });
      }
    }
  }

  return {
    device: {
      ...dev,
      mounted: Boolean(currentMountPath),
      currentMountPath,
      activityCacheKey: deviceCacheKey(dev.id),
    },
    slots,
  };
});

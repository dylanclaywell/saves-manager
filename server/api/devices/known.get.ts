import { loadConfig } from "../../utils/storage";
import { listAllMounts } from "../../utils/devices";
import { readMarker } from "../../utils/deviceId";
import { deviceCacheKey } from "../../utils/activityCache";

export default defineEventHandler(async () => {
  const cfg = await loadConfig();
  const mounts = await listAllMounts(cfg.virtualMounts);
  const deviceMountPaths = new Map<string, string>();
  for (const m of mounts) {
    const marker = await readMarker(m.mountPath);
    if (marker) deviceMountPaths.set(marker.id, m.mountPath);
  }
  return {
    devices: cfg.devices.map((d) => ({
      ...d,
      mounted: deviceMountPaths.has(d.id),
      currentMountPath: deviceMountPaths.get(d.id),
      activityCacheKey: deviceCacheKey(d.id),
    })),
  };
});

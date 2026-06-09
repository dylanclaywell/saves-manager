import { listAllMounts } from "../../utils/devices";
import { readMarker } from "../../utils/deviceId";
import { loadConfig } from "../../utils/storage";

export default defineEventHandler(async () => {
  const cfg = await loadConfig();
  const mounts = await listAllMounts(cfg.virtualMounts);
  const enriched = await Promise.all(
    mounts.map(async (m) => {
      const marker = await readMarker(m.mountPath);
      const known = marker ? cfg.devices.find((d) => d.id === marker.id) : undefined;
      return {
        ...m,
        virtual: m.driveType === "Virtual",
        marker: marker
          ? { id: marker.id, nickname: marker.nickname, registeredAt: marker.registeredAt }
          : null,
        knownNickname: known?.nickname ?? null,
      };
    }),
  );
  return { mounts: enriched };
});

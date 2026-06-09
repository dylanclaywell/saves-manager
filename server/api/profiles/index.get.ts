import { loadConfig } from "../../utils/storage";
import { profileIsReady } from "../../utils/profiles";

export default defineEventHandler(async () => {
  const cfg = await loadConfig();
  return {
    profiles: cfg.profiles.map((p) => ({ ...p, ready: profileIsReady(p) })),
    devices: cfg.devices,
  };
});

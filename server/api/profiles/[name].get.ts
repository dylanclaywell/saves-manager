import { loadConfig } from "../../utils/storage";
import { findProfile, findDevice, profileIsReady } from "../../utils/profiles";

export default defineEventHandler(async (event) => {
  const name = getRouterParam(event, "name");
  if (!name) throw createError({ statusCode: 400, statusMessage: "name required" });
  const decoded = decodeURIComponent(name);
  const cfg = await loadConfig();
  const profile = findProfile(cfg, decoded);
  if (!profile) throw createError({ statusCode: 404, statusMessage: "profile not found" });
  return {
    profile: { ...profile, ready: profileIsReady(profile) },
    slotA: profile.slotA ? { ...profile.slotA, device: findDevice(cfg, profile.slotA.deviceId) ?? null } : null,
    slotB: profile.slotB ? { ...profile.slotB, device: findDevice(cfg, profile.slotB.deviceId) ?? null } : null,
  };
});

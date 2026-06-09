import { loadConfig, saveConfig } from "../../../utils/storage";
import { findProfile, setSlot, upsertProfile } from "../../../utils/profiles";
import type { SlotKey } from "../../../utils/types";

export default defineEventHandler(async (event) => {
  const name = getRouterParam(event, "name");
  if (!name) throw createError({ statusCode: 400, statusMessage: "name required" });
  const decoded = decodeURIComponent(name);
  const body = await readBody<{
    slotKey?: SlotKey;
    deviceId?: string;
    fileRelPath?: string;
    isDirectory?: boolean;
  }>(event);
  if (body?.slotKey !== "slotA" && body?.slotKey !== "slotB") {
    throw createError({ statusCode: 400, statusMessage: "slotKey must be slotA or slotB" });
  }
  const deviceId = body.deviceId?.trim();
  const fileRelPath = body.fileRelPath?.replace(/^[\\/]+/, "").trim();
  if (!deviceId) throw createError({ statusCode: 400, statusMessage: "deviceId required" });
  if (fileRelPath === undefined || fileRelPath === null) {
    throw createError({ statusCode: 400, statusMessage: "fileRelPath required" });
  }

  const cfg = await loadConfig();
  const profile = findProfile(cfg, decoded);
  if (!profile) throw createError({ statusCode: 404, statusMessage: "profile not found" });
  setSlot(profile, body.slotKey, {
    deviceId,
    fileRelPath,
    ...(body.isDirectory ? { isDirectory: true } : {}),
  });
  upsertProfile(cfg, profile);
  await saveConfig(cfg);
  return { profile };
});

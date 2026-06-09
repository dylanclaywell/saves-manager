import { loadConfig, saveConfig } from "../../utils/storage";
import { findProfile, newProfile, upsertProfile } from "../../utils/profiles";

export default defineEventHandler(async (event) => {
  const body = await readBody<{ name?: string; notes?: string }>(event);
  const name = body?.name?.trim();
  if (!name) throw createError({ statusCode: 400, statusMessage: "name required" });
  const cfg = await loadConfig();
  if (findProfile(cfg, name)) {
    throw createError({ statusCode: 409, statusMessage: "profile name already exists" });
  }
  const profile = newProfile(name, body?.notes?.trim() || undefined);
  upsertProfile(cfg, profile);
  await saveConfig(cfg);
  return { profile };
});

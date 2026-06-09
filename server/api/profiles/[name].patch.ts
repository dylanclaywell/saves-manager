import { loadConfig, saveConfig } from "../../utils/storage";
import { deleteProfile, findProfile, upsertProfile } from "../../utils/profiles";

export default defineEventHandler(async (event) => {
  const name = getRouterParam(event, "name");
  if (!name) throw createError({ statusCode: 400, statusMessage: "name required" });
  const decoded = decodeURIComponent(name);
  const body = await readBody<{ name?: string; notes?: string }>(event);
  const cfg = await loadConfig();
  const profile = findProfile(cfg, decoded);
  if (!profile) throw createError({ statusCode: 404, statusMessage: "profile not found" });

  if (typeof body?.notes === "string") {
    profile.notes = body.notes.trim() || undefined;
  }
  const newName = body?.name?.trim();
  if (newName && newName.toLowerCase() !== profile.name.toLowerCase()) {
    if (findProfile(cfg, newName)) {
      throw createError({ statusCode: 409, statusMessage: "name already in use" });
    }
    deleteProfile(cfg, profile.name);
    profile.name = newName;
  }
  profile.updatedAt = new Date().toISOString();
  upsertProfile(cfg, profile);
  await saveConfig(cfg);
  return { profile };
});

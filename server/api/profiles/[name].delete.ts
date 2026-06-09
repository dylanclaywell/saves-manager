import { loadConfig, saveConfig } from "../../utils/storage";
import { deleteProfile } from "../../utils/profiles";

export default defineEventHandler(async (event) => {
  const name = getRouterParam(event, "name");
  if (!name) throw createError({ statusCode: 400, statusMessage: "name required" });
  const decoded = decodeURIComponent(name);
  const cfg = await loadConfig();
  const removed = deleteProfile(cfg, decoded);
  if (!removed) throw createError({ statusCode: 404, statusMessage: "profile not found" });
  await saveConfig(cfg);
  return { ok: true };
});

import { resolve } from "node:path";
import { loadConfig, saveConfig } from "../../utils/storage";

export default defineEventHandler(async (event) => {
  const body = await readBody<{ path?: string }>(event);
  const raw = body?.path?.trim();
  if (!raw) throw createError({ statusCode: 400, statusMessage: "path required" });
  // Normalize so the caller can pass forward-slashes / unresolved paths and still match.
  const path = resolve(raw);
  const cfg = await loadConfig();
  const before = cfg.virtualMounts.length;
  cfg.virtualMounts = cfg.virtualMounts.filter((v) => resolve(v.path) !== path);
  if (cfg.virtualMounts.length === before) {
    throw createError({ statusCode: 404, statusMessage: "virtual mount not found" });
  }
  await saveConfig(cfg);
  return { ok: true };
});

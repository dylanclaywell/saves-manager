import { loadConfig, saveConfig } from "../../utils/storage";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, statusMessage: "id required" });
  const cfg = await loadConfig();
  const before = cfg.devices.length;
  cfg.devices = cfg.devices.filter((d) => d.id !== id);
  if (cfg.devices.length === before) {
    throw createError({ statusCode: 404, statusMessage: "device not found" });
  }
  await saveConfig(cfg);
  return { ok: true };
});

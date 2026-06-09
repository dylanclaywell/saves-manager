import { writeMarker, readMarker } from "../../utils/deviceId";
import { loadConfig, saveConfig } from "../../utils/storage";
import { upsertDevice } from "../../utils/profiles";

export default defineEventHandler(async (event) => {
  const body = await readBody<{ mountPath?: string; nickname?: string }>(event);
  const mountPath = body?.mountPath?.trim();
  const nickname = body?.nickname?.trim();
  if (!mountPath) throw createError({ statusCode: 400, statusMessage: "mountPath required" });
  if (!nickname) throw createError({ statusCode: 400, statusMessage: "nickname required" });

  const existing = await readMarker(mountPath);
  if (existing) {
    throw createError({
      statusCode: 409,
      statusMessage: `Device at ${mountPath} already registered as "${existing.nickname}"`,
    });
  }

  const identity = await writeMarker(mountPath, nickname);
  const cfg = await loadConfig();
  upsertDevice(cfg, identity);
  await saveConfig(cfg);
  return { device: identity };
});

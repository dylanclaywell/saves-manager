import { basename } from "node:path";
import { loadConfig, saveConfig } from "../../../utils/storage";
import { findProfile, findDevice, profileIsReady, setSlot, upsertProfile } from "../../../utils/profiles";
import { listAllMounts } from "../../../utils/devices";
import { readMarker } from "../../../utils/deviceId";
import { resolveSlot, transfer } from "../../../utils/sync";

export default defineEventHandler(async (event) => {
  const name = getRouterParam(event, "name");
  if (!name) throw createError({ statusCode: 400, statusMessage: "name required" });
  const decoded = decodeURIComponent(name);
  const body = await readBody<{ direction?: "AtoB" | "BtoA" }>(event);
  if (body?.direction !== "AtoB" && body?.direction !== "BtoA") {
    throw createError({ statusCode: 400, statusMessage: "direction must be AtoB or BtoA" });
  }

  const cfg = await loadConfig();
  const profile = findProfile(cfg, decoded);
  if (!profile) throw createError({ statusCode: 404, statusMessage: "profile not found" });
  if (!profileIsReady(profile)) {
    throw createError({ statusCode: 400, statusMessage: "profile is not ready (both slots required)" });
  }

  const devA = findDevice(cfg, profile.slotA!.deviceId);
  const devB = findDevice(cfg, profile.slotB!.deviceId);
  if (!devA || !devB) {
    throw createError({ statusCode: 400, statusMessage: "one or both devices are unknown" });
  }

  const mounts = await listAllMounts(cfg.virtualMounts);
  let mountA: string | undefined;
  let mountB: string | undefined;
  for (const m of mounts) {
    const marker = await readMarker(m.mountPath);
    if (!marker) continue;
    if (marker.id === devA.id) mountA = m.mountPath;
    if (marker.id === devB.id) mountB = m.mountPath;
  }
  if (!mountA || !mountB) {
    throw createError({
      statusCode: 400,
      statusMessage: `Device not mounted: ${!mountA ? devA.nickname : ""}${
        !mountA && !mountB ? " and " : ""
      }${!mountB ? devB.nickname : ""}`,
    });
  }

  const resolvedA = await resolveSlot(profile, "slotA", mountA, devA.nickname);
  const resolvedB = await resolveSlot(profile, "slotB", mountB, devB.nickname);
  const source = body.direction === "AtoB" ? resolvedA : resolvedB;
  const destination = body.direction === "AtoB" ? resolvedB : resolvedA;
  if (source.directoryMode) {
    throw createError({
      statusCode: 400,
      statusMessage: `Source slot (${source.deviceNickname}) is a folder. Pick a specific file in that slot or transfer in the other direction.`,
    });
  }
  if (!source.exists) {
    throw createError({
      statusCode: 400,
      statusMessage: `Source file does not exist on ${source.deviceNickname}`,
    });
  }

  try {
    const result = await transfer(source, destination);

    // If the destination slot was a folder target, promote it to a regular
    // file slot now that the file exists at <folder>/<sourceBasename>.
    // Without this the slot stays in "waiting" state and round-trip transfers
    // back from this device wouldn't work.
    let promotedSlot: { slotKey: "slotA" | "slotB"; fileRelPath: string } | null = null;
    if (destination.directoryMode) {
      const destSlotKey = body.direction === "AtoB" ? "slotB" : "slotA";
      const dirRel = destination.fileRelPath.replace(/[\\/]+$/, "");
      const newRel = [dirRel, basename(source.fileRelPath)].filter(Boolean).join("/");
      setSlot(profile, destSlotKey, { deviceId: destination.deviceId, fileRelPath: newRel });
      upsertProfile(cfg, profile);
      await saveConfig(cfg);
      promotedSlot = { slotKey: destSlotKey, fileRelPath: newRel };
    }

    return {
      ok: true,
      bytesCopied: result.bytesCopied,
      destinationPath: result.destinationPath,
      backupPath: result.backupPath ?? null,
      promotedSlot,
    };
  } catch (err) {
    throw createError({ statusCode: 500, statusMessage: (err as Error).message });
  }
});

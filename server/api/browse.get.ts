import { resolve } from "node:path";
import { browseDir } from "../utils/browse";
import { listAllMounts } from "../utils/devices";
import { loadConfig } from "../utils/storage";

export default defineEventHandler(async (event) => {
  const q = getQuery(event) as { mount?: string; path?: string };
  const mount = q.mount?.toString();
  const path = (q.path ?? "").toString();
  if (!mount) throw createError({ statusCode: 400, statusMessage: "mount required" });

  // Restrict browsing to paths the OS reports as mounted or that the user
  // has explicitly added as a virtual mount. Without this, the endpoint
  // would happily list anywhere on the host filesystem.
  const cfg = await loadConfig();
  const mounts = await listAllMounts(cfg.virtualMounts);
  const requested = resolve(mount);
  const allowed = mounts.some((m) => resolve(m.mountPath) === requested);
  if (!allowed) {
    throw createError({
      statusCode: 403,
      statusMessage: "mount is not in the allowed set (not a real volume or configured virtual mount)",
    });
  }

  try {
    return await browseDir(mount, path);
  } catch (err) {
    throw createError({ statusCode: 500, statusMessage: (err as Error).message });
  }
});

import { createReadStream } from "node:fs";
import { findThumbnailPath } from "../../utils/thumbnails";

export default defineEventHandler(async (event) => {
  const raw = getRouterParam(event, "name");
  if (!raw) throw createError({ statusCode: 400, statusMessage: "name required" });
  const normalizedName = decodeURIComponent(raw);

  const file = await findThumbnailPath(normalizedName);
  if (!file) {
    throw createError({ statusCode: 404, statusMessage: "thumbnail not cached" });
  }

  // Long browser cache — the cache is invalidated by client-side URL busting
  // after a successful download / delete.
  setResponseHeader(event, "Content-Type", file.mime);
  setResponseHeader(event, "Cache-Control", "public, max-age=86400");
  return sendStream(event, createReadStream(file.absPath));
});

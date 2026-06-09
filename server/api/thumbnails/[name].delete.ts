import { deleteThumbnail } from "../../utils/thumbnails";

export default defineEventHandler(async (event) => {
  const raw = getRouterParam(event, "name");
  if (!raw) throw createError({ statusCode: 400, statusMessage: "name required" });
  const normalizedName = decodeURIComponent(raw);
  const removed = await deleteThumbnail(normalizedName);
  return { removed };
});

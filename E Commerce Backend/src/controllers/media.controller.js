import Media from "../models/media.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { detectMedia } from "../utils/media.utils.js";
import { toDirectImageUrl } from "../utils/imageUrl.utils.js";

const parseBoolean = (v) => v === true || v === "true" || v === 1 || v === "1";

// Build the persisted fields from a request body. `type` is always derived from
// the url. `thumbnail` uses the admin-supplied value when present (Drive links
// normalized), otherwise the auto-derived one (YouTube/Drive/direct image).
const buildFields = (body) => {
  const url = (body.url || "").trim();
  const detected = detectMedia(url);
  const adminThumb = (body.thumbnail || "").trim();
  const out = {
    url,
    title: (body.title || "").trim(),
    handle: (body.handle || "").trim(),
    type: detected.type,
    thumbnail: adminThumb ? toDirectImageUrl(adminThumb) : detected.thumbnail,
  };
  if (body.isActive !== undefined) out.isActive = parseBoolean(body.isActive);
  if (body.position !== undefined) out.position = parseInt(body.position, 10) || 0;
  if (body.likes !== undefined) out.likes = Math.max(0, parseInt(body.likes, 10) || 0);
  if (body.comments !== undefined) out.comments = Math.max(0, parseInt(body.comments, 10) || 0);
  return out;
};

export const createMedia = async (req, res, next) => {
  try {
    const fields = buildFields(req.body);
    if (!fields.url) throw new ApiError(400, "A media link (URL) is required");
    const media = await Media.create(fields);
    res.status(201).json(new ApiResponse(201, { media }, "Media added"));
  } catch (err) {
    next(err);
  }
};

export const getActiveMedia = async (req, res, next) => {
  try {
    const media = await Media.find({ isActive: true }).sort({ position: 1, createdAt: -1 });
    // Newly-added highlights must show up immediately — never serve stale from a
    // browser/edge cache (same approach as the brands list).
    res.set("Cache-Control", "no-store");
    res.json(new ApiResponse(200, { media }));
  } catch (err) {
    next(err);
  }
};

export const getAllMedia = async (req, res, next) => {
  try {
    const media = await Media.find().sort({ position: 1, createdAt: -1 });
    res.set("Cache-Control", "no-store");
    res.json(new ApiResponse(200, { media }));
  } catch (err) {
    next(err);
  }
};

export const updateMedia = async (req, res, next) => {
  try {
    const media = await Media.findById(req.params.mediaId);
    if (!media) throw new ApiError(404, "Media not found");

    // Re-derive type/thumbnail only when a url is supplied; otherwise keep
    // existing and just apply the partial (e.g. isActive toggle, reorder).
    if (req.body.url !== undefined) {
      Object.assign(media, buildFields(req.body));
    } else {
      if (req.body.title !== undefined) media.title = (req.body.title || "").trim();
      if (req.body.thumbnail !== undefined) {
        const t = (req.body.thumbnail || "").trim();
        media.thumbnail = t ? toDirectImageUrl(t) : detectMedia(media.url).thumbnail;
      }
      if (req.body.isActive !== undefined) media.isActive = parseBoolean(req.body.isActive);
      if (req.body.position !== undefined) media.position = parseInt(req.body.position, 10) || 0;
    }

    await media.save();
    res.json(new ApiResponse(200, { media }, "Media updated"));
  } catch (err) {
    next(err);
  }
};

export const deleteMedia = async (req, res, next) => {
  try {
    const media = await Media.findByIdAndDelete(req.params.mediaId);
    if (!media) throw new ApiError(404, "Media not found");
    res.json(new ApiResponse(200, null, "Media deleted"));
  } catch (err) {
    next(err);
  }
};

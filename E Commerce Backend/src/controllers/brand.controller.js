import Brand from "../models/brand.model.js";
import { generateUniqueSlug } from "../utils/slugify.utils.js";
import { toDirectImageUrl } from "../utils/imageUrl.utils.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";

const nameRegex = (name) =>
  new RegExp(`^${name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');

// Lookup helper that catches casing + whitespace variants the unique index would reject.
const findExistingBrand = async (rawName) => {
  const trimmed = rawName.trim();
  // 1) Case-insensitive exact match (our normal path)
  const byRegex = await Brand.findOne({ name: { $regex: nameRegex(trimmed) } });
  if (byRegex) return byRegex;
  // 2) Fallback — strip non-alphanumerics so "samsung " / "Samsung " / "Samsung-" all collide.
  const norm = trimmed.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!norm) return null;
  const candidates = await Brand.find({}).select("name isActive logo slug");
  return candidates.find(b => b.name.toLowerCase().replace(/[^a-z0-9]/g, "") === norm) || null;
};

export const createBrand = async (req, res, next) => {
  try {
    const { name } = req.body;
    // Google Drive *share* links don't render in <img>; rewrite to the direct
    // embeddable form (same handling as banners / product images).
    const logo = toDirectImageUrl(req.body.logo);
    if (!name) throw new ApiError(400, "Brand name is required");
    const trimmed = name.trim();

    const existing = await findExistingBrand(trimmed);
    if (existing) {
      if (existing.isActive) throw new ApiError(409, `Brand "${existing.name}" already exists`);
      // Reactivate a previously hidden brand instead of confusing the admin with a duplicate error.
      existing.isActive = true;
      if (logo) existing.logo = logo;
      await existing.save();
      return res.status(200).json(new ApiResponse(200, { brand: existing }, `Brand "${existing.name}" was hidden — it has been restored`));
    }

    const slug = await generateUniqueSlug(trimmed, Brand);
    try {
      const brand = await Brand.create({ name: trimmed, slug, logo });
      return res.status(201).json(new ApiResponse(201, { brand }, "Brand created"));
    } catch (err) {
      // Mongo unique index caught a duplicate the pre-check missed (rare edge cases —
      // race, unusual whitespace, collation differences). Recover by reactivating.
      if (err?.code === 11000) {
        const dup = await findExistingBrand(trimmed);
        if (dup) {
          if (dup.isActive) {
            throw new ApiError(409, `Brand "${dup.name}" already exists`);
          }
          dup.isActive = true;
          if (logo) dup.logo = logo;
          await dup.save();
          return res.status(200).json(new ApiResponse(200, { brand: dup }, `Brand "${dup.name}" was hidden — it has been restored`));
        }
      }
      throw err;
    }
  } catch (err) { next(err); }
};

export const getAllBrands = async (req, res, next) => {
  try {
    // Mounted on two paths:
    //   GET /brands       (public)     — active brands only
    //   GET /brands/all   (admin/emp)  — includes hidden brands so staff can restore them
    const isAdminAll = req.path === "/all" && req.user && (req.user.role === "admin" || req.user.role === "employee");
    const filter = isAdminAll ? {} : { isActive: true };
    const brands = await Brand.find(filter).sort({ name: 1 });
    // The catalog changes the moment an admin/employee adds or edits a brand, so
    // the list must never be served stale from a browser or edge/CDN cache —
    // otherwise a freshly-added brand stays invisible to other staff even after
    // a hard refresh. Force revalidation on every request.
    res.set("Cache-Control", "no-store");
    res.json(new ApiResponse(200, { brands }));
  } catch (err) { next(err); }
};

export const restoreBrand = async (req, res, next) => {
  try {
    const brand = await Brand.findByIdAndUpdate(req.params.brandId, { isActive: true }, { new: true });
    if (!brand) throw new ApiError(404, "Brand not found");
    res.json(new ApiResponse(200, { brand }, "Brand restored"));
  } catch (err) { next(err); }
};

export const updateBrand = async (req, res, next) => {
  try {
    const { name, isActive } = req.body;
    const logo = toDirectImageUrl(req.body.logo);
    const updates = { logo, isActive };
    if (name) {
      const trimmed = name.trim();
      const existing = await Brand.findOne({
        name: { $regex: new RegExp(`^${trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
        _id: { $ne: req.params.brandId },
      });
      if (existing) throw new ApiError(409, `Brand "${trimmed}" already exists`);
      updates.name = trimmed;
      updates.slug = await generateUniqueSlug(trimmed, Brand, req.params.brandId);
    }
    const brand = await Brand.findByIdAndUpdate(req.params.brandId, updates, { new: true });
    if (!brand) throw new ApiError(404, "Brand not found");
    res.json(new ApiResponse(200, { brand }, "Brand updated"));
  } catch (err) { next(err); }
};

export const deleteBrand = async (req, res, next) => {
  try {
    await Brand.findByIdAndUpdate(req.params.brandId, { isActive: false });
    res.json(new ApiResponse(200, null, "Brand deactivated"));
  } catch (err) { next(err); }
};

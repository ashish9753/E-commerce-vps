import ApiError from "./ApiError.js";

// Shared helpers for the manual "priority" ordering used by Brands and
// Categories on the home page.
//
//   priority = -1  → no manual order (item sorts after pinned ones, then A→Z)
//   priority >=  0 → pinned slot; must be unique within its collection so two
//                    items never fight for the same position.

// Parse an incoming priority value from the request body.
//   - undefined / null / "" → undefined (caller leaves the field untouched)
//   - otherwise must be an integer >= -1
export const normalizePriority = (raw) => {
  if (raw === undefined || raw === null || raw === "") return undefined;
  const n = Number(raw);
  if (!Number.isInteger(n)) throw new ApiError(400, "Priority must be a whole number");
  if (n < -1) throw new ApiError(400, "Priority must be -1 (none) or 0 and above");
  return n;
};

// Returns the document already occupying `priority`, or null. -1/undefined
// never conflict (multiple items may be "unpinned").
export const findPriorityConflict = async (Model, priority, excludeId = null) => {
  if (priority === undefined || priority < 0) return null;
  const query = { priority };
  if (excludeId) query._id = { $ne: excludeId };
  return Model.findOne(query);
};

// Sort comparator: pinned items first by ascending priority, the rest A→Z
// (case-insensitive) by name.
export const byPriorityThenName = (a, b) => {
  const pa = a.priority >= 0 ? a.priority : Infinity;
  const pb = b.priority >= 0 ? b.priority : Infinity;
  if (pa !== pb) return pa - pb;
  return (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" });
};

import Settings from "../models/settings.model.js";
import ApiResponse from "../utils/ApiResponse.js";

const COD_KEY = "codBooking";

const DEFAULT_COD = {
  // Global order limits (all payment methods)
  minOrderAmount: 0,       // any order below this is blocked (0 = no minimum)
  maxOrderAmount: 0,       // any order above this is blocked (0 = no maximum)

  // COD availability
  codEnabled: true,        // when false, COD option hidden at checkout

  // COD booking (non-refundable advance, collected via Fonepay before the order is confirmed)
  bookingEnabled: false,
  bookingType: "flat",     // "flat" | "percent"
  bookingValue: 500,
};

export const getCodSettings = async (req, res, next) => {
  try {
    const doc = await Settings.findOne({ key: COD_KEY });
    res.json(new ApiResponse(200, { codSettings: doc?.value ?? DEFAULT_COD }));
  } catch (err) { next(err); }
};

export const updateCodSettings = async (req, res, next) => {
  try {
    const value = { ...DEFAULT_COD, ...req.body };
    const doc = await Settings.findOneAndUpdate(
      { key: COD_KEY },
      { value },
      { upsert: true, new: true }
    );
    res.json(new ApiResponse(200, { codSettings: doc.value }, "COD settings updated"));
  } catch (err) { next(err); }
};

/* ─── Delivery charge settings ─── */

const DELIVERY_KEY = "deliverySettings";

export const DEFAULT_DELIVERY = {
  defaultCharge: 50,
  freeThresholdEnabled: true,
  freeThreshold: 500,
};

export const getDeliverySettings = async (req, res, next) => {
  try {
    const doc = await Settings.findOne({ key: DELIVERY_KEY });
    res.json(new ApiResponse(200, { deliverySettings: doc?.value ?? DEFAULT_DELIVERY }));
  } catch (err) { next(err); }
};

export const updateDeliverySettings = async (req, res, next) => {
  try {
    const value = { ...DEFAULT_DELIVERY, ...req.body };
    const doc = await Settings.findOneAndUpdate(
      { key: DELIVERY_KEY },
      { value },
      { upsert: true, new: true }
    );
    res.json(new ApiResponse(200, { deliverySettings: doc.value }, "Delivery settings updated"));
  } catch (err) { next(err); }
};

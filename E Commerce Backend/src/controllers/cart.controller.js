import Cart from "../models/cart.model.js";
import Product from "../models/product.model.js";
import Coupon from "../models/coupon.model.js";
import { validateCouponAudience } from "../utils/couponAudience.utils.js";
import { computeCouponEligibility } from "../utils/couponEligibility.utils.js";
import { resolveColor } from "../utils/color.utils.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";

// Recompute discountAmount for the cart's currently applied coupon based on the
// items present right now. If the coupon is no longer valid (expired, audience
// mismatch, no eligible items left) it's silently dropped — the user gets a
// fresh chance to re-apply at the next interaction instead of a broken total.
const reapplyCouponIfAny = async (cart, userId) => {
  if (!cart.coupon) {
    cart.discountAmount = 0;
    return;
  }
  const couponId = cart.coupon._id || cart.coupon;
  const coupon = await Coupon.findById(couponId);
  if (!coupon) {
    cart.coupon = null;
    cart.discountAmount = 0;
    return;
  }
  const validity = coupon.isValid(cart.totalPrice, userId);
  if (!validity.valid) {
    cart.coupon = null;
    cart.discountAmount = 0;
    return;
  }
  const audience = await validateCouponAudience(coupon, userId);
  if (!audience.valid) {
    cart.coupon = null;
    cart.discountAmount = 0;
    return;
  }
  const { applicableAmount, hasRestrictions } = await computeCouponEligibility(coupon, cart.items);
  if (hasRestrictions && applicableAmount <= 0) {
    cart.coupon = null;
    cart.discountAmount = 0;
    return;
  }
  cart.discountAmount = coupon.calculateDiscount(applicableAmount);
};

const getOrCreateCart = async (userId) => {
  let cart = await Cart.findOne({ user: userId });
  if (!cart) cart = await Cart.create({ user: userId, items: [] });
  return cart;
};

// Fields the cart UI needs for each line item. Keep in sync with getCart so
// that mutation responses (add/update/remove) carry the same populated shape
// the frontend already has — otherwise setCart() would wipe images/titles.
const CART_PRODUCT_SELECT = "title price discountPrice images stock colors isDeleted isPublished brand category";

export const getCart = async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id }).populate({
      path: "items.product",
      select: "title price discountPrice images stock colors isDeleted isPublished brand category",
    }).populate({
      path: "coupon",
      select: "code discountType discountValue applicableBrands applicableCategories applicableSubcategories freebieProduct freebieQuantity",
      populate: { path: "freebieProduct", select: "title images stock" },
    });

    if (!cart) return res.json(new ApiResponse(200, { cart: { items: [], totalItems: 0, totalPrice: 0, finalPrice: 0 } }));

    // Remove deleted/unpublished products
    cart.items = cart.items.filter((item) => item.product && !item.product.isDeleted && item.product.isPublished);
    cart.recalculate();
    await reapplyCouponIfAny(cart, req.user._id);
    cart.finalPrice = parseFloat((cart.totalPrice - cart.discountAmount).toFixed(2));
    await cart.save();

    res.json(new ApiResponse(200, { cart }));
  } catch (err) {
    next(err);
  }
};

export const addToCart = async (req, res, next) => {
  try {
    const { productId, quantity = 1, color = "" } = req.body;
    if (!productId) throw new ApiError(400, "productId is required");

    const qty = Math.max(1, parseInt(quantity));
    const product = await Product.findOne({ _id: productId, isDeleted: false, isPublished: true });
    if (!product) throw new ApiError(404, "Product not found");

    const resolved = resolveColor(product, color);
    if (!resolved) throw new ApiError(400, "Please select a valid color for this product");
    if (resolved.stock <= 0) {
      throw new ApiError(400, resolved.color ? `Color "${resolved.color}" is out of stock` : "This product is out of stock");
    }

    const price = resolved.price;
    const lineColor = resolved.color;
    const cart = await getOrCreateCart(req.user._id);

    // A cart line is identified by product + color, so red and blue of the same
    // product are separate lines.
    const existingIndex = cart.items.findIndex(
      (i) => i.product.toString() === productId && (i.color || "") === lineColor
    );
    if (existingIndex > -1) {
      const newQty = cart.items[existingIndex].quantity + qty;
      if (newQty > resolved.stock) throw new ApiError(400, `Only ${resolved.stock} in stock`);
      cart.items[existingIndex].quantity = newQty;
      cart.items[existingIndex].price = price;
    } else {
      if (qty > resolved.stock) throw new ApiError(400, `Only ${resolved.stock} in stock`);
      cart.items.push({ product: productId, quantity: qty, price, color: lineColor });
    }

    cart.recalculate();
    await cart.save();
    await cart.populate("items.product", CART_PRODUCT_SELECT);

    res.json(new ApiResponse(200, { cart }, "Item added to cart"));
  } catch (err) {
    next(err);
  }
};

export const updateCartItem = async (req, res, next) => {
  try {
    const { productId, quantity, color = "" } = req.body;
    const qty = parseInt(quantity);
    if (!productId || qty < 1) throw new ApiError(400, "Valid productId and quantity required");

    const product = await Product.findById(productId);
    if (!product) throw new ApiError(404, "Product not found");

    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) throw new ApiError(404, "Cart not found");

    const item = cart.items.find((i) => i.product.toString() === productId && (i.color || "") === color);
    if (!item) throw new ApiError(404, "Item not in cart");

    // Clamp to the selected color's (or product's) available stock.
    const resolved = resolveColor(product, color);
    const avail = resolved ? resolved.stock : (product.stock ?? 0);
    if (qty > avail) throw new ApiError(400, `Only ${avail} in stock`);

    item.quantity = qty;
    cart.recalculate();
    await cart.save();
    await cart.populate("items.product", CART_PRODUCT_SELECT);

    res.json(new ApiResponse(200, { cart }, "Cart updated"));
  } catch (err) {
    next(err);
  }
};

export const removeFromCart = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const color = req.query.color || "";
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) throw new ApiError(404, "Cart not found");

    cart.items = cart.items.filter((i) => !(i.product.toString() === productId && (i.color || "") === color));
    cart.recalculate();
    await cart.save();
    await cart.populate("items.product", CART_PRODUCT_SELECT);

    res.json(new ApiResponse(200, { cart }, "Item removed from cart"));
  } catch (err) {
    next(err);
  }
};

export const clearCart = async (req, res, next) => {
  try {
    await Cart.findOneAndUpdate(
      { user: req.user._id },
      { items: [], coupon: null, totalItems: 0, totalPrice: 0, discountAmount: 0, finalPrice: 0 }
    );
    res.json(new ApiResponse(200, null, "Cart cleared"));
  } catch (err) {
    next(err);
  }
};

// Coupon codes are short alphanumerics with optional dashes/underscores.
// Asserting the type here prevents NoSQL operator injection (e.g. { "$ne": null }).
const COUPON_CODE_RE = /^[A-Z0-9_-]{2,32}$/;
const normalizeCouponCode = (raw) => {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toUpperCase();
  return COUPON_CODE_RE.test(code) ? code : null;
};

export const applyCoupon = async (req, res, next) => {
  try {
    const code = normalizeCouponCode(req.body?.code);
    if (!code) throw new ApiError(400, "Invalid coupon code");

    const cart = await Cart.findOne({ user: req.user._id }).populate(
      "items.product",
      "brand category"
    );
    if (!cart || cart.items.length === 0) throw new ApiError(400, "Cart is empty");

    const coupon = await Coupon.findOne({ code }).populate("freebieProduct", "title images stock isDeleted isPublished");
    if (!coupon) throw new ApiError(404, "Invalid coupon code");

    const validity = coupon.isValid(cart.totalPrice, req.user._id);
    if (!validity.valid) throw new ApiError(400, validity.message);

    const audience = await validateCouponAudience(coupon, req.user._id);
    if (!audience.valid) throw new ApiError(400, audience.message);

    // FREEBIE coupons need a still-available product on the other side.
    if (coupon.discountType === "FREEBIE") {
      const p = coupon.freebieProduct;
      if (!p || p.isDeleted || !p.isPublished) {
        throw new ApiError(400, "The free gift on this coupon is no longer available");
      }
      if ((p.stock ?? 0) < (coupon.freebieQuantity || 1)) {
        throw new ApiError(400, "Sorry, the free gift on this coupon is out of stock");
      }
    }

    // Discount applies only to items matching the coupon's brand/category
    // restrictions. The minimum-amount check above runs against the full cart;
    // that's intentional — "spend ₹X to unlock Y% off Brand Z" stays meaningful.
    const { applicableAmount, hasRestrictions } = await computeCouponEligibility(coupon, cart.items);
    if (hasRestrictions && applicableAmount <= 0) {
      throw new ApiError(400, "This coupon is not applicable to any item in your cart");
    }

    const discount = coupon.calculateDiscount(applicableAmount);
    cart.coupon = coupon._id;
    cart.discountAmount = discount;
    cart.finalPrice = parseFloat((cart.totalPrice - discount).toFixed(2));
    await cart.save();

    const freebie = coupon.discountType === "FREEBIE" && coupon.freebieProduct
      ? {
          _id:      coupon.freebieProduct._id,
          title:    coupon.freebieProduct.title,
          image:    coupon.freebieProduct.images?.[0] || "",
          quantity: coupon.freebieQuantity || 1,
        }
      : null;
    const freeShipping = coupon.discountType === "FREE_SHIPPING";
    const message = coupon.discountType === "FREEBIE"
      ? `Coupon applied! Free gift unlocked: ${freebie?.title}`
      : freeShipping
        ? `Coupon applied! Free shipping unlocked.`
        : `Coupon applied! You saved ₹${discount}`;
    res.json(new ApiResponse(200, {
      discount, finalPrice: cart.finalPrice, freebie, freeShipping,
      discountType: coupon.discountType,
    }, message));
  } catch (err) {
    next(err);
  }
};

export const removeCoupon = async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) throw new ApiError(404, "Cart not found");

    cart.coupon = null;
    cart.discountAmount = 0;
    cart.finalPrice = cart.totalPrice;
    await cart.save();

    res.json(new ApiResponse(200, { cart }, "Coupon removed"));
  } catch (err) {
    next(err);
  }
};

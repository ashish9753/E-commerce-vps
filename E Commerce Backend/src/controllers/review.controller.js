import Review from "../models/review.model.js";
import Product from "../models/product.model.js";
import Order from "../models/order.model.js";
import { uploadToCloudinary, deleteFromCloudinary, getPublicIdFromUrl } from "../utils/cloudinary.utils.js";
import { getPaginationData, buildPaginatedResponse } from "../utils/pagination.utils.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";

// A review may only be edited within this window after it was posted.
const EDIT_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

// Best-effort removal of review images from Cloudinary so deleted/removed
// photos don't keep consuming storage.
const removeImagesFromCloudinary = async (urls = []) => {
  await Promise.all(
    urls.map(async (url) => {
      const publicId = getPublicIdFromUrl(url);
      if (!publicId) return;
      try {
        await deleteFromCloudinary(publicId);
      } catch (e) {
        console.warn("[reviews] failed to delete image from Cloudinary:", e.message);
      }
    })
  );
};

export const createReview = async (req, res, next) => {
  try {
    const { productId, rating, comment, orderId } = req.body;
    if (!productId || !rating) throw new ApiError(400, "productId and rating are required");
    if (rating < 1 || rating > 5) throw new ApiError(400, "Rating must be between 1 and 5");

    // Customers may leave more than one review for a product, so no
    // "already reviewed" restriction here.

    let isVerifiedPurchase = false;
    if (orderId) {
      const order = await Order.findOne({
        _id: orderId,
        user: req.user._id,
        "orderItems.product": productId,
        orderStatus: "DELIVERED",
      });
      if (order) isVerifiedPurchase = true;
    }

    let images = [];
    if (req.files?.length) {
      const uploads = await Promise.all(req.files.map((f) => uploadToCloudinary(f.buffer, "ecommerce/reviews")));
      images = uploads.map((r) => r.secure_url);
    }

    const review = await Review.create({
      user: req.user._id,
      product: productId,
      order: orderId || null,
      rating: parseInt(rating),
      comment,
      images,
      isVerifiedPurchase,
    });

    // Update product rating
    const stats = await Review.aggregate([
      { $match: { product: review.product } },
      { $group: { _id: null, avgRating: { $avg: "$rating" }, count: { $sum: 1 } } },
    ]);

    if (stats.length > 0) {
      await Product.findByIdAndUpdate(productId, {
        rating: parseFloat(stats[0].avgRating.toFixed(1)),
        totalReviews: stats[0].count,
      });
    }

    await review.populate("user", "name profileImage");
    res.status(201).json(new ApiResponse(201, { review }, "Review submitted"));
  } catch (err) {
    next(err);
  }
};

export const getProductReviews = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPaginationData(req.query);
    const filter = { product: req.params.productId };
    if (req.query.rating) filter.rating = parseInt(req.query.rating);

    const [reviews, total] = await Promise.all([
      Review.find(filter)
        .populate("user", "name profileImage")
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      Review.countDocuments(filter),
    ]);

    const ratingBreakdown = await Review.aggregate([
      { $match: { product: reviews[0]?.product || null } },
      { $group: { _id: "$rating", count: { $sum: 1 } } },
      { $sort: { _id: -1 } },
    ]);

    res.json(new ApiResponse(200, { ...buildPaginatedResponse(reviews, total, page, limit), ratingBreakdown }));
  } catch (err) {
    next(err);
  }
};

export const updateReview = async (req, res, next) => {
  try {
    const { rating, comment } = req.body;
    if (rating && (rating < 1 || rating > 5)) throw new ApiError(400, "Rating must be between 1 and 5");

    const review = await Review.findOne({ _id: req.params.reviewId, user: req.user._id });
    if (!review) throw new ApiError(404, "Review not found");

    // Editing is only allowed within 30 minutes of posting.
    if (Date.now() - new Date(review.createdAt).getTime() > EDIT_WINDOW_MS) {
      throw new ApiError(403, "This review can no longer be edited. The 30-minute edit window has passed.");
    }

    // Determine which existing images the client wants to keep. `existingImages`
    // is a JSON array of the surviving image URLs; anything missing is a removal.
    let keep = review.images;
    if (req.body.existingImages !== undefined) {
      let parsed;
      try {
        parsed = typeof req.body.existingImages === "string"
          ? JSON.parse(req.body.existingImages)
          : req.body.existingImages;
      } catch {
        parsed = [];
      }
      keep = Array.isArray(parsed) ? parsed.filter((u) => review.images.includes(u)) : [];
    }

    // Delete removed images from Cloudinary so they don't waste storage.
    const removed = review.images.filter((url) => !keep.includes(url));
    await removeImagesFromCloudinary(removed);

    // Upload any newly added images, capped at 2 total.
    let uploadedUrls = [];
    if (req.files?.length) {
      const slots = Math.max(0, 2 - keep.length);
      const toUpload = req.files.slice(0, slots);
      const uploads = await Promise.all(toUpload.map((f) => uploadToCloudinary(f.buffer, "ecommerce/reviews")));
      uploadedUrls = uploads.map((r) => r.secure_url);
    }

    review.images = [...keep, ...uploadedUrls];
    if (rating) review.rating = parseInt(rating);
    if (comment !== undefined) review.comment = comment;
    await review.save();

    // Recalculate product rating
    const stats = await Review.aggregate([
      { $match: { product: review.product } },
      { $group: { _id: null, avgRating: { $avg: "$rating" }, count: { $sum: 1 } } },
    ]);
    if (stats.length > 0) {
      await Product.findByIdAndUpdate(review.product, {
        rating: parseFloat(stats[0].avgRating.toFixed(1)),
        totalReviews: stats[0].count,
      });
    }

    await review.populate("user", "name profileImage");
    res.json(new ApiResponse(200, { review }, "Review updated"));
  } catch (err) {
    next(err);
  }
};

export const deleteReview = async (req, res, next) => {
  try {
    const query = { _id: req.params.reviewId };
    if (req.user.role !== "admin") query.user = req.user._id;

    const review = await Review.findOneAndDelete(query);
    if (!review) throw new ApiError(404, "Review not found");

    // Free the review's images from Cloudinary storage.
    await removeImagesFromCloudinary(review.images);

    // Recalculate
    const stats = await Review.aggregate([
      { $match: { product: review.product } },
      { $group: { _id: null, avgRating: { $avg: "$rating" }, count: { $sum: 1 } } },
    ]);
    await Product.findByIdAndUpdate(review.product, {
      rating: stats[0]?.avgRating ? parseFloat(stats[0].avgRating.toFixed(1)) : 0,
      totalReviews: stats[0]?.count || 0,
    });

    res.json(new ApiResponse(200, null, "Review deleted"));
  } catch (err) {
    next(err);
  }
};

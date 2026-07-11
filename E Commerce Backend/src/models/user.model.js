import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const addressSchema = new mongoose.Schema({
  fullName: String,
  phone: String,
  pincode: String,
  state: String,
  city: String,
  houseNo: String,
  area: String,
  landmark: String,
  // Upaya delivery refs — captured when the user picks a city from the
  // Upaya-synced location list (instead of free-typing).
  upayaLocationId: { type: Number, default: null },
  upayaAreaId:     { type: Number, default: null },
}, { _id: true });

// One entry per signed-in device. Each device carries its own refresh token,
// so a user can stay logged in on several devices at once (capped per role —
// see getMaxSessions). Staff are capped at 1, which reproduces the old
// single-session behaviour: a new login clears every other session.
const sessionSchema = new mongoose.Schema({
  sessionId:    { type: String, required: true },
  refreshToken: { type: String, required: true },
  userAgent:    { type: String, default: "" },
  createdAt:    { type: Date, default: Date.now },
  lastUsedAt:   { type: Date, default: Date.now },
}, { _id: false });

const savedRefundDetailsSchema = new mongoose.Schema({
  bankTransfer: {
    accountName: String,
    accountNumber: String,
    ifscCode: String,
    bankName: String,
  },
  upi: {
    upiId: String,
  },
  lastRefundMethod: {
    type: String,
    enum: ["bank_transfer", "upi"],
  },
}, { _id: false });

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String },
    // Password is optional so Google-only users (who skip the password step)
    // can still register. Email/password login requires the field to exist.
    password: { type: String, select: false },
    profileImage: String,
    // Google sign-in linkage. Sparse so multiple non-Google users don't collide
    // on null. Unique so the same Google account can't bind to two users.
    googleId: { type: String, unique: true, sparse: true, index: true },
    emailVerified: { type: Boolean, default: false },
    role: { type: String, enum: ["user", "admin", "employee"], default: "user" },
    addresses: [addressSchema],
    savedRefundDetails: savedRefundDetailsSchema,
    wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    isBlocked: { type: Boolean, default: false },
    // Active signed-in devices. A token is only valid while its `sid` still
    // matches a session here, so removing a session (logout, device-cap
    // eviction, or a staff single-session takeover) revokes it instantly.
    sessions: { type: [sessionSchema], default: [], select: false },
    lastLogin: Date,
    resetPasswordToken: String,
    resetPasswordExpiry: Date,
  },
  { timestamps: true }
);

userSchema.index({ resetPasswordToken: 1 }, { sparse: true });

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  // Google-only users have no password — fail comparison cleanly instead of bcrypt
  // throwing on undefined.
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model("User", userSchema);
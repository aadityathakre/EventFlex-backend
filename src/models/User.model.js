import { mongoose, Schema } from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { softDelete } from "../middlewares/softDelete.middleware.js";

const UserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    password: {
      type: String,
      minLength: 5,
    },

    role: {
      type: String,
      enum: ["gig", "organizer", "host"],
      required: true,
      trim: true,
    },

    first_name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    last_name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    wallet: {
      address: { type: String, default: "" },
      privateKey: { type: String, select: false },
      createdAt: { type: Date },
    },

    avatar: {
      type: String,
      default:
        "https://cdn.pixabay.com/photo/2023/02/18/11/00/icon-7797704_640.png",
    },

    universal_role_id: {
      type: String,
      required: true,
      unique: true,
    },

    isVerified: {
      type: Boolean,
      required: true,
      default: false,
    },

    kycVideo: {
      url: { type: String },
      status: {
        type: String,
        enum: ["pending", "verified", "rejected"],
        default: "pending",
      },

      wellnessScore: { type: Number, default: 100 },

      noShowRisk: { type: Number, default: 0 },

      uploadedAt: { type: Date },
    },

    refreshToken: {
      type: String,
      default: "",
    },

    isBanned: {
      type: Boolean,
      default: false,
    },

    digital_signature: {
      type: String,
      trim: true,
      default: "",
    },
     resetOTP:{
      type:String,
    },

    isOTPVerified :{
      type:Boolean,
      default:false,
    },

    otpExpires:{
      type:Date,
    },

    googleId: {
      type: String,
      default: null,
      index: true,
    }
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

//doesnt store in DB but gives fullname when called
UserSchema.virtual("fullName").get(function () {
  return `${this.first_name} ${this.last_name}`;
});
UserSchema.set("toJSON", { virtuals: true });
UserSchema.set("toObject", { virtuals: true });


UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

UserSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};

UserSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      _id: this._id,
      role: this.role,
      email: this.email,
    },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
  );
};

UserSchema.methods.generateRefreshToken = function () {
  return jwt.sign({ _id: this._id }, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
  });
};

// Apply soft delete middleware
softDelete(UserSchema);

const User = mongoose.model("User", UserSchema);
export default User;

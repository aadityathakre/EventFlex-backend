import { mongoose, Schema } from "mongoose";
import User from "./User.model.js";

const UserWalletSchema = new mongoose.Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    upi_id: {
      type: String,
      trim: true,
      default: "1234",
    },

    balance_inr: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
      default: mongoose.Types.Decimal128.fromString("0.0"),
    },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

const UserWallet = mongoose.model("UserWallet", UserWalletSchema);
export default UserWallet;

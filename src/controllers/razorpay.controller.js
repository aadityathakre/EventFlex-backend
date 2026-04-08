import instance from "../utils/razorpay.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import crypto from "crypto";

// create Razorpay order
export const createPayment = asyncHandler(async (req, res) => {
  const { amount, currency } = req.body;

  console.log("Payment request received:", { amount, currency });

  if (!amount || isNaN(amount) || amount <= 0) {
    throw new ApiError(400, "Invalid amount");
  }

  // Check if Razorpay credentials are configured
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    console.error("Razorpay credentials not configured");
    throw new ApiError(500, "Payment gateway not configured");
  }

  const options = {
    amount: Math.round(amount), // smallest currency unit (paise) - ensure integer
    currency: currency || "INR",
    receipt: `receipt_${Math.random().toString(36).substring(7)}`,
  };

  try {
    console.log("Creating Razorpay order with options:", options);
    const order = await instance.orders.create(options);
    console.log("Razorpay order created successfully:", order.id);
    return res.status(200).json(new ApiResponse(200, order, "Payment created successfully"));
  } catch (error) {
    console.error("Razorpay Order Creation Failed:", error);
    console.error("Error details:", error.error);
    throw new ApiError(500, error.message || "Razorpay order creation failed");
  }
});

// Verify Razorpay payment
export const verifyPayment = asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  console.log("Payment verification request received:", { razorpay_order_id, razorpay_payment_id, razorpay_signature });

  // Check if Razorpay credentials are configured
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    console.error("Razorpay credentials not configured");
    throw new ApiError(500, "Payment gateway not configured");
  }

  const generated_signature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(razorpay_order_id + "|" + razorpay_payment_id)
    .digest("hex");

  if (generated_signature === razorpay_signature) {
    return res.status(200).json(new ApiResponse(200, { verified: true }, "Payment verified successfully"));
  }

  return res
    .status(400)
    .json(new ApiResponse(400, null, "Invalid signature, payment verification failed"));
});
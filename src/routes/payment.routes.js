import { createPayment, verifyPayment } from "../controllers/razorpay.controller.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import instance from "../utils/razorpay.js";
import express from 'express';

const router = express.Router();

// Health check for Razorpay
router.get('/health', asyncHandler(async (req, res) => {
  try {
    // Test Razorpay connection by fetching account details
    await instance.accounts.all();
    return res.status(200).json(new ApiResponse(200, { status: 'connected' }, "Razorpay is connected"));
  } catch (error) {
    console.error("Razorpay health check failed:", error);
    return res.status(500).json(new ApiResponse(500, { status: 'disconnected' }, "Razorpay connection failed"));
  }
}));

// Create payment order
router.post('/create', createPayment);

// Verify payment
router.post('/verify', verifyPayment);

export default router;

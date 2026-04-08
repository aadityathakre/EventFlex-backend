import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import EventAttendance from "../models/EventAttendance.model.js";
import Event from "../models/Event.model.js";
import Pool from "../models/Pool.model.js";
import PoolApplication from "../models/PoolApplication.model.js";
import UserWallet from "../models/UserWallet.model.js";
import Payment from "../models/Payment.model.js";
import UserProfile from "../models/UserProfile.model.js";
import UserBadge from "../models/UserBadge.model.js";
import Conversation from "../models/Conversation.model.js";
import Message from "../models/Message.model.js";
import Notification from "../models/Notification.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import EscrowContract from "../models/EscrowContract.model.js";
import Feedback from "../models/Feedback.model.js";
import User from "../models/User.model.js";
import KYCVerification from "../models/KYCVerification.model.js";
import UserDocument from "../models/UserDocument.model.js";
import { ethers } from "ethers";
import mongoose from "mongoose";
import Badge from "../models/Badge.model.js"
import OrganizerPool from "../models/OrganizerPool.model.js";
import Dispute from "../models/Dispute.model.js";
import RatingReview from "../models/RatingReview.model.js";


// 1. View profile //
const getProfile = asyncHandler(async (req, res) => {
  const gigId = req.user._id;

  // Fetch user core data
  const user = await User.findById(gigId).lean();
  if (!user) throw new ApiError(404, "User not found");

  // Try to fetch profile
  let profile = await UserProfile.findOne({ user: gigId });

  // Auto-create blank profile if missing
  if (!profile) {
    profile = await UserProfile.create({
      user: gigId,
      profile_image_url: user.avatar,
      bank_details: user.wallet
    });
  }

  // Merge and return
  const mergedProfile = {
    user: gigId,
    name: user.fullName || `${user.first_name} ${user.last_name}`,
    email: user.email,
    phone: user.phone,
    role: user.role,
    bio: profile.bio || "",
    location: profile.location || {},
    availability: profile.availability || {},
    bank_details: profile.bank_details || {},
    profile_image_url: profile.profile_image_url || user.avatar,
    createdAt: profile.createdAt || user.createdAt,
    updatedAt: profile.updatedAt || user.updatedAt,
  };

  const documents = await UserDocument.find({ user: gigId }).select("-__v").lean();
  const kyc = await KYCVerification.findOne({ user: gigId }).select("-__v").lean();

  return res
    .status(200)
    .json(new ApiResponse(200, { mergedProfile, documents, kyc }, "Profile fetched"));
});

// 2. Update profile //
const updateProfile = asyncHandler(async (req, res) => {
  const gigId = req.user._id;
  const updates = req.body;

  // Separate updates for User vs UserProfile
  const userUpdates = {};
  const profileUpdates = {};

  if (updates.first_name) userUpdates.first_name = updates.first_name;
  if (updates.last_name) userUpdates.last_name = updates.last_name;
  if (updates.email) userUpdates.email = updates.email;
  if (updates.phone) userUpdates.phone = updates.phone;

  if (updates.bio) profileUpdates.bio = updates.bio;
  if (updates.location) profileUpdates.location = updates.location;
  if (updates.availability) profileUpdates.availability = updates.availability;
  if (updates.bank_details) profileUpdates.bank_details = updates.bank_details;

  // Update User schema fields
  if (Object.keys(userUpdates).length > 0) {
    await User.findByIdAndUpdate(gigId, { $set: userUpdates }, { new: true, runValidators: true });
  }

  // Update UserProfile schema fields
  let profile = await UserProfile.findOneAndUpdate(
    { user: gigId },
    { $set: profileUpdates },
    { new: true, runValidators: true }
  );

  if (!profile) {
    throw new ApiError(404, "Profile not found");
  }

  return res.status(200).json(new ApiResponse(200, { userUpdates, profile }, "Profile updated"));
});

// 3. Update profile image //
const updateProfileImage = asyncHandler(async (req, res) => {
  const gigId = req.user._id;
  const avatarLocalPath = req.files?.avatar?.[0]?.path; // or req.file.path if using single upload

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required");
  }

  const avatarUpload = await uploadOnCloudinary(avatarLocalPath);
  if (!avatarUpload?.url) {
    throw new ApiError(500, "Avatar upload failed");
  }

  // Update both User and UserProfile for consistency
  await User.findByIdAndUpdate(gigId, { avatar: avatarUpload.url });

  const updatedProfile = await UserProfile.findOneAndUpdate(
    { user: gigId },
    { profile_image_url: avatarUpload.url },
    { new: true }
  );

  if (!updatedProfile) {
    throw new ApiError(404, "Profile not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, updatedProfile, "Profile image updated"));
});

// 4. Delete profile image //
const deleteProfileImage = asyncHandler(async (req, res) => {
  const gigId = req.user._id;

  // Reset avatar in User model
  await User.findByIdAndUpdate(
    gigId,
    { avatar: "https://cdn.pixabay.com/photo/2023/02/18/11/00/icon-7797704_640.png" },
    { new: true }
  );

  // Reset profile_image_url in UserProfile model
  const updatedProfile = await UserProfile.findOneAndUpdate(
    { user: gigId },
    { profile_image_url: "https://cdn.pixabay.com/photo/2023/02/18/11/00/icon-7797704_640.png" },
    { new: true }
  );

  if (!updatedProfile) {
    throw new ApiError(404, "Profile not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, updatedProfile, "Profile image removed"));
});

// 5. create wallet //
const createWallet = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");

  if (user.wallet?.address) {
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { address: user.wallet.address },
          "Wallet already exists"
        )
      );
  }

  const wallet = ethers.Wallet.createRandom();

  user.wallet = {
    address: wallet.address,
    privateKey: wallet.privateKey,
    createdAt: new Date(),
  };

  await user.save({ validateBeforeSave: false });

  return res
    .status(201)
    .json(
      new ApiResponse(
        201,
        { address: wallet.address },
        "Wallet created successfully"
      )
    );
});

// 6. gig wallet //
const getWallet = asyncHandler(async (req, res) => {
  const gigId = req.user._id;

  let wallet = await UserWallet.findOne({ user: gigId });

  // If wallet doesn't exist, create one with default balance
  if (!wallet) {
    wallet = await UserWallet.create({
      user: gigId,
      upi_id: "aditya3676",
      balance_inr: mongoose.Types.Decimal128.fromString("2000.00"),
    });
  }

  // Defensive check: ensure balance_inr is valid
  const balanceRaw = wallet.balance_inr?.toString();
  const balanceFloat = isNaN(balanceRaw) ? 0.0 : parseFloat(balanceRaw);

  const formattedWallet = {
    ...wallet.toObject(),
    balance_inr: balanceFloat,
  };

  return res
    .status(200)
    .json(new ApiResponse(200, formattedWallet, "Wallet fetched"));
});

// 7. UPI withdrawal request //
const withdraw = asyncHandler(async (req, res) => {
  const gigId = req.user._id;
  const { amount } = req.body;

  // Validate input
  const requestedAmount = parseFloat(amount);
  if (isNaN(requestedAmount) || requestedAmount <= 0) {
    throw new ApiError(400, "Invalid withdrawal amount");
  }

  // Fetch wallet
  const wallet = await UserWallet.findOne({ user: gigId });
  if (!wallet || !wallet.balance_inr) {
    throw new ApiError(404, "Wallet not found or balance missing");
  }

  // Convert Decimal128 to float safely
  const balanceRaw = wallet.balance_inr.toString?.() || "0.00";
  const currentBalance = parseFloat(balanceRaw);

  if (isNaN(currentBalance)) {
    throw new ApiError(500, "Corrupted wallet balance");
  }

  // Check balance
  if (requestedAmount > currentBalance) {
    throw new ApiError(400, "Insufficient balance");
  }

  // Calculate new balance and cast back to Decimal128
  const newBalance = (currentBalance - requestedAmount).toFixed(2);
  wallet.balance_inr = mongoose.Types.Decimal128.fromString(newBalance);

  await wallet.save();

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        new_balance: parseFloat(wallet.balance_inr.toString()),
      },
      "Withdrawal processed"
    )
  );
});

// 8. View payment history //
const getPaymentHistory = asyncHandler(async (req, res) => {
  const gigId = req.user._id;

  const payments = await Payment.find({ payee: gigId, status: "completed" })
    .populate({
      path: "escrow",
      populate: { path: "event", select: "title start_date end_date event_type" }
    })
    .sort({ createdAt: -1 })
    .select("-__v");

  if (!payments || payments.length === 0) {
    return res
      .status(200)
      .json(new ApiResponse(200, [], "No payments found"));
  }

  const toNum = (val) => {
    try {
      if (val === null || val === undefined) return null;
      if (typeof val === "number") return val;
      if (typeof val === "string") return parseFloat(val);
      if (typeof val === "object" && typeof val.toString === "function") {
        return parseFloat(val.toString());
      }
      return null;
    } catch {
      return null;
    }
  };

  const formattedPayments = payments.map((p) => {
    const obj = p.toObject();
    return {
      _id: obj._id,
      event: obj.escrow?.event || { title: "N/A" },
      amount: toNum(obj.amount),
      payment_date: obj.createdAt,
      payment_method: obj.payment_method,
      transaction_id: obj.upi_transaction_id || "N/A",
      status: obj.status,
      escrow_id: obj.escrow?._id,
      createdAt: obj.createdAt,
      updatedAt: obj.updatedAt
    };
  });

  return res
    .status(200)
    .json(new ApiResponse(200, formattedPayments, "Payment history fetched"));
});

// 9. upload documents  //
const uploadDocuments = asyncHandler(async (req, res) => {
  const { type } = req.body;
  const localFilePath = req.files?.fileUrl?.[0]?.path;
  const userId = req.user._id;

  if (!type || !localFilePath) {
    throw new ApiError(400, "Document type and file is required");
  }

  const cloudinaryRes = await uploadOnCloudinary(localFilePath);
  if (!cloudinaryRes) {
    throw new ApiError(500, "Cloudinary upload failed");
  }

  try {
    const doc = await UserDocument.create({
      user: userId,
      type,
      fileUrl: cloudinaryRes.secure_url,
    });
    return res.status(201).json(new ApiResponse(201, doc, "Document uploaded"));
  } catch (err) {
    if (err && (err.code === 11000 || err.name === "MongoError")) {
      const existingDoc = await UserDocument.findOne({ user: userId });
      if (!existingDoc) {
        throw new ApiError(409, "Document already exists and could not be located for update");
      }
      existingDoc.fileUrl = cloudinaryRes.secure_url;
      existingDoc.type = type;
      await existingDoc.save();
      return res.status(200).json(new ApiResponse(200, existingDoc, "Existing document updated"));
    }
    throw err;
  }
});

// 9.1 update existing document //
const updateGigDocs = asyncHandler(async (req, res) => {
  const { type } = req.body;
  const localFilePath = req.files?.fileUrl?.[0]?.path;
  const userId = req.user._id;

  if (!type || !localFilePath) {
    throw new ApiError(400, "Document type and file is required");
  }

  // Find any existing document for this user (unique per user)
  const existingDoc = await UserDocument.findOne({ user: userId });
  if (!existingDoc) {
    throw new ApiError(404, "No existing document found for user");
  }

  const cloudinaryRes = await uploadOnCloudinary(localFilePath);
  if (!cloudinaryRes?.secure_url) {
    throw new ApiError(500, "Cloudinary upload failed");
  }

  existingDoc.fileUrl = cloudinaryRes.secure_url;
  existingDoc.type = type;
  await existingDoc.save();

  return res
    .status(200)
    .json(new ApiResponse(200, existingDoc, "Document updated successfully"));
});

// 10.  Aadhaar verification 
 const verifyAadhaar = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { aadhaar_number, otp } = req.body;

  if (!aadhaar_number || aadhaar_number.length !== 12 || !otp) {
    throw new ApiError(400, "Invalid Aadhaar number or OTP required");
  }

  // Update or create KYC record
  let verification = await KYCVerification.findOne({ user: userId });
  if (verification) {
    verification.aadhaar_number = aadhaar_number;
    verification.aadhaar_verified = true;
    verification.status = "approved";
    verification.verified_at = new Date();
    await verification.save();
  } else {
    verification = await KYCVerification.create({
      user: userId,
      aadhaar_number,
      aadhaar_verified: true,
      status: "approved",
      verified_at: new Date(),
    });
  }

  // Update User quick flag
  await User.findByIdAndUpdate(
    userId,
    { isVerified: true, isActive: true }, // fast check flags
    { new: true }
  );

  return res
    .status(200)
    .json(new ApiResponse(200, verification, "Aadhaar verified, user activated"));
});

// 11. get kyc status
const getKYCStatus = asyncHandler(async (req, res) => {
  const gigId = req.user._id;

  const kyc = await KYCVerification.findOne({ user: gigId });

  if (!kyc) {
    throw new ApiError(404, "KYC record not found");
  }

  return res.status(200).json(new ApiResponse(200, kyc, "KYC status fetched"));
});

// 12. View nearby events
const getNearbyEvents = asyncHandler(async (req, res) => {
  const { coordinates } = req.body || {}; // [lng, lat]

  // Also support query params (GET requests generally don't send body)
  let coords = Array.isArray(coordinates) && coordinates.length === 2 ? coordinates : null;
  const qlng = req.query?.lng;
  const qlat = req.query?.lat;
  if (!coords && qlng !== undefined && qlat !== undefined) {
    const lngNum = parseFloat(qlng);
    const latNum = parseFloat(qlat);
    if (Number.isFinite(lngNum) && Number.isFinite(latNum)) {
      coords = [lngNum, latNum];
    }
  }

  let orgPools;
  if (Array.isArray(coords) && coords.length === 2) {
    orgPools = await OrganizerPool.find({
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: coords,
          },
          $maxDistance: 10000, // 10km
        },
      },
      status: { $ne: "completed" },
    })
      .populate("event", "title start_date end_date event_type")
      .populate("organizer", "first_name last_name fullName name email avatar profile_image_url");
  } else {
    orgPools = await OrganizerPool.find({
      status: { $ne: "completed" },
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate("event", "title start_date end_date event_type")
      .populate("organizer", "first_name last_name fullName name email avatar profile_image_url");
  }

  // Exclude events that have ended
  const now = new Date();
  const filtered = (orgPools || []).filter((p) => {
    const e = p?.event?.end_date ? new Date(p.event.end_date) : null;
    return e && now <= e;
  });

  return res
    .status(200)
    .json(new ApiResponse(200, filtered, "Nearby events fetched"));
});

// 13. View nearby organizer pools
const getOrganizerPool = asyncHandler(async (req, res) => {
  const { poolId } = req.params;

  // 1. Fetch OrganizerPool
  const orgPool = await OrganizerPool.findById(poolId)
    .populate("event", "title start_date end_date event_type location")
    .populate("organizer", "first_name last_name fullName name email avatar profile_image_url kycVideo.status");

  if (!orgPool) {
    return res
      .status(404)
      .json(new ApiResponse(404, null, "Organizer pool not found"));
  }

  // 2. Fetch Pool model using event + organizer
  const pool = await Pool.findOne({
    event: orgPool.event,
    organizer: orgPool.organizer
  })
    .populate("organizer", "first_name last_name fullName name email avatar profile_image_url kycVideo.status")
    .populate("gigs", "_id first_name last_name avatar fullName");

  // 3. Flags for current gig
  const gigId = req.user._id;
  const isGigInPool = !!(pool && (pool.gigs || []).some((g) => g?._id?.toString() === gigId.toString()));
  const existingApp = await PoolApplication.findOne({ gig: gigId, pool: pool?._id });
  const appliedStatus = existingApp ? existingApp.application_status || "pending" : "none";

  return res.status(200).json(
    new ApiResponse(200, { orgPool, pool, flags: { isGigInPool, appliedStatus } }, "Pool details fetched")
  );
});

// 14. Join a specific pool
const joinPool = asyncHandler(async (req, res) => {
  const gigId = req.user._id;
  const { poolId } = req.params;
  const { proposed_rate, cover_message } = req.body;

  const pool = await Pool.findById(poolId);
  if (!pool) {
    throw new ApiError(404, "Pool not found");
  }

  const existingApplication = await PoolApplication.findOne({
    gig: gigId,
    pool: poolId,
  });
  if (existingApplication) {
    return res
    .status(200)
    .json(new ApiResponse(201, existingApplication, "GiG  already in this pool"));
  }

  const application = await PoolApplication.create({
    gig: gigId,
    pool: poolId,
    proposed_rate: mongoose.Types.Decimal128.fromString(
      proposed_rate.toString()
    ),
    cover_message,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, application, "Pool application submitted"));
});

// View my pool applications with status sections
const getMyApplications = asyncHandler(async (req, res) => {
  const gigId = req.user._id;

  const apps = await PoolApplication.find({ gig: gigId })
    .populate({
      path: "pool",
      populate: [
        { path: "event", select: "title start_date end_date event_type description organizer" },
        { path: "organizer", select: "first_name last_name fullName name email avatar profile_image_url" },
      ],
      select: "-__v",
    })
    .select("-__v");

  const sections = {
    requested: [],
    accepted: [],
    rejected: [],
  };

  for (const app of apps) {
    const item = {
      _id: app._id,
      application_status: app.application_status,
      cover_message: app.cover_message,
      proposed_rate: app.proposed_rate,
      createdAt: app.createdAt,
      pool: app.pool,
      event: app.pool?.event || null,
      organizer: app.pool?.organizer || null,
    };
    if (app.application_status === "pending") sections.requested.push(item);
    else if (app.application_status === "accepted") sections.accepted.push(item);
    else if (app.application_status === "rejected") sections.rejected.push(item);
  }

  return res
    .status(200)
    .json(new ApiResponse(200, sections, "Gig applications fetched"));
});

// 15. View accepted events
const getMyEvents = asyncHandler(async (req, res) => {
  const gigObjectId = req.user._id;

  const events = await Pool.find({ gigs: gigObjectId })
    .select("-__v")
    .populate({
      path: "event",
      select: "title start_date end_date event_type organizer status banner_url",
      populate: {
        path: "organizer",
        select: "first_name last_name fullName name email avatar profile_image_url",
      },
    });

  if (!events || events.length === 0) {
    return res
      .status(200)
      .json(new ApiResponse(200, [], "No accepted events found"));
  }

  return res
    .status(200)
    .json(new ApiResponse(200, events, "Accepted events fetched"));
});

// 16. QR/GPS check-in
const checkIn = asyncHandler(async (req, res) => {
  const gigId = req.user._id;
  const { eventId } = req.params;

  const event = await Event.findById(eventId);
  if (!event) throw new ApiError(404, "Event not found");

  const now = new Date();

  //  Validate gig assignment via pools
  const pool = await Pool.findOne({ event: eventId, gigs: gigId });
  if (!pool) {
    return res
      .status(403)
      .json(new ApiResponse(403, null, "Gig not assigned to this event"));
  }

  //  Auto-transition event status if published and within time window
  if (
    event.status === "published" &&
    event.start_date <= now &&
    event.end_date > now
  ) {
    event.status = "in_progress";
    await event.save();
  }

  //  Validate event status and dates AFTER transition
  if (event.status !== "in_progress") {
    throw new ApiError(400, "Event is not in progress. Cannot check in.");
  }

  if (now < event.start_date) throw new ApiError(400, "Event has not started yet");
  if (now > event.end_date) throw new ApiError(400, "Event has already ended");

  // Prevent duplicate check-in
  const existingAttendance = await EventAttendance.findOne({ gig: gigId, event: eventId });
  if (existingAttendance) {
    if (!existingAttendance.check_out_time) {
      return res
        .status(200)
        .json(new ApiResponse(200, existingAttendance, "User already checked in"));
    }
    // If previously checked out and worked less than 5 minutes, allow re-check-in
    const worked =
      existingAttendance.hours_worked && typeof existingAttendance.hours_worked === "object" && existingAttendance.hours_worked.$numberDecimal
        ? parseFloat(existingAttendance.hours_worked.$numberDecimal)
        : parseFloat(existingAttendance.hours_worked || 0);
    const thresholdHours = 5 / 60; // 5 minutes
    if (!Number.isFinite(worked) || worked < thresholdHours) {
      existingAttendance.check_in_time = now;
      existingAttendance.check_out_time = undefined;
      existingAttendance.hours_worked = undefined;
      existingAttendance.status = "checked_in";
      await existingAttendance.save();
      return res
        .status(200)
        .json(new ApiResponse(200, existingAttendance, "Re-check-in successful"));
    }
    // Otherwise, disallow re-check-in
    return res
      .status(400)
      .json(new ApiResponse(400, existingAttendance, "Attendance already completed"));
  }

  //  Create attendance record
  const attendance = await EventAttendance.create({
    gig: gigId,
    event: eventId,
    check_in_time: now,
    status: "checked_in",
  });

  return res
    .status(201)
    .json(new ApiResponse(201, attendance, "Check-in successful"));
});

// 17. check out 
// Helper function to process checkout logic (can be called from endpoint or event completion)
const processCheckout = async (gigId, eventId) => {
  // 1) Load attendance for this gig-event
  const attendance = await EventAttendance.findOne({ gig: gigId, event: eventId });
  if (!attendance) return null;

  // 2) Skip if already checked out
  if (attendance.check_out_time) {
    return attendance;
  }

  // 3) Set checkout time
  attendance.check_out_time = new Date();

  // 4) Calculate hours worked (stored as Decimal128)
  if (attendance.check_in_time && attendance.check_out_time) {
    const checkInTime = new Date(attendance.check_in_time);
    const checkOutTime = new Date(attendance.check_out_time);
    const msWorked = checkOutTime.getTime() - checkInTime.getTime();
    const hours = Math.max(0, msWorked / (1000 * 60 * 60)); // Ensure non-negative
    
    // Only set hours_worked if we have a valid positive number
    if (hours > 0) {
      attendance.hours_worked = mongoose.Types.Decimal128.fromString(hours.toFixed(2));
    } else {
      // If hours is 0 or negative, set a minimum of 0.01 to indicate checkout happened
      attendance.hours_worked = mongoose.Types.Decimal128.fromString("0.01");
    }
  }

  await attendance.save();

  // 5) Badge awarding
  const completedEventsCount = await EventAttendance.countDocuments({
    gig: gigId,
    check_out_time: { $exists: true, $ne: null },
  });

  // Check if badges exist, if not, create default badges
  const badgeCount = await Badge.countDocuments();
  if (badgeCount === 0) {
    const defaultBadges = [
      { badge_name: "First Event", min_events: 1 },
      { badge_name: "Rising Star", min_events: 5 },
      { badge_name: "Dedicated Worker", min_events: 10 },
      { badge_name: "Event Expert", min_events: 25 },
      { badge_name: "Master Gig", min_events: 50 },
      { badge_name: "Legendary Worker", min_events: 100 },
    ];
    
    await Badge.insertMany(defaultBadges);
  }

  const eligibleBadges = await Badge.find({
    min_events: { $lte: completedEventsCount },
  });

  for (const badge of eligibleBadges) {
    const alreadyHasBadge = await UserBadge.findOne({ user: gigId, badge: badge._id });
    if (alreadyHasBadge) continue;

    await UserBadge.create({
      user: gigId,
      badge: badge._id,
    });
  }

  return attendance;
};

const checkOut = asyncHandler(async (req, res) => {
  const gigId = req.user._id;
  const { eventId } = req.params;

  const attendance = await processCheckout(gigId, eventId);
  
  if (!attendance) {
    throw new ApiError(404, "Attendance record not found");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        attendance,
        "Check-out successful, hours worked updated, badges awarded if eligible"
      )
    );
});

// 18.  View attendance history
const getAttendanceHistory = asyncHandler(async (req, res) => {
  const gigId = req.user._id;

  // Auto-checkout for events that have ended or been marked as completed
  const openAttendance = await EventAttendance.find({ gig: gigId, check_in_time: { $exists: true }, check_out_time: { $exists: false } })
    .populate("event", "end_date status");
  for (const att of openAttendance) {
    const end = att?.event?.end_date ? new Date(att.event.end_date) : null;
    const isCompleted = att?.event?.status === "completed";
    const hasEnded = end && new Date() > end;
    
    if (isCompleted || hasEnded) {
      att.check_out_time = isCompleted ? new Date() : end;
      if (att.check_in_time && att.check_out_time) {
        const checkInTime = new Date(att.check_in_time);
        const checkOutTime = new Date(att.check_out_time);
        const msWorked = checkOutTime.getTime() - checkInTime.getTime();
        const hours = Math.max(0, msWorked / (1000 * 60 * 60));
        att.hours_worked = mongoose.Types.Decimal128.fromString(hours.toFixed(2));
      }
      await att.save();
    }
  }

  // Fix existing records that have checkout but 0 hours (recalculate)
  const needsRecalc = await EventAttendance.find({ 
    gig: gigId, 
    check_in_time: { $exists: true }, 
    check_out_time: { $exists: true },
    $or: [
      { hours_worked: { $exists: false } },
      { hours_worked: null },
      { hours_worked: mongoose.Types.Decimal128.fromString("0") },
      { hours_worked: mongoose.Types.Decimal128.fromString("0.00") }
    ]
  });

  for (const att of needsRecalc) {
    if (att.check_in_time && att.check_out_time) {
      const checkInTime = new Date(att.check_in_time);
      const checkOutTime = new Date(att.check_out_time);
      const msWorked = checkOutTime.getTime() - checkInTime.getTime();
      const hours = Math.max(0, msWorked / (1000 * 60 * 60));
      
      if (hours > 0) {
        att.hours_worked = mongoose.Types.Decimal128.fromString(hours.toFixed(2));
        await att.save();
      }
    }
  }

  const history = await EventAttendance.find({ gig: gigId })
    .populate("event", "title start_date end_date location")
    .select("-__v");

  // Return empty array instead of throwing error when no history found
  return res
    .status(200)
    .json(new ApiResponse(200, history || [], "Attendance history fetched"));
});

// 19. Raise dispute for an event
const raiseDispute = asyncHandler(async (req, res) => {
  const gigId = req.user._id;
  const { eventId } = req.params;
  const { reason } = req.body;

  if (!reason || reason.trim() === "") {
    throw new ApiError(400, "Dispute reason is required");
  }

  const dispute = await Dispute.create({
    event: eventId,
    gig: gigId,
    reason,
  });

  return res.status(201).json(new ApiResponse(201, dispute, "Dispute raised"));
});

// List my disputes with event and organizer details
const getMyDisputes = asyncHandler(async (req, res) => {
  const gigId = req.user._id;
  const disputes = await Dispute.find({ gig: gigId })
    .populate({
      path: "event",
      select: "title start_date end_date description event_type organizer",
      populate: { path: "organizer", select: "first_name last_name fullName name email avatar profile_image_url" },
    })
    .select("-__v")
    .sort({ createdAt: -1 });

  return res.status(200).json(new ApiResponse(200, disputes, "Gig disputes fetched"));
});

// List escrows related to this gig's accepted events
const getGigEscrows = asyncHandler(async (req, res) => {
  const gigId = req.user._id;

  const pools = await Pool.find({ gigs: gigId }).select("event");
  const eventIds = pools.map((p) => p.event).filter(Boolean);

  if (eventIds.length === 0) {
    return res.status(200).json(new ApiResponse(200, [], "No escrows found for this gig"));
  }

  const escrows = await EscrowContract.find({ event: { $in: eventIds } })
    .populate("event", "title")
    .select("event total_amount status organizer_percentage gigs_percentage createdAt updatedAt");

  const toNum = (v) => {
    if (v && typeof v === "object" && v.$numberDecimal) return parseFloat(v.$numberDecimal);
    const n = parseFloat(v);
    return Number.isNaN(n) ? 0 : n;
  };

  const normalized = escrows.map((e) => ({
    _id: e._id,
    event: e.event,
    total_amount: toNum(e.total_amount),
    status: e.status,
    organizer_percentage: toNum(e.organizer_percentage),
    gigs_percentage: toNum(e.gigs_percentage),
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  }));

  return res.status(200).json(new ApiResponse(200, normalized, "Escrows fetched for gig"));
});

// 20. Simulate payout from escrow (for testing)
const simulatePayout = asyncHandler(async (req, res) => {
  const gigId = req.user._id;
  const { escrowId } = req.params;

  const escrow = await EscrowContract.findOne({
    _id: escrowId,
    status: "released",
  });

  if (!escrow) {
    throw new ApiError(404, "Escrow not found or already released");
  }

  // Update escrow status
  escrow.status = "released";
  escrow.released_at = new Date();
  await escrow.save();

  return res.status(200).json(new ApiResponse(200, escrow, "Payout simulated"));
});

// 21. View earned badges
const getBadges = asyncHandler(async (req, res) => {
  const gigId = req.user._id;

  const docs = await UserBadge.find({ user: gigId })
    .populate("badge", "badge_name min_events")
    .select("createdAt")
    .lean();
  const badges = (docs || []).map((b) => ({
    ...b,
    awarded_at: b.createdAt,
  }));

  return res.status(200).json(new ApiResponse(200, badges, "Badges fetched"));
});

// Delete a notification
const deleteNotification = asyncHandler(async (req, res) => {
  const gigId = req.user._id;
  const { id } = req.params;
  const notif = await Notification.findById(id);
  if (!notif || notif.user.toString() !== gigId.toString()) {
    throw new ApiError(404, "Notification not found");
  }
  await Notification.findByIdAndDelete(id);
  return res.status(200).json(new ApiResponse(200, null, "Notification deleted"));
});

// 22. Submit event feedback
const submitFeedback = asyncHandler(async (req, res) => {
  const gigId = req.user._id;
  const { eventId } = req.params;
  const { rating, comment } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    throw new ApiError(400, "Rating must be between 1 and 5");
  }

  const feedback = await Feedback.create({
    event: eventId,
    gig: gigId,
    rating,
    comment,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, feedback, "Feedback submitted"));
});

// 22.1 List my feedbacks
const getMyFeedbacks = asyncHandler(async (req, res) => {
  const gigId = req.user._id;

  const feedbacks = await Feedback.find({ gig: gigId })
    .populate("event", "title start_date end_date event_type")
    .select("-__v");

  const reviews = await RatingReview.find({
    reviewee: gigId,
    review_type: "organizer_to_gig",
  })
    .populate("event", "title start_date end_date event_type")
    .populate("reviewer", "first_name last_name fullName name email avatar profile_image_url")
    .select("-__v");

  const myRatings = await RatingReview.find({
    reviewer: gigId,
    review_type: "gig_to_organizer",
  })
    .populate("event", "title start_date end_date event_type")
    .populate("reviewee", "first_name last_name fullName name email avatar profile_image_url")
    .select("-__v");

  const normalizedFeedbacks = feedbacks.map((f) => ({
    _id: f._id,
    event: f.event,
    rating: f.rating,
    comment: f.comment,
    createdAt: f.createdAt,
    source: "gig",
    kind: "gig_to_event",
  }));

  const normalizedReviews = reviews.map((r) => {
    let numericRating;
    if (r.rating && typeof r.rating === "object" && r.rating.$numberDecimal) {
      numericRating = parseFloat(r.rating.$numberDecimal);
    } else {
      const candidate = Number(r.rating || 0);
      numericRating = Number.isFinite(candidate) ? candidate : 0;
    }

    return {
      _id: r._id,
      event: r.event,
      rating: numericRating,
      comment: r.review_text,
      createdAt: r.createdAt,
      source: "organizer",
      kind: r.review_type || "organizer_to_gig",
      organizer: r.reviewer
    };
  });

  const normalizedMyRatings = myRatings.map((r) => {
    let numericRating;
    if (r.rating && typeof r.rating === "object" && r.rating.$numberDecimal) {
      numericRating = parseFloat(r.rating.$numberDecimal);
    } else {
      const candidate = Number(r.rating || 0);
      numericRating = Number.isFinite(candidate) ? candidate : 0;
    }

    return {
      _id: r._id,
      event: r.event,
      rating: numericRating,
      comment: r.review_text,
      createdAt: r.createdAt,
      source: "gig",
      kind: r.review_type || "gig_to_organizer",
      organizer: r.reviewee,
    };
  });

  const combined = [...normalizedFeedbacks, ...normalizedReviews, ...normalizedMyRatings].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );

  return res.status(200).json(new ApiResponse(200, combined, "Gig feedbacks fetched"));
});

// 22.2 Submit rating for organizer (post-completion)
const createGigRatingReview = asyncHandler(async (req, res) => {
  const gigId = req.user._id;
  const { eventId, organizerId, rating, review_text } = req.body;

  if (!eventId || !organizerId || rating === undefined) {
    throw new ApiError(400, "Missing required rating fields");
  }
  const numeric = Number(rating);
  if (!Number.isFinite(numeric) || numeric < 1 || numeric > 5) {
    throw new ApiError(400, "Rating must be between 1 and 5");
  }

  // Check if rating already exists
  const existingRating = await RatingReview.findOne({
    event: eventId,
    reviewer: gigId,
    reviewee: organizerId,
    review_type: "gig_to_organizer"
  });

  if (existingRating) {
    throw new ApiError(400, "You have already rated this organizer for this event");
  }

  const review = await RatingReview.create({
    event: eventId,
    reviewer: gigId,
    reviewee: organizerId,
    rating: mongoose.Types.Decimal128.fromString(numeric.toString()),
    review_text,
    review_type: "gig_to_organizer",
  });

  return res.status(201).json(new ApiResponse(201, review, "Rating review submitted"));
});

// 23. get gig dashboard
const getGigDashboard = asyncHandler(async (req, res) => {
  const gigId = req.user._id;

  const [attendance, wallet, feedbacks, badges] = await Promise.all([
    EventAttendance.find({ gig: gigId }),
    UserWallet.findOne({ user: gigId }),
    Feedback.find({ gig: gigId }),
    UserBadge.find({ user: gigId }),
  ]);

  const totalEvents = attendance.length;
  const totalEarnings = wallet?.balance_inr || 0;
  const averageRating =
    feedbacks.length > 0
      ? feedbacks.reduce((sum, f) => sum + f.rating, 0) / feedbacks.length
      : null;

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        totalEvents,
        totalEarnings,
        averageRating,
        badges,
      },
      "Gig dashboard fetched"
    )
  );
});

// 24. upload kyc video
const uploadKycVideo = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const videoUrl = req.files?.videoUrl?.[0]?.path;

  if (!videoUrl) {
    throw new ApiError(400, "Video file is required");
  }

  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");

  user.kycVideo = {
    url: videoUrl,
    status: "pending",
    uploadedAt: new Date(),
  };

  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { videoUrl },
        "KYC video uploaded and pending verification"
      )
    );
});

// 25. View leaderboard position
const getLeaderboard = asyncHandler(async (req, res) => {
  const gigId = req.user._id;

  const score = await Feedback.findOne({ gig: gigId })

  if (!score) {
    throw new ApiError(404, "FeedBack not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, score, "Leaderboard data fetched"));
});



//  Send message in chat
const sendMessage = asyncHandler(async (req, res) => {
  const gigId = req.user._id;
  const { conversationId } = req.params;
  const { message_text } = req.body;

 const conversation = await Conversation.findById(conversationId);
 if (!conversation || !conversation.participants.some((p) => p.toString() === gigId.toString())) {
   throw new ApiError(403, "Access denied to this conversation");
 }


  const message = await Message.create({
    conversation: conversationId,
    sender: gigId,
    message_text,
  });

  return res.status(201).json(new ApiResponse(201, message, "Message sent"));
});

//  List messages in a conversation (gig)
const getGigConversationMessages = asyncHandler(async (req, res) => {
  const gigId = req.user._id;
  const { conversationId } = req.params;

  const conversation = await Conversation.findById(conversationId);
  if (!conversation || !conversation.participants.some((p) => p.toString() === gigId.toString())) {
    throw new ApiError(403, "Access denied to this conversation");
  }

  const messages = await Message.find({ conversation: conversationId })
    .populate("sender", "email role")
    .sort({ createdAt: 1 });

  return res.status(200).json(new ApiResponse(200, messages, "Messages fetched"));
});

const deleteGigConversation = asyncHandler(async (req, res) => {
  const gigId = req.user._id;
  const { id } = req.params;
  const conversation = await Conversation.findById(id);
  if (!conversation) {
    throw new ApiError(404, "Conversation not found");
  }
  if (!conversation.participants.some((p) => p.toString() === gigId.toString())) {
    throw new ApiError(403, "Access denied to this conversation");
  }
  conversation.participants = conversation.participants.filter((p) => p.toString() !== gigId.toString());
  if (conversation.participants.length === 0) {
    await conversation.softDelete();
  } else {
    await conversation.save();
  }
  return res.status(200).json(new ApiResponse(200, null, "Conversation deleted"));
});

//  List chat threads
const getConversations = asyncHandler(async (req, res) => {
  const gigId = req.user._id;

  const rows = await Conversation.find({ participants: gigId })
    .populate("event", "title start_date end_date status")
    .populate("pool", "pool_name status")
    .populate("participants", "email role avatar first_name last_name")
    .sort({ createdAt: -1 });

  const conversations = rows.map((c) => {
    const obj = c.toObject();
    const organizerUser = (obj.participants || []).find((p) => p.role === "organizer");
    const organizer =
      organizerUser &&
      {
        _id: organizerUser._id,
        email: organizerUser.email,
        avatar: organizerUser.avatar,
        fullName: `${organizerUser.first_name} ${organizerUser.last_name}`.trim(),
        name: `${organizerUser.first_name} ${organizerUser.last_name}`.trim(),
      };
    return {
      ...obj,
      organizer,
    };
  });

  return res.status(200).json(new ApiResponse(200, conversations, "Conversations fetched"));
});

const deleteGigApplication = asyncHandler(async (req, res) => {
  const gigId = req.user._id;
  const { id } = req.params;
  const app = await PoolApplication.findById(id);
  if (!app) throw new ApiError(404, "Application not found");
  if (app.gig?.toString() !== gigId.toString()) {
    throw new ApiError(403, "Not authorized to delete this application");
  }
  if (!["accepted", "rejected"].includes(app.application_status)) {
    throw new ApiError(400, "Only accepted or rejected applications can be deleted");
  }
  await PoolApplication.findByIdAndDelete(id);
  return res.status(200).json(new ApiResponse(200, null, "Application deleted"));
});

//  Remove gig's completed event card (leave pool)
const deleteCompletedEventCard = asyncHandler(async (req, res) => {
  const gigId = req.user._id;
  const { poolId } = req.params;

  const pool = await Pool.findById(poolId).populate("event", "end_date status");
  if (!pool) throw new ApiError(404, "Pool not found");

  const isMember = (pool.gigs || []).some((g) => g?.toString() === gigId.toString());
  if (!isMember) throw new ApiError(403, "Not authorized to modify this pool");

  const now = new Date();
  const endAt = pool?.event?.end_date ? new Date(pool.event.end_date) : null;
  const completedByDate = endAt && now > endAt;
  const completedByStatus = pool?.event?.status === "completed";
  if (!completedByDate && !completedByStatus) {
    throw new ApiError(400, "Only completed events can be deleted from your list");
  }

  await Pool.updateOne({ _id: poolId }, { $pull: { gigs: gigId } });
  return res.status(200).json(new ApiResponse(200, null, "Event removed from your completed list"));
});

//  Get notifications
const getNotifications = asyncHandler(async (req, res) => {
  const gigId = req.user._id;

  const notifications = await Notification.find({ user: gigId }).sort({
    createdAt: -1,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, notifications, "Notifications fetched"));
});

export {
  getNearbyEvents,
  getOrganizerPool,
  joinPool,
  getMyEvents,
  getMyApplications,
  deleteGigApplication,
  checkIn,
  checkOut,
  processCheckout,
  getAttendanceHistory,
  getWallet,
  withdraw,
  getPaymentHistory,
  verifyAadhaar,
  getProfile,
  updateProfile,
  getBadges,
  getLeaderboard,
  getConversations,
  getGigConversationMessages,
  sendMessage,
  raiseDispute,
  getMyDisputes,
  getGigEscrows,
  getNotifications,
  deleteNotification,
  updateProfileImage,
  simulatePayout,
  submitFeedback,
  getMyFeedbacks,
  createGigRatingReview,
  deleteProfileImage,
  getKYCStatus,
  getGigDashboard,
  uploadDocuments,
  updateGigDocs,
  uploadKycVideo,
  createWallet,
  deleteGigConversation,
  deleteCompletedEventCard,
};

import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import User from "../models/User.model.js";
import jwt from "jsonwebtoken";
import  {sendOtpMail}  from "../utils/mail.js";

// generate Access And Refresh Tokens
const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return {
      accessToken,
      refreshToken,
    };
  } catch (error) {
    throw new ApiError(
      500,
      "something went wrong while generating refresh and access token"
    );
  }
};

//register user
export const registerUser = asyncHandler(async (req, res) => {

  // 1. get input data
  const {
    email,
    phone,
    password,
    role,
    first_name,
    last_name,
  } = req.body;

  // 2. Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new ApiError(400, "Invalid email format");
  }

  // 3. Validate phone number (Indian format)
  const phoneRegex = /^[6-9]\d{9}$/;
  if (!phoneRegex.test(phone)) {
    throw new ApiError(400, "Invalid phone number format");
  }

  // 4. Validate password strength
  if (password.length < 5) {
    throw new ApiError(400, "Password must be at least 5 characters long");
  }

  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;
  if (!passwordRegex.test(password)) {
    throw new ApiError(400, "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character");
  }


  // 5. Validate role
  const validRoles = ["gig", "organizer", "host"];
  if (!validRoles.includes(role)) {
    throw new ApiError(400, "Invalid role provided");
  }

  // 6. Check if user already exists
  const existingUser = await User.findOne({email});
  if (existingUser) {
    throw new ApiError(409, "User with provided email already exists");
  }

  //universal role id
  const universal_role_id = `${role}-${Date.now()}`;

  // 7. Create user
  const user = await User.create({
    email,
    phone,
    password,
    role,
    first_name,
    last_name,
    universal_role_id
  });

  // 8. check user 
  const createdUser = await User.findById(user._id).select("-password -refreshToken");
  if (!createdUser) {
    throw new ApiError(500, "User registration failed");
  }
  
  // 9. Respond
  return res
  .status(201)
  .json(
    new ApiResponse(201, createdUser, "User registered successfully")
  );
});

// User Login
export const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user || !(await user.isPasswordCorrect(password))) {
    throw new ApiError(401, "Invalid credentials");
  }

  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();

  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });

  const options = {
    httpOnly: false, // Temporarily disable httpOnly to test if cookies work at all
    secure: false,
    sameSite: 'Lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  }

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );
  const msg = `${user.role} logged in successfully`;
  
  // Set cookies explicitly
  res.cookie("accessToken", accessToken, options);
  res.cookie("refreshToken", refreshToken, options);
  
  return res.status(200).json(
    new ApiResponse(200, { user: loggedInUser, accessToken, refreshToken }, msg)
  );
});

//refresh token access
export const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;
  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized request || Refresh token not found");
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id);

    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }

    if (incomingRefreshToken !== user?.refreshToken) {
      // Clear invalid refresh token from database
      await User.findByIdAndUpdate(user._id, { $unset: { refreshToken: 1 } });
      throw new ApiError(401, "Refresh token is expired or used!!");
    }

    const options = {
      httpOnly: true,
      secure: false, // Allow cookies on http://localhost
      sameSite: 'Lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    };

    const msg = `Access token refreshed for ${user.role}!`;
    const { accessToken, newRefreshToken } =
      await generateAccessAndRefreshTokens(user._id);

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, newRefreshToken },
          msg
        )
      );
  } catch (error) {
    // If JWT verification fails, clear the refresh token cookie
    res.clearCookie("refreshToken");
    res.clearCookie("accessToken");
    
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      throw new ApiError(401, "Session expired. Please login again.");
    }
    throw new ApiError(401, error?.message || "Invalid refresh token");
  }
});

//logout route
export const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: { refreshToken: undefined },
    },
    { new: true }
  );
  const options = {
    httpOnly: true,
    secure: true,
  };
  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, `${ req.user.role} logged out successfully`));
});

// Send OTP for password reset
export const sendOTP = asyncHandler(async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res
        .status(400)
        .json(new ApiResponse(400, "User does not exist with this email"));
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    user.resetOTP = otp;
    user.otpExpires = Date.now() + 5 * 60 * 1000;
    user.isOTPVerified = false;
    await user.save();
    await sendOtpMail(email, otp, user.first_name);
    return res.status(200).json(new ApiResponse(200, "Otp sent to the user"));
  } catch (error) {
    return res.status(400).json(new ApiResponse(400, error));
  }
});

// Verify OTP
export const verifyOtp = asyncHandler(async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res
        .status(400)
        .json(new ApiResponse(400, "User does not exist with this email"));
    }

    if (user.resetOTP != otp || user.otpExpires < Date.now()) {
      return res
        .status(400)
        .json(new ApiResponse(400, "Invalid or expired otp"));
    }

    user.isOTPVerified = true;
    user.resetOTP = undefined;
    user.otpExpires = undefined;
    await user.save();

    return res
      .status(200)
      .json(new ApiResponse(200, "Otp verified successfully"));
  } catch (error) {
    return res.status(400).json(new ApiResponse(400, error));
  }
});

// Reset Password
export const resetPassword = asyncHandler(async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    const user = await User.findOne({ email });
    if (!user || !user.isOTPVerified) {
      return res
        .status(400)
        .json(new ApiResponse(400, "User does not exist with this email"));
    }
    user.password = newPassword;
    await user.save();

    return res
      .status(200)
      .json(new ApiResponse(200, "Password reset successfully"));
  } catch (error) {
    return res.status(400).json(new ApiResponse(400, error));
  }
});

// Google OAuth Authentication
export const googleAuth = asyncHandler(async (req, res) => {
  try {
    const { email } = req.body;

    let user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json(new ApiResponse(400, "User not found"));
    }
      const accessToken = user.generateAccessToken();
      const refreshToken = user.generateRefreshToken();

      user.refreshToken = refreshToken;
      await user.save({ validateBeforeSave: false });

      const options = {
        httpOnly: true,
        secure: false, // Allow cookies on http://localhost
        sameSite: 'Lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      };

      const loggedInUser = await User.findById(user._id).select(
        "-password -refreshToken"
      );
      const msg = `${user.role} logged in successfully`;
      return res
        .status(200)
        .cookie("refreshToken", refreshToken, options)
        .cookie("accessToken", accessToken, options)
        .json(
          new ApiResponse(
            200,
            { user: loggedInUser, accessToken, refreshToken },
            msg
          )
        );
    
  } catch (error) {
    console.error("Google Auth error:", error);
    return res.status(500).json(new ApiResponse(500, error.message));
  }
});

// Verify token on app mount
export const verifyTokenStatus = asyncHandler(async (req, res) => {
  try {
    // req.user is set by verifyToken middleware
    const user = await User.findById(req.user._id).select(
      "-password -refreshToken"
    );

    if (!user) {
      throw new ApiError(401, "User not found");
    }

    // Get the token from cookies or Authorization header
    const accessToken =
      req.cookies?.accessToken ||
      req.header("Authorization")?.replace("Bearer ", "");

    return res.status(200).json(
      new ApiResponse(
        200,
        { user, accessToken },
        "Token verified successfully"
      )
    );
  } catch (error) {
    console.error("Token verification error:", error);
    throw new ApiError(401, "Token verification failed");
  }
});
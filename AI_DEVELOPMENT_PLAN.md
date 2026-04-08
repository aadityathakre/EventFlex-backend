# AI-Assisted Backend Development Plan
## Dual Authentication System with Role-Based Access

🔷 **CRITICAL RULE**: Follow only BACKEND_ANALYSIS.md architecture patterns. Do not invent new architecture. Adapt existing patterns for new requirements.

---

## 📋 Project Requirements Summary

### Authentication System
- **Dual Auth**: Google OAuth + Manual (email/password)
- **Roles**: Farmer, Buyer, Logistics, Admin (pre-registered)
- **Profile Completion**: Phone OTP, Email OTP, Aadhaar verification
- **Access Control**: Unverified = view only, Verified = full access
- **Password Reset**: Email OTP based

### Business Rules
- Admin pre-registered
- Users cannot buy/sell until verification completed
- Different dashboards per role

---

## 🎯 Step-by-Step Development Plan

### **STEP 1: Update User Model (Following BACKEND_ANALYSIS.md Pattern)**

**AI PROMPT 1**:
```
Follow BACKEND_ANALYSIS.md User.model.js structure exactly. Update the existing User model to support:
1. Google OAuth fields (googleId, socialLogin: true)
2. New roles: 'farmer', 'buyer', 'logistics', 'admin' 
3. Profile completion fields: phone, aadhaar, phoneVerified, emailVerified, aadhaarVerified
4. OTP fields: phoneOTP, phoneOTPExpiry, emailOTP, emailOTPExpiry
5. Keep existing fields: email, password, firstName, lastName, avatar, role, refreshToken, isVerified

Maintain the same:
- Schema structure and validation
- Pre-save password hashing middleware
- generateAccessToken() and generateRefreshToken() methods
- isPasswordCorrect() method
- Virtual fullName property
- Same JWT token payload structure (_id, role, email)

Do NOT change the database connection or authentication token generation logic from BACKEND_ANALYSIS.md.
```

### **STEP 2: Create Google OAuth Service**

**AI PROMPT 2**:
```
Following BACKEND_ANALYSIS.md service layer pattern, create src/services/googleAuthService.js:

1. Create Google OAuth2 client using google-auth-library
2. Implement verifyGoogleToken(token) function that:
   - Verifies Google ID token
   - Returns user info (email, name, googleId)
3. Implement findOrCreateGoogleUser(userInfo) function that:
   - Checks if user exists by email or googleId
   - Creates new user if not exists (socialLogin: true, no password)
   - Updates existing user with googleId if missing
   - Follows same user creation pattern as users.auth.controller.js registerUser

Use the same error handling pattern as BACKEND_ANALYSIS.md with ApiError and asyncHandler.
Do NOT create new authentication patterns - follow existing JWT token generation from User model.
```

### **STEP 3: Update Authentication Controller**

**AI PROMPT 3**:
```
Update src/controllers/users.auth.controller.js following exact BACKEND_ANALYSIS.md patterns:

1. Add googleAuth function:
   - Use googleAuthService.verifyGoogleToken()
   - Use findOrCreateGoogleUser() 
   - Generate tokens using existing user.generateAccessToken() and generateRefreshToken()
   - Set cookies using same options as loginUser function
   - Return same response format as loginUser

2. Update registerUser function:
   - Keep existing validation logic
   - Add support for socialLogin field (skip password if true)
   - Set emailVerified: false for new users
   - Keep same error handling and response format

3. Add sendPhoneOTP function:
   - Generate 6-digit OTP
   - Set phoneOTP and phoneOTPExpiry (5 minutes)
   - Use same email OTP pattern from existing sendOTP function
   - Return same response format

4. Add verifyPhoneOTP function:
   - Follow exact pattern of verifyOtp function
   - Set phoneVerified: true on success
   - Clear OTP fields after verification

5. Add updateProfile function:
   - Accept phone, aadhaar fields
   - Require phone verification before allowing update
   - Update user document following same pattern as existing controllers

Do NOT change existing loginUser, logoutUser, refreshAccessToken functions. Follow exact same error handling, validation, and response patterns.
```

### **STEP 4: Create Profile Verification Service**

**AI PROMPT 4**:
```
Create src/services/verificationService.js following BACKEND_ANALYSIS.md service pattern:

1. Implement sendEmailOTP(email, userId):
   - Use existing mail.js sendOtpMail function
   - Generate 6-digit OTP
   - Set emailOTP and emailOTPExpiry in user document
   - Follow same OTP generation as existing sendOTP controller

2. Implement verifyEmailOTP(userId, otp):
   - Validate OTP and expiry
   - Set emailVerified: true
   - Clear OTP fields
   - Follow same pattern as existing verifyOtp controller

3. Implement verifyAadhaar(aadhaarNumber):
   - Basic validation (12-digit number)
   - Simulated verification (set aadhaarVerified: true)
   - Follow same error handling pattern as BACKEND_ANALYSIS.md

4. Implement isProfileComplete(userId):
   - Check phoneVerified, emailVerified, aadhaarVerified
   - Return boolean and missing fields
   - Use same User model query patterns

Use the same asyncHandler pattern and ApiError handling as existing services.
```

### **STEP 5: Update Authentication Middleware**

**AI PROMPT 5**:
```
Update src/middlewares/auth.middleware.js following exact BACKEND_ANALYSIS.md pattern:

1. Keep existing verifyToken middleware unchanged
2. Add requireVerification middleware:
   - Check req.user.emailVerified, phoneVerified, aadhaarVerified
   - Allow read-only access if not verified (GET requests only)
   - Throw ApiError(403) for POST/PUT/DELETE if not verified
   - Follow same error handling pattern as existing middleware

3. Update authorizeRoles middleware:
   - Add support for 'farmer', 'buyer', 'logistics', 'admin' roles
   - Keep exact same implementation pattern
   - No changes to error handling

4. Add requireProfile middleware:
   - Check if user profile is complete using verificationService.isProfileComplete
   - Throw ApiError(400) with message "Complete profile required" if not complete
   - Follow same middleware pattern as verifyToken

Do NOT change the existing verifyToken implementation or JWT verification logic.
```

### **STEP 6: Update Routes**

**AI PROMPT 6**:
```
Update src/routes/users.auth.routes.js following BACKEND_ANALYSIS.md route pattern:

1. Add new routes:
   - POST /google-auth - Google OAuth login
   - POST /send-phone-otp - Send phone OTP
   - POST /verify-phone-otp - Verify phone OTP
   - POST /send-email-otp - Send email OTP  
   - POST /verify-email-otp - Verify email OTP
   - POST /verify-aadhaar - Verify Aadhaar
   - PUT /complete-profile - Complete user profile
   - GET /profile-status - Get verification status

2. Add middleware protection:
   - Use verifyToken for protected routes
   - Use requireVerification for routes needing verified users
   - Use authorizeRoles for role-specific routes

3. Keep existing routes unchanged:
   - /register, /login, /logout, /refresh-token, /verify-token

Follow exact same route pattern, import structure, and middleware usage as BACKEND_ANALYSIS.md.
```

### **STEP 7: Create Role-Based Controllers**

**AI PROMPT 7**:
```
Create new controllers following BACKEND_ANALYSIS.md controller pattern:

1. src/controllers/farmer.controller.js:
   - Get crops, add produce, view orders
   - Use same asyncHandler, ApiError, ApiResponse pattern
   - Use requireVerification middleware for all routes
   - Follow same error handling and response format

2. src/controllers/buyer.controller.js:
   - Browse products, place orders, view purchases
   - Same patterns as farmer.controller.js
   - Use authorizeRoles('buyer', 'admin') middleware

3. src/controllers/logistics.controller.js:
   - View deliveries, update status, manage routes
   - Same patterns as other controllers
   - Use authorizeRoles('logistics', 'admin') middleware

4. Update src/controllers/admin.controller.js:
   - Pre-register admin users
   - View all users, manage verifications
   - Keep existing admin patterns from BACKEND_ANALYSIS.md

All controllers must follow exact same structure, error handling, and response format as existing controllers.
```

### **STEP 8: Create Role-Based Routes**

**AI PROMPT 8**:
```
Create new route files following BACKEND_ANALYSIS.md route pattern:

1. src/routes/farmer.routes.js:
   - Import farmer controller functions
   - Apply verifyToken, requireVerification, authorizeRoles('farmer', 'admin')
   - Follow exact same route structure as users.auth.routes.js

2. src/routes/buyer.routes.js:
   - Import buyer controller functions
   - Apply verifyToken, requireVerification, authorizeRoles('buyer', 'admin')
   - Same route pattern as other route files

3. src/routes/logistics.routes.js:
   - Import logistics controller functions  
   - Apply verifyToken, requireVerification, authorizeRoles('logistics', 'admin')
   - Same route pattern as other route files

Update src/app.js to include new routes following exact same pattern as existing route imports.
```

### **STEP 9: Update Environment Variables**

**AI PROMPT 9**:
```
Update .env.example following BACKEND_ANALYSIS.md environment pattern:

Add new variables:
- GOOGLE_CLIENT_ID=your_google_client_id
- GOOGLE_CLIENT_SECRET=your_google_client_secret
- TWILIO_ACCOUNT_SID=your_twilio_sid
- TWILIO_AUTH_TOKEN=your_twilio_token
- TWILIO_PHONE_NUMBER=your_twilio_phone

Keep all existing variables from BACKEND_ANALYSIS.md:
- PORT, MONGODB_URI, JWT_SECRET, REFRESH_TOKEN_SECRET
- EMAIL, APP_PASSWORD, CLIENT_HOST, CLIENT_PORT
- RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET

Follow exact same format and comments as BACKEND_ANALYSIS.md environment section.
```

### **STEP 10: Create Admin Pre-registration**

**AI PROMPT 10**:
```
Create admin pre-registration script following BACKEND_ANALYSIS.md patterns:

1. Create scripts/preRegisterAdmin.js:
   - Connect to database using same db/index.js pattern
   - Create admin user with role: 'admin'
   - Set emailVerified: true, phoneVerified: true, aadhaarVerified: true
   - Use same User model and password hashing as existing registration
   - Handle duplicate admin error gracefully

2. Update package.json scripts:
   - Add "pre-register-admin": "node scripts/preRegisterAdmin.js"
   - Follow same script pattern as existing BACKEND_ANALYSIS.md

3. Create admin verification controller:
   - Add functions to verify user documents
   - Follow same controller patterns as admin.controller.js
   - Use same error handling and response format

Do NOT create new database connections or user creation patterns - use existing ones.
```

---

## 🔧 Implementation Rules (STRICT)

### ✅ **FOLLOW BACKEND_ANALYSIS.md EXACTLY**
- Same folder structure
- Same import/export patterns
- Same error handling (ApiError, asyncHandler)
- Same response format (ApiResponse)
- Same JWT token generation
- Same database connection
- Same middleware patterns

### ❌ **DO NOT CREATE NEW PATTERNS**
- No new authentication methods
- No new response formats
- No new error handling
- No new database connections
- No new folder structures

### 🔄 **ADAPT EXISTING PATTERNS**
- Extend User model (don't replace)
- Add new controllers (don't change existing)
- Add new routes (follow same pattern)
- Add middleware (follow same pattern)

---

## 📋 Execution Checklist

### Phase 1: Core Authentication
- [ ] Update User model with new fields
- [ ] Create Google OAuth service
- [ ] Update authentication controller
- [ ] Test dual authentication

### Phase 2: Verification System
- [ ] Create verification service
- [ ] Add OTP functionality
- [ ] Update authentication middleware
- [ ] Test verification flows

### Phase 3: Role-Based Access
- [ ] Create role-based controllers
- [ ] Create role-based routes
- [ ] Update app.js routes
- [ ] Test role permissions

### Phase 4: Admin & Final Setup
- [ ] Create admin pre-registration
- [ ] Update environment variables
- [ ] Test complete flow
- [ ] Documentation updates

---

## 🎯 Success Criteria

1. **Google OAuth works** alongside manual login
2. **Role-based dashboards** function correctly
3. **Profile verification** blocks unverified actions
4. **Admin can pre-register** and verify users
5. **All existing functionality** remains unchanged
6. **Architecture follows** BACKEND_ANALYSIS.md exactly

**Remember**: Every step must follow BACKEND_ANALYSIS.md patterns. No new architecture, only adaptation of existing patterns for new requirements.

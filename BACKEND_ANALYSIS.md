# EventFlex Backend Architecture Analysis

## 📋 Project Overview

**Project Name**: EventFlex  
**Type**: Professional Event Management Platform  
**Backend Framework**: Express.js with ES6 Modules  
**Database**: MongoDB with Mongoose ODM  
**Authentication**: JWT-based with Refresh Tokens  
**Architecture**: MVC Pattern with Service Layer  

---

## 🏗️ Project Structure

```
server/
├── src/
│   ├── app.js                 # Main Express app configuration
│   ├── index.js               # Server entry point
│   ├── constants.js           # Application constants
│   ├── db/
│   │   └── index.js          # Database connection
│   ├── models/               # Mongoose schemas (31 models)
│   ├── controllers/          # Business logic handlers (9 controllers)
│   ├── routes/               # API route definitions (9 route files)
│   ├── middlewares/          # Custom middlewares (7 middlewares)
│   ├── utils/                # Utility functions (6 utils)
│   ├── services/             # Business services (3 services)
│   └── blockchain/           # Blockchain integration
├── client/                   # Frontend build output
├── node_modules/
├── package.json
└── .env files
```

---

## 🔧 Core Configuration

### Server Configuration (`src/index.js`)
- **Port**: 8080 (configurable via `PORT` env var)
- **Database**: MongoDB with connection pooling
- **Background Jobs**: Event status updates every 60 seconds
- **Environment**: Dual config support (`.env` + `.env.blockchain`)

### Express App Setup (`src/app.js`)
- **CORS**: Configured for frontend integration
- **Body Parsing**: JSON & URL-encoded with 32KB limit
- **Cookie Parser**: For token management
- **Static Files**: Serves frontend from `dist/` and `public/`
- **Security**: Input sanitization & rate limiting

---

## 🗄️ Database Architecture

### Connection Setup (`src/db/index.js`)
```javascript
// Uses environment variables with fallbacks
MONGODB_URI || "mongodb://localhost:27017/eventflex"
DB_Name = "EventFlex"
```

### Key Models Overview

#### 1. User Model (`src/models/User.model.js`)
**Purpose**: Core user authentication and profile management

**Schema Fields**:
- **Authentication**: email, password, phone
- **Profile**: first_name, last_name, avatar
- **Roles**: gig, organizer, host (enum)
- **Security**: refreshToken, isBanned, isVerified
- **Wallet**: Blockchain wallet integration
- **KYC**: Video verification with wellness score
- **OTP**: Password reset functionality

**Key Methods**:
- `isPasswordCorrect()` - bcrypt password validation
- `generateAccessToken()` - JWT creation (15 min expiry)
- `generateRefreshToken()` - JWT creation (7 days expiry)
- `fullName` virtual - Combined name property

**Security Features**:
- Password hashing with bcrypt (salt rounds: 10)
- Soft delete middleware
- Indexes on email, phone, name fields

#### 2. Event Model (`src/models/Event.model.js`)
**Purpose**: Event management and scheduling

**Key Relationships**:
- `host` → User (required)
- `organizer` → User (optional, assigned later)

**Schema Fields**:
- **Details**: title, description, event_type
- **Schedule**: start_date, end_date
- **Location**: GeoJSON coordinates
- **Financial**: budget (Decimal128)
- **Status**: published → in_progress → completed

#### 3. Admin Model (`src/models/Admin.model.js`)
**Purpose**: Administrative access control

**Features**:
- Separate authentication system
- Action tracking (last_action_type, last_action_at)
- Role-based permissions

---

## 🔐 Authentication & Authorization System

### Token Strategy
**Access Token**:
- Payload: `_id, role, email`
- Secret: `ACCESS_TOKEN_SECRET`
- Expiry: `ACCESS_TOKEN_EXPIRY` (typically 15 minutes)

**Refresh Token**:
- Payload: `_id` only
- Secret: `REFRESH_TOKEN_SECRET`
- Expiry: `REFRESH_TOKEN_EXPIRY` (typically 7 days)
- Stored in database for revocation support

### Cookie Configuration
```javascript
const options = {
  httpOnly: false,        // Client-side access (development)
  secure: false,         // HTTP support (localhost)
  sameSite: 'Lax',       // CSRF protection
  maxAge: 7 * 24 * 60 * 60 * 1000  // 7 days
}
```

### Authentication Flow

#### 1. Registration (`/api/v1/auth/users/register`)
**Validation**:
- Email format regex validation
- Phone number (Indian format: /^[6-9]\d{9}$/)
- Password strength: uppercase, lowercase, number, special char
- Role validation: gig, organizer, host

**Process**:
1. Validate all input fields
2. Check for existing user by email
3. Generate universal_role_id (`${role}-${Date.now()}`)
4. Hash password (pre-save middleware)
5. Create user document
6. Return user data without sensitive fields

#### 2. Login (`/api/v1/auth/users/login`)
**Process**:
1. Find user by email
2. Verify password using bcrypt
3. Generate access & refresh tokens
4. Store refresh token in database
5. Set HTTP-only cookies
6. Return user data with tokens

#### 3. Token Refresh (`/api/v1/auth/users/refresh-token`)
**Process**:
1. Extract refresh token from cookie/body
2. Verify JWT signature
3. Find user by decoded ID
4. Validate token matches database
5. Generate new token pair
6. Update refresh token in database
7. Set new cookies

#### 4. Logout (`/api/v1/auth/users/logout`)
**Process**:
1. Remove refresh token from database
2. Clear access & refresh cookies
3. Return success response

### Authorization Middleware (`src/middlewares/auth.middleware.js`)

#### `verifyToken` Middleware
- Extracts token from cookies or Authorization header
- Verifies JWT signature
- Attaches user to request object
- Handles token expiration and invalid tokens

#### `authorizeRoles` Middleware
- Factory function for role-based access control
- Accepts variable number of allowed roles
- Throws 403 error for unauthorized access

---

## 🛡️ Security Implementation

### 1. Input Sanitization (`src/middlewares/sanitize.middleware.js`)
**Features**:
- Removes HTML tags (`<>`)
- Strips JavaScript protocols
- Removes event handlers (`on*=`)
- Limits string length to 1000 chars
- Applied to body, query, and parameters

### 2. Rate Limiting
**Global**: 1000 requests per 15 minutes  
**API Routes**: 3000 requests per minute  
**Implementation**: In-memory client tracking

### 3. Password Security
- **Hashing**: bcrypt with 10 salt rounds
- **Validation**: Strong password requirements
- **Reset**: OTP-based system with 5-minute expiry

### 4. CORS Configuration
```javascript
origin: [`http://${process.env.CLIENT_HOST}:${process.env.CLIENT_PORT}`]
credentials: true
```

### 5. Error Handling (`src/middlewares/errorHandler.middleware.js`)
**Comprehensive Error Types**:
- Validation errors (Mongoose)
- Cast errors (invalid ObjectIds)
- Duplicate key errors
- JWT errors (expired, invalid)
- Generic error wrapping

---

## 📊 API Architecture

### Route Structure

#### Authentication Routes (`/api/v1/auth/users`)
- `POST /register` - User registration
- `POST /login` - User login
- `POST /refresh-token` - Token refresh
- `POST /logout` - User logout (protected)
- `GET /verify-token` - Token validation (protected)
- `POST /send-otp` - Password reset OTP
- `POST /verify-otp` - OTP verification
- `POST /reset-password` - Password reset
- `POST /google-auth` - Google OAuth

#### Admin Routes (`/api/v1/auth/admin`)
- Separate authentication system
- Admin-specific token generation
- Role-based access control

#### Business Logic Routes
- `/api/v1/gigs` - Gig worker management
- `/api/v1/organizer` - Event organizer operations
- `/api/v1/host` - Event host management
- `/api/v1/admin` - Administrative functions
- `/api/v1/payments` - Razorpay integration
- `/api/blockchain` - Web3 integration

### Response Structure (`src/utils/ApiResponse.js`)
```javascript
{
  statusCode: number,
  data: any,
  message: string,
  success: boolean  // statusCode < 400
}
```

### Error Structure (`src/utils/ApiError.js`)
```javascript
{
  statusCode: number,
  message: string,
  data: null,
  success: false,
  error: array,
  stack: string  // development only
}
```

---

## 🔧 Utility Functions

### 1. Async Handler (`src/utils/asyncHandler.js`)
**Purpose**: Eliminates try-catch boilerplate in controllers
**Implementation**: Promise-based error forwarding to Express error handler

### 2. Email Service (`src/utils/mail.js`)
**Provider**: Nodemailer with Gmail
**Features**:
- OTP email templates
- Time-sensitive information
- Professional branding

### 3. File Upload (`src/utils/cloudinary.js`)
**Integration**: Cloudinary for image storage
**Features**: Secure file upload with validation

### 4. Razorpay Integration (`src/utils/razorpay.js`)
**Purpose**: Payment gateway integration
**Features**: Order creation and verification

---

## 📈 Background Services

### Event Status Management (`src/services/eventStatusService.js`)
**Purpose**: Automated event lifecycle management

**Schedule**: Every 60 seconds

**Status Transitions**:
1. **published → in_progress**
   - Trigger: start_date ≤ now ≤ end_date
   - Updates: Event status only

2. **published/in_progress → completed**
   - Trigger: end_date ≤ now
   - Updates: Event, OrganizerPool, Pool statuses
   - Pools archived on completion

**Logging**: Comprehensive status change tracking

---

## 🏗️ Design Patterns

### 1. MVC Architecture
- **Models**: Data schemas and business rules
- **Views**: API responses (JSON)
- **Controllers**: Request handling and orchestration

### 2. Service Layer
- Business logic separation
- Reusable services
- Background job management

### 3. Middleware Pattern
- Request processing pipeline
- Cross-cutting concerns (auth, validation, security)
- Composable architecture

### 4. Factory Pattern
- `authorizeRoles` middleware factory
- Configurable role-based access

---

## 🔗 Frontend Integration

### 1. CORS Configuration
- Supports multiple frontend origins
- Credentials enabled for cookies
- Development-friendly setup

### 2. Static File Serving
- Frontend build output in `dist/`
- Fallback to index.html for SPA routing
- Asset optimization support

### 3. Cookie Management
- HTTP-only cookies for security
- Client-side access for development
- SameSite configuration for CSRF protection

---

## 📊 Database Relationships

### User-Centric Relationships
```
User (host) → Events (one-to-many)
User (organizer) → Events (one-to-many)
User → UserProfile (one-to-one)
User → UserWallet (one-to-one)
User → UserSkills (one-to-many)
User → Ratings (one-to-many)
```

### Event Ecosystem
```
Event → EventApplications (one-to-many)
Event → EventAttendance (one-to-many)
Event → Pool (one-to-many)
Event → OrganizerPool (one-to-one)
Event → Payments (one-to-many)
```

---

## 🚀 Performance Optimizations

### 1. Database Indexing
- User: email, phone, first_name, last_name
- Event: host, organizer, status
- Optimized query performance

### 2. Middleware Efficiency
- Conditional middleware application
- Early termination for invalid requests
- Memory-efficient rate limiting

### 3. Token Management
- Minimal token payload
- Efficient refresh token rotation
- Database-optimized token storage

---

## 🔒 Security Best Practices

### 1. Authentication
- Strong password policies
- JWT with short expiry
- Refresh token rotation
- Secure cookie configuration

### 2. Input Validation
- Comprehensive sanitization
- SQL injection prevention
- XSS protection
- Length limitations

### 3. Access Control
- Role-based authorization
- Route-level protection
- Admin privilege separation
- API rate limiting

### 4. Data Protection
- Password hashing
- Sensitive field exclusion
- Environment variable security
- Error information sanitization

---

## 📝 Development Notes

### Environment Variables Required
```
PORT=8080
MONGODB_URI=mongodb://localhost:27017
ACCESS_TOKEN_SECRET=your_secret
REFRESH_TOKEN_SECRET=your_secret
ACCESS_TOKEN_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d
EMAIL=gmail_address
APP_PASSWORD=gmail_app_password
CLIENT_HOST=localhost
CLIENT_PORT=3000
RAZORPAY_KEY_ID=razorpay_key
RAZORPAY_KEY_SECRET=razorpay_secret
```

### Development Scripts
```json
{
  "dev": "nodemon src/index.js",
  "start": "node src/index.js"
}
```

### Monitoring & Logging
- Comprehensive error logging
- Request/response tracking
- Background job status updates
- Database connection monitoring

---

## 🎯 Key Strengths

1. **Modular Architecture**: Clean separation of concerns
2. **Security First**: Multiple layers of security implementation
3. **Scalable Design**: Service layer and background jobs
4. **Type Safety**: Comprehensive validation and sanitization
5. **Error Handling**: Centralized error management
6. **Authentication**: Robust JWT implementation with refresh tokens
7. **Database Design**: Well-structured relationships and indexing
8. **Frontend Ready**: CORS and static file serving configured

---

## 🔧 Areas for Improvement

1. **Environment Configuration**: More flexible environment setup
2. **Database Optimization**: Query optimization for complex aggregations
3. **Caching Strategy**: Redis integration for session management
4. **Testing**: Unit and integration test coverage
5. **Documentation**: API documentation (Swagger/OpenAPI)
6. **Monitoring**: Application performance monitoring
7. **Security**: HTTPS enforcement in production
8. **Scalability**: Load balancing and clustering support

---

**Analysis Date**: March 23, 2026  
**Backend Version**: 1.0.0  
**Framework**: Express.js 5.1.0  
**Database**: MongoDB with Mongoose 8.18.1

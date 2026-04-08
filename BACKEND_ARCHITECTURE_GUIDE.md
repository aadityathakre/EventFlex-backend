# Backend Architecture Guide - Universal Template

## 📋 Overview

This guide provides a **universal backend architecture template** that can be applied to any type of web application - whether it's an e-commerce platform, social media app, booking system, or any other project. The focus is on **structure, patterns, and best practices** rather than specific business logic.

---

## 🏗️ Universal Project Structure

```
backend/
├── src/
│   ├── app.js                 # Express app configuration
│   ├── server.js              # Server startup (alternative to index.js)
│   ├── index.js               # Application entry point
│   ├── config/
│   │   ├── database.js        # Database configuration
│   │   ├── constants.js       # Application constants
│   │   └── environment.js     # Environment variable management
│   ├── models/                # Data models/schemas
│   ├── controllers/           # Business logic handlers
│   ├── routes/                # API route definitions
│   ├── middlewares/           # Custom middleware functions
│   ├── services/              # Business logic services
│   ├── utils/                 # Utility functions
│   ├── validators/            # Input validation schemas
│   ├── repositories/          # Data access layer (optional)
│   └── types/                 # TypeScript definitions (if using TS)
├── tests/                     # Test files
├── docs/                      # API documentation
├── scripts/                   # Utility scripts
├── uploads/                   # File upload directory
├── logs/                      # Application logs
├── .env.example              # Environment variables template
├── .gitignore                # Git ignore file
├── package.json              # Dependencies and scripts
└── README.md                 # Project documentation
```

---

## 🔧 Core Configuration Files

### 1. Package.json Template
```json
{
  "name": "your-backend-project",
  "version": "1.0.0",
  "type": "module",
  "main": "src/index.js",
  "scripts": {
    "dev": "nodemon src/index.js",
    "start": "node src/index.js",
    "test": "jest",
    "test:watch": "jest --watch",
    "lint": "eslint src/",
    "lint:fix": "eslint src/ --fix",
    "docs": "swagger-jsdoc -d swaggerDef.js src/routes/*.js -o docs/swagger.json"
  },
  "dependencies": {
    "express": "^4.18.0",
    "mongoose": "^7.0.0",
    "cors": "^2.8.5",
    "helmet": "^6.0.0",
    "morgan": "^1.10.0",
    "dotenv": "^16.0.0",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.0",
    "joi": "^17.7.0",
    "multer": "^1.4.5",
    "compression": "^1.7.4",
    "express-rate-limit": "^6.7.0"
  },
  "devDependencies": {
    "nodemon": "^2.0.20",
    "jest": "^29.3.0",
    "supertest": "^6.3.0",
    "eslint": "^8.31.0",
    "swagger-jsdoc": "^6.2.8",
    "swagger-ui-express": "^4.6.0"
  }
}
```

### 2. Environment Variables Template (.env.example)
```env
# Server Configuration
NODE_ENV=development
PORT=8000
HOST=http://localhost

# Database
MONGODB_URI
DB_NAME=your_database

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRE=15m
REFRESH_TOKEN_SECRET=your_refresh_token_secret_here
REFRESH_TOKEN_EXPIRE=7d

# Email Configuration (if needed)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# File Upload
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=5242880

# External APIs (if needed)
API_KEY_EXTERNAL=your_external_api_key

# CORS
FRONTEND_URL=http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS
RATE_LIMIT_MAX_REQUESTS
```

---

## 🗄️ Database Setup Template

### Database Configuration (`src/config/database.js`)
```javascript
import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('❌ Database Connection Error:', error);
    process.exit(1);
  }
};

export default connectDB;
```

### Universal Model Template
```javascript
import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

// Base schema that can be extended
const baseSchema = {
  // Common fields for most models
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
};

// User Model Template (most common starting point)
const UserSchema = new Schema({
  // Authentication fields
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
  },
  password: {
    type: String,
    required: function() { return !this.socialLogin; },
    minlength: 6,
  },
  
  // Profile fields
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  avatar: { type: String, default: '' },
  
  // Role-based access
  role: {
    type: String,
    enum: ['user', 'admin', 'moderator', 'vendor'],
    default: 'user',
  },
  
  // Social login (optional)
  socialLogin: { type: Boolean, default: false },
  socialProvider: { type: String, enum: ['google', 'facebook', 'github'] },
  socialId: { type: String },
  
  // Verification
  isEmailVerified: { type: Boolean, default: false },
  emailVerificationToken: { type: String },
  passwordResetToken: { type: String },
  passwordResetExpires: { type: Date },
  
  // Session management
  lastLogin: { type: Date },
  refreshToken: { type: String },
  
  ...baseSchema
});

// Virtual for full name
UserSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Pre-save middleware for password hashing
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Instance methods
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

UserSchema.methods.toJSON = function() {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.refreshToken;
  delete userObject.passwordResetToken;
  delete userObject.emailVerificationToken;
  return userObject;
};

export default mongoose.model('User', UserSchema);
```

---

## 🔐 Authentication System Template

### JWT Service (`src/services/jwtService.js`)
```javascript
import jwt from 'jsonwebtoken';

class JWTService {
  generateAccessToken(payload) {
    return jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRE,
    });
  }

  generateRefreshToken(payload) {
    return jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET, {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRE,
    });
  }

  verifyAccessToken(token) {
    return jwt.verify(token, process.env.JWT_SECRET);
  }

  verifyRefreshToken(token) {
    return jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
  }
}

export default new JWTService();
```

### Authentication Middleware (`src/middlewares/auth.js`)
```javascript
import jwt from 'jsonwebtoken';
import User from '../models/User.model.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';

const authenticate = asyncHandler(async (req, res, next) => {
  // Get token from header or cookie
  const token = req.header('Authorization')?.replace('Bearer ', '') ||
                req.cookies?.accessToken;

  if (!token) {
    throw new ApiError(401, 'Access denied. No token provided.');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      throw new ApiError(401, 'Invalid token. User not found.');
    }

    req.user = user;
    next();
  } catch (error) {
    throw new ApiError(401, 'Invalid token.');
  }
});

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      throw new ApiError(403, 'Access denied. Insufficient permissions.');
    }
    next();
  };
};

export { authenticate, authorize };
```

---

## 🛡️ Security Middleware Template

### Security Configuration (`src/middlewares/security.js`)
```javascript
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { ApiError } from '../utils/ApiError.js';

// Rate limiting configuration
export const rateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limiting for auth routes
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    error: 'Too many authentication attempts, please try again later.',
  },
});

// Input sanitization middleware
export const sanitizeInput = (req, res, next) => {
  const sanitizeString = (str) => {
    if (typeof str !== 'string') return str;
    return str
      .trim()
      .replace(/[<>]/g, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+=/gi, '');
  };

  const sanitizeObject = (obj) => {
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        obj[key] = sanitizeString(obj[key]);
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitizeObject(obj[key]);
      }
    }
  };

  if (req.body) sanitizeObject(req.body);
  if (req.query) sanitizeObject(req.query);
  if (req.params) sanitizeObject(req.params);

  next();
};

// CORS configuration
export const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = process.env.FRONTEND_URL?.split(',') || [];
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new ApiError(401, 'Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
};
```

---

## 📊 API Response Structure

### Standard Response Classes (`src/utils/response.js`)
```javascript
// Success Response
export class ApiResponse {
  constructor(statusCode, data, message = 'Success') {
    this.statusCode = statusCode;
    this.success = statusCode < 400;
    this.message = message;
    this.data = data;
  }
}

// Error Response
export class ApiError extends Error {
  constructor(statusCode, message, errors = [], stack = '') {
    super(message);
    this.statusCode = statusCode;
    this.success = false;
    this.errors = errors;
    
    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

// Async Handler for error catching
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
```

### Error Handler Middleware (`src/middlewares/errorHandler.js`)
```javascript
import { ApiError } from '../utils/ApiError.js';

export const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  console.error(err);

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = new ApiError(404, message);
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const message = 'Duplicate field value entered';
    error = new ApiError(400, message);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message);
    error = new ApiError(400, message);
  }

  res.status(error.statusCode || 500).json({
    success: false,
    error: error.message || 'Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

export const notFound = (req, res, next) => {
  const error = new ApiError(404, `Not found - ${req.originalUrl}`);
  next(error);
};
```

---

## 🎯 Controller Template

### Base Controller (`src/controllers/baseController.js`)
```javascript
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/response.js';

export class BaseController {
  constructor(model) {
    this.model = model;
  }

  // Get all resources with pagination
  getAll = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = { ...req.query };
    delete filter.page;
    delete filter.limit;
    delete filter.sort;

    const resources = await this.model
      .find(filter)
      .sort(req.query.sort || '-createdAt')
      .skip(skip)
      .limit(limit);

    const total = await this.model.countDocuments(filter);

    res.status(200).json(
      new ApiResponse(200, {
        resources,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      }, 'Resources retrieved successfully')
    );
  });

  // Get resource by ID
  getById = asyncHandler(async (req, res) => {
    const resource = await this.model.findById(req.params.id);

    if (!resource) {
      throw new ApiError(404, 'Resource not found');
    }

    res.status(200).json(
      new ApiResponse(200, resource, 'Resource retrieved successfully')
    );
  });

  // Create new resource
  create = asyncHandler(async (req, res) => {
    const resource = await this.model.create(req.body);

    res.status(201).json(
      new ApiResponse(201, resource, 'Resource created successfully')
    );
  });

  // Update resource
  update = asyncHandler(async (req, res) => {
    const resource = await this.model.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!resource) {
      throw new ApiError(404, 'Resource not found');
    }

    res.status(200).json(
      new ApiResponse(200, resource, 'Resource updated successfully')
    );
  });

  // Delete resource
  delete = asyncHandler(async (req, res) => {
    const resource = await this.model.findByIdAndDelete(req.params.id);

    if (!resource) {
      throw new ApiError(404, 'Resource not found');
    }

    res.status(200).json(
      new ApiResponse(200, {}, 'Resource deleted successfully')
    );
  });
}
```

### Specific Controller Example (`src/controllers/userController.js`)
```javascript
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/response.js';
import { ApiError } from '../utils/ApiError.js';
import User from '../models/User.model.js';
import jwtService from '../services/jwtService.js';

export const registerUser = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, password } = req.body;

  // Check if user exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ApiError(400, 'User already exists');
  }

  // Create user
  const user = await User.create({
    firstName,
    lastName,
    email,
    password,
  });

  // Generate tokens
  const accessToken = jwtService.generateAccessToken({ id: user._id });
  const refreshToken = jwtService.generateRefreshToken({ id: user._id });

  // Save refresh token
  user.refreshToken = refreshToken;
  await user.save();

  // Set cookies
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  };

  res.cookie('refreshToken', refreshToken, cookieOptions);

  res.status(201).json(
    new ApiResponse(201, {
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
      },
      accessToken,
    }, 'User registered successfully')
  );
});

export const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Find user
  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, 'Invalid credentials');
  }

  // Generate tokens
  const accessToken = jwtService.generateAccessToken({ id: user._id });
  const refreshToken = jwtService.generateRefreshToken({ id: user._id });

  // Save refresh token and update last login
  user.refreshToken = refreshToken;
  user.lastLogin = new Date();
  await user.save();

  // Set cookies
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };

  res.cookie('refreshToken', refreshToken, cookieOptions);

  res.status(200).json(
    new ApiResponse(200, {
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
      },
      accessToken,
    }, 'Login successful')
  );
});
```

---

## 🛣️ Routes Template

### Base Route Setup (`src/routes/index.js`)
```javascript
import express from 'express';

const router = express.Router();

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
  });
});

export default router;
```

### User Routes (`src/routes/userRoutes.js`)
```javascript
import express from 'express';
import {
  registerUser,
  loginUser,
  getProfile,
  updateProfile,
  logoutUser,
} from '../controllers/userController.js';
import { authenticate } from '../middlewares/auth.js';
import { validateRegistration, validateLogin } from '../validators/userValidator.js';

const router = express.Router();

// Public routes
router.post('/register', validateRegistration, registerUser);
router.post('/login', validateLogin, loginUser);

// Protected routes
router.get('/profile', authenticate, getProfile);
router.put('/profile', authenticate, updateProfile);
router.post('/logout', authenticate, logoutUser);

export default router;
```

---

## ✅ Input Validation Template

### Validation with Joi (`src/validators/userValidator.js`)
```javascript
import Joi from 'joi';

export const validateRegistration = (req, res, next) => {
  const schema = Joi.object({
    firstName: Joi.string().min(2).max(50).required(),
    lastName: Joi.string().min(2).max(50).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    role: Joi.string().valid('user', 'admin', 'moderator').default('user'),
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: error.details.map(detail => detail.message),
    });
  }

  next();
};

export const validateLogin = (req, res, next) => {
  const schema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: error.details.map(detail => detail.message),
    });
  }

  next();
};
```

---

## 🚀 Main Application Setup

### App Configuration (`src/app.js`)
```javascript
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { rateLimiter, corsOptions, sanitizeInput } from './middlewares/security.js';
import { errorHandler, notFound } from './middlewares/errorHandler.js';

// Import routes
import userRoutes from './routes/userRoutes.js';
import baseRoutes from './routes/index.js';

const app = express();

// Security middleware
app.use(helmet());
app.use(compression());

// CORS configuration
app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Rate limiting
app.use(rateLimiter);

// Input sanitization
app.use(sanitizeInput);

// Routes
app.use('/api/v1', baseRoutes);
app.use('/api/v1/users', userRoutes);

// Add more routes here as needed
// app.use('/api/v1/products', productRoutes);
// app.use('/api/v1/orders', orderRoutes);

// Static files
app.use('/uploads', express.static('uploads'));

// Error handling middleware (must be last)
app.use(notFound);
app.use(errorHandler);

export default app;
```

### Server Startup (`src/index.js`)
```javascript
import dotenv from 'dotenv';
import connectDB from './config/database.js';
import app from './app.js';

// Load environment variables
dotenv.config();

// Connect to database
connectDB();

const PORT = process.env.PORT || 8000;

const server = app.listen(PORT, () => {
  console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.log(`Error: ${err.message}`);
  process.exit(1);
});
```

---

## 📝 Best Practices Checklist

### ✅ Security
- [ ] Input validation and sanitization
- [ ] Rate limiting implementation
- [ ] CORS configuration
- [ ] Helmet for security headers
- [ ] Password hashing with bcrypt
- [ ] JWT with proper expiry
- [ ] Environment variable protection
- [ ] SQL injection prevention
- [ ] XSS protection

### ✅ Performance
- [ ] Compression middleware
- [ ] Database indexing
- [ ] Pagination for large datasets
- [ ] Caching strategy (Redis optional)
- [ ] Image optimization
- [ ] Lazy loading where applicable

### ✅ Code Quality
- [ ] Consistent error handling
- [ ] Proper logging
- [ ] Code documentation
- [ ] ESLint configuration
- [ ] Type checking (optional TypeScript)
- [ ] Unit tests
- [ ] Integration tests

### ✅ Architecture
- [ ] Separation of concerns
- [ ] DRY principle
- [ ] SOLID principles
- [ ] Modular structure
- [ ] Clear naming conventions
- [ ] API versioning

---

## 🔧 Development Workflow

### 1. Setup New Project
```bash
mkdir your-project
cd your-project
npm init -y
npm install express mongoose cors helmet morgan dotenv bcryptjs jsonwebtoken joi multer compression express-rate-limit
npm install -D nodemon jest supertest eslint
```

### 2. Create Basic Structure
- Follow the folder structure above
- Copy template files
- Customize for your specific needs

### 3. Environment Setup
- Copy `.env.example` to `.env`
- Fill in your configuration values
- Add `.env` to `.gitignore`

### 4. Database Models
- Define your data schemas
- Add necessary indexes
- Implement validation

### 5. API Development
- Create controllers for business logic
- Define routes for endpoints
- Add middleware for authentication/validation
- Test with Postman/Thunder Client

---

## 📚 Common Patterns

### 1. Repository Pattern (Optional)
```javascript
// src/repositories/baseRepository.js
export class BaseRepository {
  constructor(model) {
    this.model = model;
  }

  async findById(id) {
    return await this.model.findById(id);
  }

  async findOne(filter) {
    return await this.model.findOne(filter);
  }

  async find(filter = {}, options = {}) {
    return await this.model.find(filter, null, options);
  }

  async create(data) {
    return await this.model.create(data);
  }

  async update(id, data) {
    return await this.model.findByIdAndUpdate(id, data, { new: true });
  }

  async delete(id) {
    return await this.model.findByIdAndDelete(id);
  }
}
```

### 2. Service Layer Pattern
```javascript
// src/services/userService.js
import User from '../models/User.model.js';

export class UserService {
  async createUser(userData) {
    // Business logic here
    const user = await User.create(userData);
    return user;
  }

  async getUserById(id) {
    const user = await User.findById(id);
    if (!user) {
      throw new ApiError(404, 'User not found');
    }
    return user;
  }

  async updateUser(id, updateData) {
    const user = await this.getUserById(id);
    Object.assign(user, updateData);
    return await user.save();
  }
}
```

---

## 🎯 This Template Works For:

- **E-commerce Platforms** - Product, cart, order management
- **Social Media Apps** - User profiles, posts, comments, likes
- **Booking Systems** - Reservations, schedules, availability
- **Content Management** - Articles, media, categories
- **API Services** - Data processing, webhooks, integrations
- **SaaS Applications** - Multi-tenant architecture, subscriptions
- **IoT Platforms** - Device management, data collection
- **Financial Apps** - Transactions, accounts, reporting

---

**Remember**: This is a **template foundation**. Customize it based on your specific project requirements, scale, and business logic. The patterns and structures shown here are battle-tested and can be adapted for any backend application.

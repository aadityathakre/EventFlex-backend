import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { sanitizeInput, rateLimit } from "./middlewares/sanitize.middleware.js";
import dotenv from "dotenv";
import path from "path";

const app = express();
app.use(express.static("dist"))
dotenv.config({ path: "./.env.blockchain" });

//middlewares + configurations
app.use(express.static("public"))
app.use((req, res, next) => {
  if (req.is('multipart/form-data')) {
    return next();
  }
  express.json({ limit: "32kb" })(req, res, next);
});
app.use(express.urlencoded({ extended: true, limit: "32kb" }));
app.use(cookieParser());

// Build CORS origin - allow all localhost origins for local development
app.use(
  cors({
    origin: `http://${process.env.CLIENT_HOST}:${process.env.CLIENT_PORT}`,
    credentials: true,
  })
);

// Security middlewares
app.use(sanitizeInput);
app.use(rateLimit(1000, 15 * 60 * 1000)); // 1000 requests per 15 minutes

// Apply rate limiting to API routes only
app.use("/api/", rateLimit(3000, 60 * 1000)); // 100 requests per minute for API


// users auth route
import authRoutes from "./routes/users.auth.routes.js";
app.use("/api/v1/auth/users", authRoutes);

//gig route
import gigRoutes from "./routes/gig.routes.js";
app.use("/api/v1/gigs", gigRoutes);

//organizer route
import orgRoutes from "./routes/organizer.routes.js";
app.use("/api/v1/organizer", orgRoutes);

//host route
import hostRoutes from "./routes/host.routes.js";
app.use("/api/v1/host", hostRoutes);

// admin auth route
import adminAuthRoutes from "./routes/admin.auth.routes.js";
app.use("/api/v1/auth/admin", adminAuthRoutes);

//admin router
import adminRoutes from "./routes/admin.routes.js";
app.use("/api/v1/admin", adminRoutes);

//payment routes
import paymentRoutes from "./routes/razorpay.routes.js";
app.use("/api/v1/payments", paymentRoutes);


//blockchain routes
import blockchainRoutes from './routes/blockchain.routes.js';
app.get('/health', (req, res) => {
  res.json({ status: 'OK', blockchain: process.env.BLOCKCHAIN_ENABLED === 'true' });
});

// TEST ENDPOINT - Simple cookie test
app.get('/api/v1/test-cookie', (req, res) => {
  res.cookie('testCookie', 'testValue123', {
    httpOnly: true,
    secure: false,
    sameSite: 'Lax',
  });
  res.json({ success: true, message: 'Cookie set' });
});

// Routes
app.use('/api/blockchain', blockchainRoutes);





// Error handling middleware (must be last)
import { errorHandler, notFound } from "./middlewares/errorHandler.middleware.js";

// Catch-all route for React Router (must be after all API routes but before 404 handler)
app.use((req, res) => {
  res.sendFile(path.resolve("./dist/index.html"));
});

// 404 handler for undefined routes (only for API routes)
app.use((req, res, next) => {
  const error = new Error(`Route ${req.originalUrl} not found`);
  error.statusCode = 404;
  next(error);
});

// Global error handler
app.use(errorHandler);

//export
export { app };

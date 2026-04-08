import connectedDB from "../src/db/index.js";
import dotenv from "dotenv";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Load environment variables
dotenv.config({ path: "../.env" });
dotenv.config({ path: "../.env.blockchain" });

// Set fallback environment variables
process.env.PORT = process.env.PORT || "8080";
process.env.HOST = process.env.HOST || (process.env.NODE_ENV === 'production' ? 'https://eventflex-backend.vercel.app' : 'http://localhost');
process.env.MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/eventflex";
process.env.JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_change_in_production";
process.env.REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || "fallback_refresh_secret_change_in_production";
process.env.ACCESS_TOKEN_EXPIRY = process.env.ACCESS_TOKEN_EXPIRY || "15m";
process.env.REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || "7d";
process.env.BLOCKCHAIN_ENABLED = process.env.BLOCKCHAIN_ENABLED || "false";

// Create Express app
const app = express();

// CORS configuration
const allowedOrigins = [
  `http://${process.env.CLIENT_HOST}:${process.env.CLIENT_PORT}`,
  process.env.CLIENT_URL || 'https://eventflex.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173'
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        console.log('CORS blocked origin:', origin);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    preflightContinue: false
  })
);

// Basic middlewares
app.use(express.json({ limit: "32kb" }));
app.use(express.urlencoded({ extended: true, limit: "32kb" }));
app.use(cookieParser());

// Health check endpoint
app.get('/api/v1/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: "Backend is running!",
    timestamp: new Date().toISOString(),
    version: "1.0.0"
  });
});

// Import and use routes
try {
  const authRoutes = await import("../src/routes/users.auth.routes.js");
  app.use("/api/v1/auth/users", authRoutes.default);
  
  const adminAuthRoutes = await import("../src/routes/admin.auth.routes.js");
  app.use("/api/v1/auth/admin", adminAuthRoutes.default);
  
  // Add other routes as needed
  console.log("✅ Routes loaded successfully");
} catch (error) {
  console.error("❌ Error loading routes:", error);
}

// Initialize database
let dbInitialized = false;
const initializeDatabase = async () => {
  if (!dbInitialized) {
    try {
      console.log("Initializing database...");
      await connectedDB();
      dbInitialized = true;
      console.log("Database connected successfully");
    } catch (error) {
      console.error("Database connection failed:", error);
    }
  }
};

// Initialize database on module load
initializeDatabase();

export default app;

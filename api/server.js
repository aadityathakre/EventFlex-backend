import connectedDB from "../src/db/index.js";
import dotenv from "dotenv";
import { app } from "../src/app.js";

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

// Initialize database connection
let dbConnected = false;

const initDB = async () => {
  if (!dbConnected) {
    try {
      console.log("🔄 Initializing database connection...");
      await connectedDB();
      dbConnected = true;
      console.log("✅ Database connected successfully");
    } catch (error) {
      console.error("❌ Database connection failed:", error);
      throw error;
    }
  }
};

// Vercel serverless function handler
export default async function handler(req, res) {
  try {
    // Initialize database on first request
    if (!dbConnected) {
      await initDB();
    }
    
    // Handle the request with Express app
    return app(req, res);
  } catch (error) {
    console.error("❌ Server error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
}

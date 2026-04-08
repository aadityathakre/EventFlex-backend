import connectedDB from "./db/index.js";
import dotenv from "dotenv";
import { app } from "./app.js";
import { updateAllEventStatuses } from "./services/eventStatusService.js";

dotenv.config({ path: "./.env" });
dotenv.config({ path: "./.env.blockchain"  });

// Set fallback environment variables to prevent crashes
process.env.PORT = process.env.PORT || "8080";
process.env.HOST = process.env.HOST || "http://localhost";
process.env.MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/eventflex";
process.env.JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_change_in_production";
process.env.REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || "fallback_refresh_secret_change_in_production";
process.env.ACCESS_TOKEN_EXPIRY = process.env.ACCESS_TOKEN_EXPIRY || "15m";
process.env.REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || "7d";
process.env.BLOCKCHAIN_ENABLED = process.env.BLOCKCHAIN_ENABLED || "false";

connectedDB()
  .then((msg) => {
    console.log("Connected successfully");

    // Start background job for event status updates (temporarily disabled for stability)
    // setInterval(() => {
    //   updateAllEventStatuses();
    // }, 60 * 1000); // Check every 60 seconds
    // // Run once immediately on startup
    // updateAllEventStatuses();

    app.listen(process.env.PORT, () => {
      console.log(
        `App is listening on port ${process.env.HOST}:${process.env.PORT} `
      );
      console.log(`📍 Health: ${process.env.HOST}:${process.env.PORT}/health`);
      console.log(
        `⛓️  Blockchain: ${process.env.BLOCKCHAIN_ENABLED === "true" ? "Enabled" : "Disabled"}`
      );
    });
  })
  .catch((err) => {
    console.log(`Failed to connect with DB `, err);
  });

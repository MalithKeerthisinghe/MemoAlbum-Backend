import dotenv from "dotenv";

// Load env variables first
dotenv.config();

import mongoose from "mongoose";
import app from "./src/app.js";
import { connect as connectMongoClient } from "./src/db/mongo.js";

const PORT = process.env.PORT || 4000;

async function startServer() {
  try {
    // Mongo native client
    await connectMongoClient();
    console.log("MongoClient connected");

    // Mongoose
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Mongoose connected");

    // Start server
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
    });

  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

startServer();
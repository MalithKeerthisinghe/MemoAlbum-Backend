import dotenv from "dotenv";

// Load env variables FIRST, before any other imports
dotenv.config();

import mongoose from "mongoose";
import app from "./src/app.js";
import { connect as connectMongoClient } from "./src/db/mongo.js";

console.log("DB URL:", process.env.MONGODB_URI);

const PORT = process.env.PORT || 4000;

async function startServer() {
  try {
    // connect the MongoClient used by routes
    await connectMongoClient();
    console.log('MongoClient connected');

    // also connect mongoose for Mongoose models
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Mongoose connected');

    app.listen(PORT, () => {
      console.log(`Server running on ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
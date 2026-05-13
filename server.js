import mongoose from "mongoose";
import dotenv from "dotenv";

import app from "./src/app.js";

dotenv.config();

console.log("DB URL:", process.env.MONGODB_URI);

mongoose.connect(process.env.MONGODB_URI)
.then(() => {
  console.log("MongoDB Connected");
})
.catch((err) => {
  console.log("DB Error:", err);
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
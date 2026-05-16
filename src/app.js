import express from "express";
import cors from "cors";

import authRoutes from "./routes/authRoutes.js";
import adminApiRoutes from './routes/adminApi.js';

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("API Running");
});

// routes
app.use("/api/auth", authRoutes);
app.use('/api/admin', adminApiRoutes);
export default app;
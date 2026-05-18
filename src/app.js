 import express from "express";
import cors from "cors";

import authRoutes from "./routes/authRoutes.js";
import adminApiRoutes from './routes/adminApi.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

app.get("/", (req, res) => {
  res.send("API Running - LensFlow Studio");
});

 app.use("/api/auth", authRoutes);
app.use('/api/admin', adminApiRoutes);    

export default app;
 import express from "express";
import cors from "cors";

import authRoutes from "./routes/authRoutes.js";
import adminApiRoutes from './routes/adminApi.js';
import albumRoutes from './routes/albumRoutes.js';
import curateRoutes from './routes/curateRoutes.js';
import archiveRoutes from './routes/archiveRoutes.js';
import clientInviteRoutes from './routes/clientInviteRoutes.js';
import photographerRoutes from './routes/photographerRoutes.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

app.get("/", (req, res) => {
  res.send("API Running - LensFlow Studio");
});

 app.use("/api/auth", authRoutes);
app.use('/api/admin', adminApiRoutes);
app.use('/api/albums', albumRoutes);
app.use('/api/curate', curateRoutes);
app.use('/api/archive', archiveRoutes);
app.use('/api/client-invites', clientInviteRoutes);
app.use('/api/photographer', photographerRoutes);

export default app;
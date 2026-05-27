import express from "express";
import cors from "cors";

import authRoutes from "./routes/authRoutes.js";
import adminApiRoutes from "./routes/adminApi.js";
import albumRoutes from "./routes/albumRoutes.js";
import curateRoutes from "./routes/curateRoutes.js";
import archiveRoutes from "./routes/archiveRoutes.js";
import clientInviteRoutes from "./routes/clientInviteRoutes.js";
import photographerRoutes from "./routes/photographerRoutes.js";
import bookAlbumRoutes from "./routes/bookAlbumRoutes.js";

const app = express();

/* -------------------- MIDDLEWARE -------------------- */

// CORS (IMPORTANT FOR FRONTEND + ADMIN)
app.use(cors({
  origin: [
    "https://memoalbum.com",
    "https://admin.memoalbum.com"
  ],
  credentials: true
}));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

/* -------------------- TEST ROUTE -------------------- */

app.get("/", (req, res) => {
  res.send("API Running - LensFlow Studio");
});

/* -------------------- ROUTES -------------------- */

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminApiRoutes);
app.use("/api/albums", albumRoutes);
app.use("/api/curate", curateRoutes);
app.use("/api/archive", archiveRoutes);
app.use("/api/client-invites", clientInviteRoutes);
app.use("/api/photographer", photographerRoutes);
app.use("/api/book-albums", bookAlbumRoutes);

export default app;
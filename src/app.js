import express from "express";
import cors from "cors";
import path from "path";

import authRoutes from "./routes/authRoutes.js";
import adminApiRoutes from './routes/adminApi.js';
import albumRoutes from './routes/albumRoutes.js';
import curateRoutes from './routes/curateRoutes.js';
import archiveRoutes from './routes/archiveRoutes.js';
import clientInviteRoutes from './routes/clientInviteRoutes.js';
import favoriteRoutes from './routes/favoriteRoutes.js';
import photographerRoutes from './routes/photographerRoutes.js';
import bookAlbumRoutes from './routes/bookAlbumRoutes.js';
import contactRoutes from './routes/contactRoutes.js';
import galleryRoutes from './routes/galleryRoutes.js';
import paymentRoutes from './routes/payment.js';

const app = express();

const uploadsPath = path.join(process.cwd(), 'uploads');
app.use('/uploads', express.static(uploadsPath));

const allowedOrigins = [
  "https://memoalbum.com",
  "https://www.memoalbum.com",
  "https://admin.memoalbum.com"
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    console.error(`CORS blocked origin: ${origin}`);
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Expires',           // ✅ added
    'Cache-Control',     // ✅ added — often sent alongside Expires
    'Pragma',            // ✅ added — also cache-related
    'X-Requested-With',  // ✅ added — common in fetch requests
  ],
}));

app.options('*', cors());


app.options('*', cors());

app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));

app.get("/", (req, res) => {
  res.send("API Running - LensFlow Studio");
});

app.use("/api/auth", authRoutes);
app.use('/api/admin', adminApiRoutes);
app.use('/api/albums', albumRoutes);
app.use('/api/curate', curateRoutes);
app.use('/api/archive', archiveRoutes);
app.use('/api/client-invites', clientInviteRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/gallery', galleryRoutes);
app.use('/api/photographer', photographerRoutes);
app.use('/api/book-albums', bookAlbumRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/payment', paymentRoutes);

export default app;
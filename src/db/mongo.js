import { MongoClient } from 'mongodb';

let client;
let db;

export const connect = async () => {
  client = new MongoClient(process.env.MONGODB_URI, {
    tls: true,
    tlsAllowInvalidCertificates: false,
    tlsAllowInvalidHostnames: false,
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000,
  });
  await client.connect();
  db = client.db('couplecanvas');
  console.log('MongoDB connected successfully');
  return db;
};

export const getDb = () => {
  if (!db) throw new Error('Database not connected');
  return db;
};

export const close = async () => {
  if (client) await client.close();
  console.log('MongoDB connection closed');
};
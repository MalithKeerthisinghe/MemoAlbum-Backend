const { MongoClient } = require('mongodb');

let client;
let db;

const connect = async () => {
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

const getDb = () => {
  if (!db) throw new Error('Database not connected');
  return db;
};

const close = async () => {
  if (client) await client.close();
  console.log('MongoDB connection closed');
};

module.exports = { connect, getDb, close };
const { MongoClient } = require('mongodb');

let client;
let db;

const connect = async () => {
  client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  db = client.db('couplecanvas');
  console.log('MongoDB connected successfully');
  return db;
};

const getDb = () => {
  if (!db) throw new Error('Database not connected. Call connect() first.');
  return db;
};

const close = async () => {
  if (client) await client.close();
  console.log('MongoDB connection closed');
};

module.exports = { connect, getDb, close };
import { MongoClient } from "mongodb";

let client;
let db;

export const connect = async () => {
  client = new MongoClient(process.env.MONGODB_URI);

  await client.connect();

  db = client.db("memoalbum");

  console.log("MongoDB connected successfully");

  return db;
};
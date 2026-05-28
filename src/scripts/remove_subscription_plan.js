import 'dotenv/config.js';
import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || 'memoalbum';

async function main() {
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is required');
  }

  const client = new MongoClient(MONGODB_URI, {
    tls: true,
    tlsAllowInvalidCertificates: false,
    tlsAllowInvalidHostnames: false,
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000,
  });

  try {
    await client.connect();
    const db = client.db(MONGODB_DB);
    const users = db.collection('users');

    const result = await users.updateMany(
      { subscriptionPlan: { $exists: true } },
      { $unset: { subscriptionPlan: '' } }
    );

    try {
      await users.dropIndex('idx_users_subscription');
    } catch (error) {
      if (!String(error?.message || '').includes('index not found')) {
        throw error;
      }
    }

    console.log(`Removed subscriptionPlan from ${result.modifiedCount} users in ${MONGODB_DB}`);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error('Failed to remove subscriptionPlan:', error.message);
  process.exit(1);
});
require('dotenv').config();
const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');

const uri = process.env.MONGODB_URI;

async function main() {
  const client = new MongoClient(uri);
  await client.connect();
  console.log('Connected to MongoDB');

  const db = client.db('couplecanvas');

  // ── Drop old collections that are no longer needed ──────────────────────────
  const oldCollections = [
    'vendors', 'customers', 'album_vendors', 'service_vendors',
    'product_vendors', 'proposal_vendors', 'vendor_services',
    'vendor_profiles', 'vendor_subscriptions', 'vendor_products',
    'vendor_proposal', 'vendor_album_template', 'vendor_video',
    'vendor_settings', 'vendor_services_albums', 'marriage_proposals',
    'proposal_requests', 'sub_plan', 'contacts', 'admin_approval_log',
    'admin',
  ];

  for (const name of oldCollections) {
    try {
      await db.collection(name).drop();
      console.log(`Dropped old collection: ${name}`);
    } catch {
      // Collection may not exist — that is fine
    }
  }

  // ── Create users collection ──────────────────────────────────────────────────
  // One collection for all roles: superadmin, photographer, customer
  await db.createCollection('users').catch(() => {});
  await db.collection('users').createIndex({ email: 1 }, { unique: true });
  await db.collection('users').createIndex({ role: 1 });
  await db.collection('users').createIndex({ status: 1 });
  console.log('users collection ready');

  // ── Create albums collection ─────────────────────────────────────────────────
  await db.createCollection('albums').catch(() => {});
  await db.collection('albums').createIndex({ photographer_id: 1 });
  await db.collection('albums').createIndex({ shareToken: 1 }, { unique: true });
  await db.collection('albums').createIndex({ viewToken: 1 }, { unique: true });
  await db.collection('albums').createIndex({ 'coupleAccess.email': 1 });
  console.log('albums collection ready');

  // ── Create payments collection ───────────────────────────────────────────────
  await db.createCollection('payments').catch(() => {});
  await db.collection('payments').createIndex({ album_id: 1 });
  await db.collection('payments').createIndex({ customer_id: 1 });
  await db.collection('payments').createIndex({ photographer_id: 1 });
  await db.collection('payments').createIndex({ status: 1 });
  console.log('payments collection ready');

  // ── Keep existing collections that are still used ────────────────────────────
  // albums, album_templates, layout_presets, template_categories
  // These already exist so just ensure indexes
  await db.collection('album_templates').createIndex({ status: 1 }).catch(() => {});
  await db.collection('layout_presets').createIndex({ status: 1 }).catch(() => {});
  console.log('Existing album_templates and layout_presets indexes ensured');

  // ── Seed superadmin ──────────────────────────────────────────────────────────
  const existingAdmin = await db.collection('users').findOne({ role: 'superadmin' });
  if (!existingAdmin) {
    const hashed = await bcrypt.hash('admin123', 10);
    await db.collection('users').insertOne({
      name: 'Super Admin',
      email: 'admin@memoalbum.com',
      password: hashed,
      role: 'superadmin',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLogin: null,
    });
    console.log('Superadmin created — email: admin@memoalbum.com  password: admin123');
    console.log('IMPORTANT: Change the superadmin password after first login!');
  } else {
    console.log('Superadmin already exists, skipping');
  }

  await client.close();
  console.log('All collections ready!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
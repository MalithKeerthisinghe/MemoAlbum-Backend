require('dotenv').config();
const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || 'memoalbum';

const collectionDefinitions = [
	{
		name: 'roles',
		indexes: [
			{ key: { roleName: 1 }, options: { unique: true, name: 'uniq_role_name' } },
		],
	},
	{
		name: 'users',
		indexes: [
			{ key: { email: 1 }, options: { unique: true, name: 'uniq_user_email' } },
			{ key: { roleId: 1 }, options: { name: 'idx_users_role_id' } },
			{ key: { status: 1 }, options: { name: 'idx_users_status' } },
		],
	},
	{
		name: 'admin_invites',
		indexes: [
			{ key: { token: 1 }, options: { unique: true, name: 'uniq_admin_invite_token' } },
			{ key: { adminUserId: 1 }, options: { name: 'idx_admin_invites_admin_user' } },
			{ key: { photographerUserId: 1 }, options: { name: 'idx_admin_invites_photographer_user' } },
			{ key: { status: 1 }, options: { name: 'idx_admin_invites_status' } },
		],
	},
	{
		name: 'couple_invites',
		indexes: [
			{ key: { token: 1 }, options: { unique: true, name: 'uniq_couple_invite_token' } },
			{ key: { photographerUserId: 1 }, options: { name: 'idx_couple_invites_photographer_user' } },
			{ key: { albumId: 1 }, options: { name: 'idx_couple_invites_album' } },
			{ key: { coupleUserId: 1 }, options: { name: 'idx_couple_invites_couple_user' } },
			{ key: { status: 1 }, options: { name: 'idx_couple_invites_status' } },
		],
	},
	{
		name: 'albums',
		indexes: [
			{ key: { photographerUserId: 1 }, options: { name: 'idx_albums_photographer_user' } },
			{ key: { accessType: 1 }, options: { name: 'idx_albums_access_type' } },
			{ key: { createdAt: -1 }, options: { name: 'idx_albums_created_at' } },
		],
	},
	{
		name: 'couple_groups',
		indexes: [
			{ key: { accessToken: 1 }, options: { unique: true, name: 'uniq_couple_group_access_token' } },
			{ key: { albumId: 1 }, options: { name: 'idx_couple_groups_album' } },
			{ key: { paymentStatus: 1 }, options: { name: 'idx_couple_groups_payment_status' } },
			{ key: { accessStatus: 1 }, options: { name: 'idx_couple_groups_access_status' } },
		],
	},
	{
		name: 'payments',
		indexes: [
			{ key: { albumId: 1 }, options: { name: 'idx_payments_album' } },
			{ key: { coupleGroupId: 1 }, options: { name: 'idx_payments_couple_group' } },
			{ key: { status: 1 }, options: { name: 'idx_payments_status' } },
			{ key: { paidAt: -1 }, options: { name: 'idx_payments_paid_at' } },
		],
	},
];

const seedRoles = async (db) => {
	const roles = ['admin', 'photographer', 'couple'];
	const now = new Date();

	for (const roleName of roles) {
		await db.collection('roles').updateOne(
			{ roleName },
			{
				$setOnInsert: {
					roleName,
					createdAt: now,
					updatedAt: now,
				},
			},
			{ upsert: true }
		);
	}
};

const seedDefaultAdmin = async (db) => {
	const adminEmail = process.env.ADMIN_EMAIL;
	const adminPassword = process.env.ADMIN_PASSWORD;
	const adminName = process.env.ADMIN_NAME || 'System Admin';

	if (!adminEmail || !adminPassword) {
		return;
	}

	const adminRole = await db.collection('roles').findOne({ roleName: 'admin' });
	if (!adminRole) {
		throw new Error('Admin role was not created before seeding the admin user');
	}

	const existingAdmin = await db.collection('users').findOne({ email: adminEmail });
	if (existingAdmin) {
		return;
	}

	const hashedPassword = await bcrypt.hash(adminPassword, 10);
	await db.collection('users').insertOne({
		name: adminName,
		email: adminEmail,
		phone: '',
		address: '',
		password: hashedPassword,
		roleId: adminRole._id,
		status: 'active',
		createdAt: new Date(),
		updatedAt: new Date(),
	});
};

const ensureCollection = async (db, definition) => {
	const exists = await db.listCollections({ name: definition.name }).hasNext();

	if (!exists) {
		await db.createCollection(definition.name);
	}

	const collection = db.collection(definition.name);

	for (const { key, options } of definition.indexes) {
		await collection.createIndex(key, options);
	}
};

const main = async () => {
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

		for (const definition of collectionDefinitions) {
			await ensureCollection(db, definition);
		}

		await seedRoles(db);
		await seedDefaultAdmin(db);

		const summary = collectionDefinitions.map(({ name }) => name).join(', ');
		console.log(`Collections ready in ${MONGODB_DB}: ${summary}`);
	} finally {
		await client.close();
	}
};

main().catch((error) => {
	console.error('Failed to create collections:', error.message);
	process.exit(1);
});

 
/**
 * migrate-users.js
 * Run ONCE to add username & password columns to the User table.
 * Usage: node migrate-users.js
 */

require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const DEFAULT_PASSWORD = 'Parage2025!';

async function run() {
  const client = await pool.connect();
  try {
    console.log('🔧 Running user migration…\n');

    // 1. Add columns with a temporary default so existing rows are accepted
    await client.query(`
      ALTER TABLE "User"
        ADD COLUMN IF NOT EXISTS "username" TEXT DEFAULT '',
        ADD COLUMN IF NOT EXISTS "password" TEXT DEFAULT ''
    `);
    console.log('✅ Columns added (username, password)');

    // 2. Hash the default password once
    const hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

    // 3. Update every existing row: set username = role value, password = hash
    const { rows } = await client.query('SELECT id, role FROM "User"');
    console.log(`   Updating ${rows.length} existing user(s)…`);

    for (const row of rows) {
      await client.query(
        'UPDATE "User" SET username = $1, password = $2 WHERE id = $3',
        [row.role, hash, row.id]
      );
      console.log(`   → user id=${row.id}  username="${row.role}"`);
    }

    // 4. Now make the columns NOT NULL
    await client.query(`
      ALTER TABLE "User"
        ALTER COLUMN "username" SET NOT NULL,
        ALTER COLUMN "password" SET NOT NULL
    `);
    console.log('✅ Columns set to NOT NULL');

    // 5. Add unique constraint on username (safe if already exists)
    try {
      await client.query(`
        ALTER TABLE "User" ADD CONSTRAINT "User_username_key" UNIQUE ("username")
      `);
      console.log('✅ UNIQUE constraint on username added');
    } catch (e) {
      if (e.code === '42P07') {
        console.log('ℹ️  UNIQUE constraint already exists, skipping');
      } else throw e;
    }

    console.log(`\n🎉 Migration complete!`);
    console.log(`   Default password for all users: "${DEFAULT_PASSWORD}"`);
    console.log(`   Usernames: admin | chef | pesee | reception | pointage | direction`);
  } catch (err) {
    console.error('❌ Migration error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();

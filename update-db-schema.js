require('dotenv').config();
const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    await client.query('ALTER TABLE "Heures" DROP CONSTRAINT IF EXISTS "Heures_num_groupe_fkey";');
    await client.query('ALTER TABLE "Operatrice" ALTER COLUMN "num" TYPE TEXT USING "num"::text;');
    await client.query('ALTER TABLE "Heures" ALTER COLUMN "num" TYPE TEXT USING "num"::text;');
    console.log('Updated Operatrice.num and Heures.num to TEXT');
  } catch (error) {
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();

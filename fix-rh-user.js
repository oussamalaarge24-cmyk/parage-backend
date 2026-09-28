const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function fixRhUser() {
  try {
    const hashed = await bcrypt.hash('Parage2025!', 10);
    
    const user = await prisma.user.upsert({
      where: { username: 'rh' },
      update: {
        password: hashed,
        role: 'rh',
        nom: 'Agent RH'
      },
      create: {
        nom: 'Agent RH',
        username: 'rh',
        password: hashed,
        role: 'rh'
      }
    });

    console.log('✅ RH User successfully created/updated!', user);
  } catch (err) {
    console.error('❌ Error fixing RH user:', err);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

fixRhUser();

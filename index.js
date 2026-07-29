const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

//const { PrismaClient } = require('./generated/prisma');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:5500',
    'https://parage-frontend.vercel.app'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

// Handle preflight (OPTIONS) requests for all routes
app.options('/{*path}', cors(corsOptions));
app.use(cors(corsOptions));
app.use(express.json());


// Serve the frontend folder as static files
//app.use(express.static(path.join(__dirname, '../frontend')));

// ── Database ───────────────────────────────────────────────────
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('Error: DATABASE_URL environment variable is missing!');
  process.exit(1);
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ── Table → Model mapping ──────────────────────────────────────
const tableToModel = {
  operatrice : 'operatrice',
  lot        : 'lot',
  production : 'production',
  poidscuit  : 'poidsCuit',
  dechets    : 'dechets',
  heures     : 'heures',
  moyenfrais : 'moyenFrais',
  users      : 'user'
};

// ── Seed data ──────────────────────────────────────────────────
const DEFAULT_PASSWORD = 'Parage2025!';

const usersSeed = [
  { nom: 'Admin Système',              username: 'admin',    role: 'admin'     },
  { nom: 'Fatima (Chef Production)',   username: 'chef',     role: 'chef'      },
  { nom: 'Karim (Agent Pesée)',        username: 'pesee',    role: 'pesee'     },
  { nom: 'Naima (Agent Réception)',    username: 'reception',role: 'reception' },
  { nom: 'Said (Agent Pointage)',      username: 'pointage', role: 'pointage'  },
  { nom: 'Directeur Général',          username: 'direction',role: 'direction' }
];

const operatricesSeed = [
  "ELHAMZY LATIFA","HAMOUGA FATNA","EL GHOJDAMI KHADIJA","EL ALOUA FATNA","EL HAJJI ZEHRA",
  "ELAMMARI MALIKA","EL HIYANI","DGHICHI MOULOUDA","AAMRANI SANA","EL BAYAD FETTOUMA",
  "OUATTAB FOUZIA","OUECHEN MALIKA","BENHAMOU RABIAA","LOTFI KHADIJA","HEDDAR FATIMA"
].map((nom, i) => ({
  nomPrenom : nom,
  matricule : 'MAT-' + String(1000 + i + 1),
  num       : i + 1,
  groupe    : (i % 3 === 0) ? 2 : 1
}));

const lotsSeed = [
  { certificat: 'TMIS 237 128 B04', espece: 'T-1',  taille: '2-3' },
  { certificat: 'TMIS 237 003 B16', espece: 'T-3',  taille: '2-3' },
  { certificat: 'TMIS 231 179 B16', espece: 'RT-1', taille: '2-3' }
];

async function seedIfEmpty() {
  try {
    const userCount = await prisma.user.count();
    if (userCount > 0) {
      // Make sure existing users without username are updated
      await migrateUsersIfNeeded();
      console.log('Database already has data. Skipping full seed.');
      return;
    }

    console.log('Seeding database…');
    const hashed = await bcrypt.hash(DEFAULT_PASSWORD, 10);

    for (const u of usersSeed) {
      await prisma.user.create({ data: { ...u, password: hashed } });
    }
    for (const o of operatricesSeed) {
      await prisma.operatrice.create({ data: o });
    }
    for (const l of lotsSeed) {
      await prisma.lot.create({ data: l });
    }
    console.log(`Seeding done! Default password for all users: "${DEFAULT_PASSWORD}"`);
  } catch (err) {
    console.error('Seed error:', err.message);
  }
}

// Handle case where old users exist without username / password
async function migrateUsersIfNeeded() {
  try {
    const hashed = await bcrypt.hash(DEFAULT_PASSWORD, 10);
    const usernameMap = {
      admin: 'admin', chef: 'chef', pesee: 'pesee',
      reception: 'reception', pointage: 'pointage', direction: 'direction'
    };
    const allUsers = await prisma.user.findMany();
    for (const u of allUsers) {
      const needsUpdate = !u.username || !u.password;
      if (needsUpdate) {
        const username = usernameMap[u.role] || u.role;
        await prisma.user.update({
          where: { id: u.id },
          data: { username, password: hashed }
        });
        console.log(`Migrated user: ${u.nom} → username="${username}"`);
      }
    }
  } catch (err) {
    // Silently ignore if columns don't exist yet (before migration)
    console.log('Migration check skipped:', err.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// AUTH ROUTES
// ═══════════════════════════════════════════════════════════════

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { username } });

    if (!user) {
      return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect.' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect.' });
    }

    // Generate JWT token (required by frontend's getAuthHeaders)
    const token = jwt.sign(
      { id: user.id, nom: user.nom, role: user.role, username: user.username },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: process.env.JWT_EXPIRE || '24h' }
    );

    // Return user info without password, with token
    const { password: _pw, ...safeUser } = user;
    res.json({ success: true, token, user: safeUser });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/auth/me  – just verify session (optional)
app.get('/api/auth/me', (req, res) => {
  res.json({ ok: true });
});

// POST /api/auth/change-password  (admin or self)
app.post('/api/auth/change-password', async (req, res) => {
  const { userId, newPassword } = req.body;
  if (!userId || !newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'userId and newPassword (min 6 chars) are required.' });
  }
  try {
    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: parseInt(userId) }, data: { password: hashed } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// DATA ROUTES
// ═══════════════════════════════════════════════════════════════

// Bulk Pointage
app.post('/api/heures/bulk', async (req, res) => {
  const { dateProduction, groupe, records } = req.body;
  if (!dateProduction || groupe === undefined || !records) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }
  try {
    const groupeInt = parseInt(groupe);

    // Step 1: delete existing records for this date+group
    await prisma.heures.deleteMany({
      where: { dateProduction, groupe: groupeInt }
    });

    // Step 2: clean and insert new records
    const cleanRecords = records.map(rec => {
      const { id, Operatrice, createdAt, ...clean } = rec;
      return {
        ...clean,
        groupe: groupeInt,
        num:    String(clean.num ?? ''),
        heures: parseFloat(clean.heures) || 0,
        entree1: clean.entree1 || null,
        sortie1: clean.sortie1 || null,
        entree2: clean.entree2 || null,
        sortie2: clean.sortie2 || null,
        entree3: clean.entree3 || null,
        sortie3: clean.sortie3 || null,
      };
    });

    // createMany is supported with driver adapters (no interactive tx needed)
    await prisma.heures.createMany({ data: cleanRecords });

    // Return the inserted rows so the frontend can update its cache
    const created = await prisma.heures.findMany({
      where: { dateProduction, groupe: groupeInt }
    });
    res.json(created);
  } catch (err) {
    console.error('Bulk pointage error:', err);
    res.status(500).json({ error: err.message, code: err.code, meta: err.meta });
  }
});

// Single Operatrice Pointage — save/update only ONE row by num+groupe+date
app.post('/api/heures/single', async (req, res) => {
  const { dateProduction, groupe, record } = req.body;
  if (!dateProduction || groupe === undefined || !record) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }
  try {
    const groupeInt = parseInt(groupe);
    const num = String(record.num ?? '');

    // Delete only this operatrice's existing entry for that day
    await prisma.heures.deleteMany({
      where: { dateProduction, groupe: groupeInt, num }
    });

    // Clean and insert the single record
    const { id, Operatrice, createdAt, ...clean } = record;
    const data = {
      ...clean,
      groupe: groupeInt,
      num,
      heures: parseFloat(clean.heures) || 0,
      entree1: clean.entree1 || null,
      sortie1: clean.sortie1 || null,
      entree2: clean.entree2 || null,
      sortie2: clean.sortie2 || null,
      entree3: clean.entree3 || null,
      sortie3: clean.sortie3 || null,
    };

    const created = await prisma.heures.create({ data });
    res.json(created);
  } catch (err) {
    console.error('Single pointage error:', err);
    res.status(500).json({ error: err.message, code: err.code, meta: err.meta });
  }
});

// GET /api/:table
app.get('/api/:table', async (req, res) => {
  const model = tableToModel[req.params.table];
  if (!model) return res.status(404).json({ error: 'Table not found.' });
  try {
    // Never return passwords in user list
    const data = await prisma[model].findMany();
    if (req.params.table === 'users') {
      res.json(data.map(({ password: _pw, ...u }) => u));
    } else {
      res.json(data);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/:table
app.post('/api/:table', async (req, res) => {
  const model = tableToModel[req.params.table];
  if (!model) return res.status(404).json({ error: 'Table not found.' });
  try {
    // Hash password when creating user with password field
    let body = req.body;
    if (req.params.table === 'users' && body.password) {
      body = { ...body, password: await bcrypt.hash(body.password, 10) };
    } else if (req.params.table === 'users' && !body.password) {
      body = { ...body, password: await bcrypt.hash(DEFAULT_PASSWORD, 10) };
    }
    const data = await prisma[model].create({ data: body });
    const { password: _pw, ...safe } = data;
    res.json(req.params.table === 'users' ? safe : data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/:table/:id
app.put('/api/:table/:id', async (req, res) => {
  const model = tableToModel[req.params.table];
  if (!model) return res.status(404).json({ error: 'Table not found.' });
  try {
    let body = req.body;
    if (req.params.table === 'users' && body.password) {
      body = { ...body, password: await bcrypt.hash(body.password, 10) };
    }
    const data = await prisma[model].update({ where: { id: parseInt(req.params.id) }, data: body });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/:table/:id
app.delete('/api/:table/:id', async (req, res) => {
  const model = tableToModel[req.params.table];
  if (!model) return res.status(404).json({ error: 'Table not found.' });
  const id = parseInt(req.params.id);
  try {
    // For operatrice: cascade-delete related Production and Heures first
    if (req.params.table === 'operatrice') {
      await prisma.$transaction(async (tx) => {
        await tx.production.deleteMany({ where: { idOperatrice: id } });
        const op = await tx.operatrice.findUnique({ where: { id } });
        if (op) {
          await tx.heures.deleteMany({ where: { num: op.num, groupe: op.groupe } });
        }
        await tx.operatrice.delete({ where: { id } });
      });
    } else {
      await prisma[model].delete({ where: { id } });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Catch-all: serve frontend index.html for unknown routes
//app.get('/{*path}', (req, res) => {
  //res.sendFile(path.join(__dirname, '../frontend/index.html'));
//});
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Parage Backend API is running'
  });
});

// ── Start ──────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`\n🚀  Server running at  http://localhost:${PORT}`);
  console.log(`    Open your browser at http://localhost:${PORT}\n`);
  await seedIfEmpty();
});

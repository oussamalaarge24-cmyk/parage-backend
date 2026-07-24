const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');
const bcrypt = require('bcryptjs');

let db;

async function initDB() {
  db = await open({
    filename: path.join(__dirname, 'kph.db'),
    driver: sqlite3.Database
  });

  // Enable foreign keys
  await db.exec('PRAGMA foreign_keys = ON;');

  // Create tables if they don't exist
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL,
      role TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS operatrice (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nomPrenom TEXT NOT NULL,
      matricule TEXT,
      num TEXT UNIQUE,
      groupe INTEGER,
      services TEXT,
      idOperatrice INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS lot (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      certificat TEXT NOT NULL,
      espece TEXT,
      taille TEXT,
      idLot INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS production (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dateSaisie TEXT,
      dateProduction TEXT,
      heure TEXT,
      idOperatrice INTEGER,
      idLot INTEGER,
      poidsFilet REAL,
      nombreCaisse INTEGER,
      groupe INTEGER,
      idProduction INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS poidscuit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dateProduction TEXT,
      heure TEXT,
      groupe INTEGER,
      certificat TEXT,
      espece TEXT,
      taille TEXT,
      numeroChariot INTEGER,
      poidsGrille REAL,
      idPoidsCuit INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS dechets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dateProduction TEXT,
      heure TEXT,
      groupe INTEGER,
      numeroBag INTEGER,
      poidsTare REAL,
      poidsNet REAL,
      idDechets INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS heures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dateSaisie TEXT,
      dateProduction TEXT,
      groupe INTEGER,
      num TEXT,
      nomPrenom TEXT,
      entree1 TEXT,
      sortie1 TEXT,
      entree2 TEXT,
      sortie2 TEXT,
      entree3 TEXT,
      sortie3 TEXT,
      heures REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS moyenfrais (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      groupe INTEGER,
      dateProduction TEXT,
      moyenFrais REAL,
      totalFrais REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const operatriceInfo = await db.all('PRAGMA table_info(operatrice)');
  const operatriceNumColumn = operatriceInfo.find(col => col.name === 'num');
  const operatriceServicesColumn = operatriceInfo.find(col => col.name === 'services');
  if (operatriceNumColumn && /integer/i.test(operatriceNumColumn.type)) {
    await db.exec('ALTER TABLE operatrice RENAME TO operatrice_old');
    await db.exec(`
      CREATE TABLE operatrice (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nomPrenom TEXT NOT NULL,
        matricule TEXT,
        num TEXT UNIQUE,
        groupe INTEGER,
        services TEXT,
        idOperatrice INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await db.exec(`
      INSERT INTO operatrice (id, nomPrenom, matricule, num, groupe, services, idOperatrice, created_at)
      SELECT id, nomPrenom, matricule, CAST(num AS TEXT), groupe, NULL, idOperatrice, created_at
      FROM operatrice_old;
    `);
    await db.exec('DROP TABLE operatrice_old');
  }

  if (!operatriceServicesColumn) {
    await db.exec('ALTER TABLE operatrice ADD COLUMN services TEXT');
  }

  const heuresInfo = await db.all('PRAGMA table_info(heures)');
  const heuresNumColumn = heuresInfo.find(col => col.name === 'num');
  if (heuresNumColumn && /integer/i.test(heuresNumColumn.type)) {
    await db.exec('ALTER TABLE heures RENAME TO heures_old');
    await db.exec(`
      CREATE TABLE heures (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dateSaisie TEXT,
        dateProduction TEXT,
        groupe INTEGER,
        num TEXT,
        nomPrenom TEXT,
        entree1 TEXT,
        sortie1 TEXT,
        entree2 TEXT,
        sortie2 TEXT,
        entree3 TEXT,
        sortie3 TEXT,
        heures REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await db.exec(`
      INSERT INTO heures (id, dateSaisie, dateProduction, groupe, num, nomPrenom, entree1, sortie1, entree2, sortie2, entree3, sortie3, heures, created_at)
      SELECT id, dateSaisie, dateProduction, groupe, CAST(num AS TEXT), nomPrenom, entree1, sortie1, entree2, sortie2, entree3, sortie3, heures, created_at
      FROM heures_old;
    `);
    await db.exec('DROP TABLE heures_old');
  }

  // Create indexes for better performance
  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_production_date ON production(dateProduction);
    CREATE INDEX IF NOT EXISTS idx_production_groupe ON production(groupe);
    CREATE INDEX IF NOT EXISTS idx_poidscuit_date ON poidscuit(dateProduction);
    CREATE INDEX IF NOT EXISTS idx_dechets_date ON dechets(dateProduction);
    CREATE INDEX IF NOT EXISTS idx_heures_date ON heures(dateProduction);
    CREATE INDEX IF NOT EXISTS idx_moyenfrais_date ON moyenfrais(dateProduction);
  `);

  // Create default admin user if none exists
  const adminExists = await db.get('SELECT * FROM users WHERE role = "admin"');
  if (!adminExists) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await db.run(
      'INSERT INTO users (nom, role, password_hash) VALUES (?, ?, ?)',
      ['Administrator', 'admin', hashedPassword]
    );
    console.log('✅ Default admin user created: admin / admin123');
  }

  // Create default test users
  const testUsers = [
    { nom: 'Chef Production', role: 'chef', password: 'chef123' },
    { nom: 'Agent Pesée', role: 'pesee', password: 'pesee123' },
    { nom: 'Agent Réception', role: 'reception', password: 'reception123' },
    { nom: 'Agent Pointage', role: 'pointage', password: 'pointage123' },
    { nom: 'Directeur', role: 'direction', password: 'direction123' }
  ];

  for (const user of testUsers) {
    const exists = await db.get('SELECT * FROM users WHERE nom = ?', user.nom);
    if (!exists) {
      const hashedPassword = await bcrypt.hash(user.password, 10);
      await db.run(
        'INSERT INTO users (nom, role, password_hash) VALUES (?, ?, ?)',
        [user.nom, user.role, hashedPassword]
      );
      console.log(`✅ Test user created: ${user.nom} / ${user.password}`);
    }
  }

  // Count existing records
  const stats = {};
  const tables = ['users', 'operatrice', 'lot', 'production', 'poidscuit', 'dechets', 'heures', 'moyenfrais'];
  for (const table of tables) {
    const result = await db.get(`SELECT COUNT(*) as count FROM ${table}`);
    stats[table] = result.count;
  }
  console.log('📊 Database stats:', stats);

  return db;
}

function getDB() {
  if (!db) {
    throw new Error('Database not initialized. Call initDB() first.');
  }
  return db;
}

module.exports = { initDB, getDB };
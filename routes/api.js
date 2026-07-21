const express = require('express');
const { getDB } = require('../database/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Middleware to verify token for all API routes
router.use(authenticateToken);

// Generic CRUD endpoints for all tables
const tables = ['operatrice', 'lot', 'production', 'poidscuit', 'dechets', 'heures', 'moyenfrais'];

tables.forEach(table => {
  // GET all records
  router.get(`/${table}`, async (req, res) => {
    try {
      const db = getDB();
      const rows = await db.all(`SELECT * FROM ${table} ORDER BY id DESC`);
      res.json(rows);
    } catch (error) {
      console.error(`Error fetching ${table}:`, error);
      res.status(500).json({ error: `Failed to fetch ${table}` });
    }
  });

  // GET single record
  router.get(`/${table}/:id`, async (req, res) => {
    try {
      const db = getDB();
      const row = await db.get(`SELECT * FROM ${table} WHERE id = ?`, [req.params.id]);
      if (!row) {
        return res.status(404).json({ error: 'Record not found' });
      }
      res.json(row);
    } catch (error) {
      console.error(`Error fetching ${table}:`, error);
      res.status(500).json({ error: `Failed to fetch ${table}` });
    }
  });

  // POST new record
  router.post(`/${table}`, async (req, res) => {
    try {
      const db = getDB();
      const fields = Object.keys(req.body);
      const placeholders = fields.map(() => '?').join(',');
      const values = fields.map(f => req.body[f]);
      
      const result = await db.run(
        `INSERT INTO ${table} (${fields.join(',')}) VALUES (${placeholders})`,
        values
      );
      
      const newRecord = await db.get(`SELECT * FROM ${table} WHERE id = ?`, [result.lastID]);
      res.status(201).json(newRecord);
    } catch (error) {
      console.error(`Error inserting into ${table}:`, error);
      res.status(500).json({ error: `Failed to insert into ${table}` });
    }
  });

  // PUT update record
  router.put(`/${table}/:id`, async (req, res) => {
    try {
      const db = getDB();
      const fields = Object.keys(req.body);
      const setClause = fields.map(f => `${f} = ?`).join(',');
      const values = [...fields.map(f => req.body[f]), req.params.id];
      
      await db.run(
        `UPDATE ${table} SET ${setClause} WHERE id = ?`,
        values
      );
      
      const updated = await db.get(`SELECT * FROM ${table} WHERE id = ?`, [req.params.id]);
      res.json(updated);
    } catch (error) {
      console.error(`Error updating ${table}:`, error);
      res.status(500).json({ error: `Failed to update ${table}` });
    }
  });

  // DELETE record
  router.delete(`/${table}/:id`, async (req, res) => {
    try {
      const db = getDB();
      await db.run(`DELETE FROM ${table} WHERE id = ?`, [req.params.id]);
      res.json({ message: 'Record deleted successfully' });
    } catch (error) {
      console.error(`Error deleting from ${table}:`, error);
      res.status(500).json({ error: `Failed to delete from ${table}` });
    }
  });
});

// Special endpoint for bulk hours
router.post('/heures/bulk', async (req, res) => {
  try {
    const { dateProduction, groupe, records } = req.body;
    const db = getDB();

    // Delete existing records for this group/date
    await db.run(
      'DELETE FROM heures WHERE dateProduction = ? AND groupe = ?',
      [dateProduction, groupe]
    );

    // Insert new records
    for (const record of records) {
      const { 
        dateSaisie, dateProduction, groupe, num, nomPrenom,
        entree1, sortie1, entree2, sortie2, entree3, sortie3, heures
      } = record;

      await db.run(`
        INSERT INTO heures (
          dateSaisie, dateProduction, groupe, num, nomPrenom,
          entree1, sortie1, entree2, sortie2, entree3, sortie3, heures
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        dateSaisie, dateProduction, groupe, num, nomPrenom,
        entree1, sortie1, entree2, sortie2, entree3, sortie3, heures
      ]);
    }

    res.json({ message: 'Bulk hours saved successfully', count: records.length });
  } catch (error) {
    console.error('Error saving bulk hours:', error);
    res.status(500).json({ error: 'Failed to save bulk hours' });
  }
});

module.exports = router;
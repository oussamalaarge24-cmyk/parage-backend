require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.query(`
  SELECT p.id, p.groupe as p_groupe, o.groupe as o_groupe, o."nomPrenom", o.num
  FROM "Production" p 
  JOIN "Operatrice" o ON p."idOperatrice" = o.id 
  WHERE p.groupe != o.groupe
`, (err, res) => {
  if (err) console.error(err);
  else {
    console.log(`Found mismatches: ${res.rows.length}`);
    if (res.rows.length > 0) {
      console.log(res.rows.slice(0, 10));
    }
  }
  pool.end();
});

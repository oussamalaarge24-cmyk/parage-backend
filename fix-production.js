require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });


async function fix() {
  console.log('Vérification des enregistrements de production...');
  const productions = await prisma.production.findMany({
    include: { Operatrice: true }
  });

  let fixed = 0;
  for (const prod of productions) {
    // Si le groupe de la production ne correspond pas au groupe de l'opératrice associée
    if (prod.groupe !== prod.Operatrice.groupe) {
      console.log(`Incohérence trouvée ! Production ID ${prod.id} (Groupe ${prod.groupe}) assignée à ${prod.Operatrice.nomPrenom} (Groupe ${prod.Operatrice.groupe})`);
      
      // Cherche l'opératrice correcte avec le même numéro de jeton, mais dans le bon groupe
      const correctOp = await prisma.operatrice.findFirst({
        where: {
          num: prod.Operatrice.num,
          groupe: prod.groupe
        }
      });

      if (correctOp) {
        await prisma.production.update({
          where: { id: prod.id },
          data: { idOperatrice: correctOp.id }
        });
        console.log(`  -> Corrigé : Réassigné à l'opératrice ID ${correctOp.id} (${correctOp.nomPrenom})`);
        fixed++;
      } else {
        console.log(`  -> Impossible de trouver le jeton ${prod.Operatrice.num} dans le Groupe ${prod.groupe}. Mise à jour du groupe de la production vers ${prod.Operatrice.groupe}.`);
        await prisma.production.update({
          where: { id: prod.id },
          data: { groupe: prod.Operatrice.groupe }
        });
        fixed++;
      }
    }
  }
  console.log(`\nTerminé. ${fixed} enregistrements corrigés.`);
  await prisma.$disconnect();
}

fix().catch(e => {
  console.error(e);
  prisma.$disconnect();
});

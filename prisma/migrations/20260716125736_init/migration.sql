-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'chef', 'pesee', 'reception', 'pointage', 'direction');

-- CreateTable
CREATE TABLE "Lot" (
    "id" SERIAL NOT NULL,
    "certificat" TEXT NOT NULL,
    "espece" TEXT,
    "taille" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PoidsCuit" (
    "id" SERIAL NOT NULL,
    "dateProduction" TEXT NOT NULL,
    "heure" TEXT,
    "groupe" INTEGER NOT NULL,
    "idLot" INTEGER,
    "certificat" TEXT,
    "espece" TEXT,
    "taille" TEXT,
    "numeroChariot" INTEGER,
    "poidsGrille" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PoidsCuit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dechets" (
    "id" SERIAL NOT NULL,
    "dateProduction" TEXT NOT NULL,
    "heure" TEXT,
    "groupe" INTEGER NOT NULL,
    "numeroBag" INTEGER,
    "poidsTare" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "poidsNet" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Dechets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Operatrice" (
    "id" SERIAL NOT NULL,
    "nomPrenom" TEXT NOT NULL,
    "matricule" TEXT,
    "num" INTEGER NOT NULL,
    "groupe" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Operatrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Production" (
    "id" SERIAL NOT NULL,
    "dateSaisie" TEXT NOT NULL,
    "dateProduction" TEXT NOT NULL,
    "heure" TEXT,
    "idOperatrice" INTEGER NOT NULL,
    "idLot" INTEGER,
    "poidsFilet" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "nombreCaisse" INTEGER NOT NULL DEFAULT 0,
    "groupe" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Production_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Heures" (
    "id" SERIAL NOT NULL,
    "dateSaisie" TEXT NOT NULL,
    "dateProduction" TEXT NOT NULL,
    "groupe" INTEGER NOT NULL,
    "num" INTEGER NOT NULL,
    "nomPrenom" TEXT,
    "entree1" TEXT,
    "sortie1" TEXT,
    "entree2" TEXT,
    "sortie2" TEXT,
    "entree3" TEXT,
    "sortie3" TEXT,
    "heures" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Heures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MoyenFrais" (
    "id" SERIAL NOT NULL,
    "groupe" INTEGER NOT NULL,
    "dateProduction" TEXT NOT NULL,
    "moyenFrais" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalFrais" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MoyenFrais_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Operatrice_num_key" ON "Operatrice"("num");

-- AddForeignKey
ALTER TABLE "PoidsCuit" ADD CONSTRAINT "PoidsCuit_idLot_fkey" FOREIGN KEY ("idLot") REFERENCES "Lot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Production" ADD CONSTRAINT "Production_idOperatrice_fkey" FOREIGN KEY ("idOperatrice") REFERENCES "Operatrice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Production" ADD CONSTRAINT "Production_idLot_fkey" FOREIGN KEY ("idLot") REFERENCES "Lot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Heures" ADD CONSTRAINT "Heures_num_fkey" FOREIGN KEY ("num") REFERENCES "Operatrice"("num") ON DELETE RESTRICT ON UPDATE CASCADE;

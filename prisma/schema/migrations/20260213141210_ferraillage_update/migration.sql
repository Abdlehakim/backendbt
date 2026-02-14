/*
  Warnings:

  - You are about to drop the `FerDiametre` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `FerEtatChantier` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `FerMouvement` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `FerMouvementLigne` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `FerRestantLigne` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `FerRestantNonConfectionne` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `FerRestantSnapshot` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Module` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SubModule` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Subscription` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SubscriptionModule` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SubscriptionSubModule` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `FerMouvement` DROP FOREIGN KEY `FerMouvement_etatId_fkey`;

-- DropForeignKey
ALTER TABLE `FerMouvementLigne` DROP FOREIGN KEY `FerMouvementLigne_diametreId_fkey`;

-- DropForeignKey
ALTER TABLE `FerMouvementLigne` DROP FOREIGN KEY `FerMouvementLigne_mouvementId_fkey`;

-- DropForeignKey
ALTER TABLE `FerRestantLigne` DROP FOREIGN KEY `FerRestantLigne_diametreId_fkey`;

-- DropForeignKey
ALTER TABLE `FerRestantLigne` DROP FOREIGN KEY `FerRestantLigne_snapshotId_fkey`;

-- DropForeignKey
ALTER TABLE `FerRestantSnapshot` DROP FOREIGN KEY `FerRestantSnapshot_rapportId_fkey`;

-- DropForeignKey
ALTER TABLE `SubModule` DROP FOREIGN KEY `SubModule_moduleId_fkey`;

-- DropForeignKey
ALTER TABLE `SubscriptionModule` DROP FOREIGN KEY `SubscriptionModule_moduleId_fkey`;

-- DropForeignKey
ALTER TABLE `SubscriptionModule` DROP FOREIGN KEY `SubscriptionModule_subscriptionId_fkey`;

-- DropForeignKey
ALTER TABLE `SubscriptionSubModule` DROP FOREIGN KEY `SubscriptionSubModule_subModuleId_fkey`;

-- DropForeignKey
ALTER TABLE `SubscriptionSubModule` DROP FOREIGN KEY `SubscriptionSubModule_subscriptionId_fkey`;

-- DropForeignKey
ALTER TABLE `User` DROP FOREIGN KEY `User_subscriptionId_fkey`;

-- DropTable
DROP TABLE `FerDiametre`;

-- DropTable
DROP TABLE `FerEtatChantier`;

-- DropTable
DROP TABLE `FerMouvement`;

-- DropTable
DROP TABLE `FerMouvementLigne`;

-- DropTable
DROP TABLE `FerRestantLigne`;

-- DropTable
DROP TABLE `FerRestantNonConfectionne`;

-- DropTable
DROP TABLE `FerRestantSnapshot`;

-- DropTable
DROP TABLE `Module`;

-- DropTable
DROP TABLE `SubModule`;

-- DropTable
DROP TABLE `Subscription`;

-- DropTable
DROP TABLE `SubscriptionModule`;

-- DropTable
DROP TABLE `SubscriptionSubModule`;

-- DropTable
DROP TABLE `User`;

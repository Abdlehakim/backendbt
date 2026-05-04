UPDATE `FerRapport`
SET `sousTraitant` = ''
WHERE `sousTraitant` IS NULL;

ALTER TABLE `FerRapport`
  MODIFY `sousTraitant` VARCHAR(191) NOT NULL DEFAULT '',
  ADD COLUMN `acierType` ENUM('F400', 'F500') NULL AFTER `sousTraitant`,
  ADD COLUMN `note` VARCHAR(191) NULL AFTER `acierType`;

ALTER TABLE `FerRapport`
  ADD UNIQUE INDEX `FerRapport_chantierName_sousTraitant_key`(`chantierName`, `sousTraitant`);

CREATE TABLE `FerNiveau` (
  `id` VARCHAR(191) NOT NULL,
  `rapportId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `note` VARCHAR(191) NULL,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `FerNiveau_rapportId_idx`(`rapportId`),
  UNIQUE INDEX `FerNiveau_rapportId_sortOrder_key`(`rapportId`, `sortOrder`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `FerNiveauSousTraitant` (
  `id` VARCHAR(191) NOT NULL,
  `niveauId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,

  INDEX `FerNiveauSousTraitant_niveauId_idx`(`niveauId`),
  UNIQUE INDEX `FerNiveauSousTraitant_niveauId_sortOrder_key`(`niveauId`, `sortOrder`),
  UNIQUE INDEX `FerNiveauSousTraitant_niveauId_name_key`(`niveauId`, `name`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `FerNiveauDiametre` (
  `id` VARCHAR(191) NOT NULL,
  `niveauId` VARCHAR(191) NOT NULL,
  `diametreId` VARCHAR(191) NOT NULL,

  INDEX `FerNiveauDiametre_niveauId_idx`(`niveauId`),
  INDEX `FerNiveauDiametre_diametreId_idx`(`diametreId`),
  UNIQUE INDEX `FerNiveauDiametre_niveauId_diametreId_key`(`niveauId`, `diametreId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `FerNiveau`
  ADD CONSTRAINT `FerNiveau_rapportId_fkey`
  FOREIGN KEY (`rapportId`) REFERENCES `FerRapport`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `FerNiveauSousTraitant`
  ADD CONSTRAINT `FerNiveauSousTraitant_niveauId_fkey`
  FOREIGN KEY (`niveauId`) REFERENCES `FerNiveau`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `FerNiveauDiametre`
  ADD CONSTRAINT `FerNiveauDiametre_niveauId_fkey`
  FOREIGN KEY (`niveauId`) REFERENCES `FerNiveau`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `FerNiveauDiametre_diametreId_fkey`
  FOREIGN KEY (`diametreId`) REFERENCES `FerDiametre`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

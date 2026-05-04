CREATE TABLE `FerLigne` (
  `id` VARCHAR(191) NOT NULL,
  `rapportId` VARCHAR(191) NOT NULL,
  `niveauId` VARCHAR(191) NULL,
  `designation` VARCHAR(191) NOT NULL,
  `nomenclature` VARCHAR(191) NULL,
  `nb` DOUBLE NULL,
  `hauteur` DOUBLE NULL,
  `forme` VARCHAR(191) NULL,
  `diametreMm` INTEGER NULL,
  `payloadJson` LONGTEXT NOT NULL,
  `qtyByMmJson` LONGTEXT NOT NULL,
  `poidsByMmJson` LONGTEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `FerLigne_rapportId_idx`(`rapportId`),
  INDEX `FerLigne_niveauId_idx`(`niveauId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `FerLigne`
  ADD CONSTRAINT `FerLigne_rapportId_fkey`
  FOREIGN KEY (`rapportId`) REFERENCES `FerRapport`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `FerLigne_niveauId_fkey`
  FOREIGN KEY (`niveauId`) REFERENCES `FerNiveau`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `FerRapport`
  DROP INDEX `FerRapport_chantierName_sousTraitant_key`,
  CHANGE COLUMN `sousTraitant` `responsable` VARCHAR(191) NOT NULL DEFAULT '';

ALTER TABLE `FerRapport`
  ADD UNIQUE INDEX `FerRapport_chantierName_responsable_key`(`chantierName`, `responsable`);

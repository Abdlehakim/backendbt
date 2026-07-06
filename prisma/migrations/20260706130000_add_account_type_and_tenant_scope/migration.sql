ALTER TABLE `User`
  ADD COLUMN `name` VARCHAR(191) NULL,
  ADD COLUMN `phone` VARCHAR(191) NULL,
  ADD COLUMN `role` ENUM('OWNER', 'MEMBER') NOT NULL DEFAULT 'OWNER';

ALTER TABLE `Subscription`
  ADD COLUMN `accountName` VARCHAR(191) NULL;

ALTER TABLE `FerRapport`
  ADD COLUMN `subscriptionId` VARCHAR(191) NULL,
  DROP INDEX `FerRapport_chantierName_responsable_key`,
  ADD INDEX `FerRapport_subscriptionId_idx`(`subscriptionId`),
  ADD UNIQUE INDEX `FerRapport_subscriptionId_chantierName_responsable_key`(`subscriptionId`, `chantierName`, `responsable`);

ALTER TABLE `FerRapport`
  ADD CONSTRAINT `FerRapport_subscriptionId_fkey`
  FOREIGN KEY (`subscriptionId`) REFERENCES `Subscription`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

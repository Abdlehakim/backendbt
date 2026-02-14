-- CreateTable
CREATE TABLE `FerDiametre` (
    `id` VARCHAR(191) NOT NULL,
    `mm` INTEGER NOT NULL,
    `label` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `FerDiametre_mm_key`(`mm`),
    INDEX `FerDiametre_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FerEtatChantier` (
    `id` VARCHAR(191) NOT NULL,
    `chantierName` VARCHAR(191) NOT NULL,
    `sousTraitant` VARCHAR(191) NULL,
    `etatDate` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `FerEtatChantier_chantierName_idx`(`chantierName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FerMouvement` (
    `id` VARCHAR(191) NOT NULL,
    `etatId` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `type` ENUM('LIVRAISON', 'TRANSFERT', 'AJUSTEMENT') NOT NULL DEFAULT 'LIVRAISON',
    `bonLivraison` VARCHAR(191) NULL,
    `note` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `FerMouvement_etatId_date_idx`(`etatId`, `date`),
    INDEX `FerMouvement_bonLivraison_idx`(`bonLivraison`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FerMouvementLigne` (
    `id` VARCHAR(191) NOT NULL,
    `mouvementId` VARCHAR(191) NOT NULL,
    `diametreId` VARCHAR(191) NOT NULL,
    `qty` DECIMAL(65, 30) NOT NULL,

    INDEX `FerMouvementLigne_diametreId_idx`(`diametreId`),
    UNIQUE INDEX `FerMouvementLigne_mouvementId_diametreId_key`(`mouvementId`, `diametreId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FerRestantNonConfectionne` (
    `id` VARCHAR(191) NOT NULL,
    `chantierName` VARCHAR(191) NOT NULL,
    `sousTraitant` VARCHAR(191) NULL,
    `rapportDate` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `FerRestantNonConfectionne_chantierName_idx`(`chantierName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FerRestantSnapshot` (
    `id` VARCHAR(191) NOT NULL,
    `rapportId` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `note` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `FerRestantSnapshot_rapportId_date_idx`(`rapportId`, `date`),
    UNIQUE INDEX `FerRestantSnapshot_rapportId_date_key`(`rapportId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FerRestantLigne` (
    `id` VARCHAR(191) NOT NULL,
    `snapshotId` VARCHAR(191) NOT NULL,
    `diametreId` VARCHAR(191) NOT NULL,
    `qty` DECIMAL(65, 30) NOT NULL,

    INDEX `FerRestantLigne_diametreId_idx`(`diametreId`),
    UNIQUE INDEX `FerRestantLigne_snapshotId_diametreId_key`(`snapshotId`, `diametreId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `subscriptionId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Module` (
    `id` VARCHAR(191) NOT NULL,
    `key` ENUM('MODULE_1', 'MODULE_2') NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `route` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 100,
    `isActive` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `Module_key_key`(`key`),
    UNIQUE INDEX `Module_slug_key`(`slug`),
    INDEX `Module_sortOrder_idx`(`sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SubscriptionModule` (
    `subscriptionId` VARCHAR(191) NOT NULL,
    `moduleId` VARCHAR(191) NOT NULL,
    `enabledAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`subscriptionId`, `moduleId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SubModule` (
    `id` VARCHAR(191) NOT NULL,
    `key` ENUM('FERRAILLAGE') NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `route` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 100,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `moduleId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `SubModule_key_key`(`key`),
    UNIQUE INDEX `SubModule_slug_key`(`slug`),
    INDEX `SubModule_moduleId_sortOrder_idx`(`moduleId`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SubscriptionSubModule` (
    `subscriptionId` VARCHAR(191) NOT NULL,
    `subModuleId` VARCHAR(191) NOT NULL,
    `enabledAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`subscriptionId`, `subModuleId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Subscription` (
    `id` VARCHAR(191) NOT NULL,
    `status` ENUM('INACTIVE', 'ACTIVE', 'EXPIRED', 'PAST_DUE') NOT NULL DEFAULT 'INACTIVE',
    `plan` ENUM('INDIVIDUAL', 'ENTERPRISE') NULL,
    `billingCycle` ENUM('MONTHLY', 'YEARLY') NULL,
    `seats` INTEGER NOT NULL DEFAULT 1,
    `currentPeriodEnd` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `FerMouvement` ADD CONSTRAINT `FerMouvement_etatId_fkey` FOREIGN KEY (`etatId`) REFERENCES `FerEtatChantier`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FerMouvementLigne` ADD CONSTRAINT `FerMouvementLigne_mouvementId_fkey` FOREIGN KEY (`mouvementId`) REFERENCES `FerMouvement`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FerMouvementLigne` ADD CONSTRAINT `FerMouvementLigne_diametreId_fkey` FOREIGN KEY (`diametreId`) REFERENCES `FerDiametre`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FerRestantSnapshot` ADD CONSTRAINT `FerRestantSnapshot_rapportId_fkey` FOREIGN KEY (`rapportId`) REFERENCES `FerRestantNonConfectionne`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FerRestantLigne` ADD CONSTRAINT `FerRestantLigne_snapshotId_fkey` FOREIGN KEY (`snapshotId`) REFERENCES `FerRestantSnapshot`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FerRestantLigne` ADD CONSTRAINT `FerRestantLigne_diametreId_fkey` FOREIGN KEY (`diametreId`) REFERENCES `FerDiametre`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_subscriptionId_fkey` FOREIGN KEY (`subscriptionId`) REFERENCES `Subscription`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SubscriptionModule` ADD CONSTRAINT `SubscriptionModule_subscriptionId_fkey` FOREIGN KEY (`subscriptionId`) REFERENCES `Subscription`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SubscriptionModule` ADD CONSTRAINT `SubscriptionModule_moduleId_fkey` FOREIGN KEY (`moduleId`) REFERENCES `Module`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SubModule` ADD CONSTRAINT `SubModule_moduleId_fkey` FOREIGN KEY (`moduleId`) REFERENCES `Module`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SubscriptionSubModule` ADD CONSTRAINT `SubscriptionSubModule_subscriptionId_fkey` FOREIGN KEY (`subscriptionId`) REFERENCES `Subscription`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SubscriptionSubModule` ADD CONSTRAINT `SubscriptionSubModule_subModuleId_fkey` FOREIGN KEY (`subModuleId`) REFERENCES `SubModule`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

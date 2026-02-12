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
    `isActive` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `Module_key_key`(`key`),
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
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `moduleId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `SubModule_key_key`(`key`),
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

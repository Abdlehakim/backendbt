/*
  Warnings:

  - A unique constraint covering the columns `[slug]` on the table `Module` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[slug]` on the table `SubModule` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `route` to the `Module` table without a default value. This is not possible if the table is not empty.
  - Added the required column `slug` to the `Module` table without a default value. This is not possible if the table is not empty.
  - Added the required column `route` to the `SubModule` table without a default value. This is not possible if the table is not empty.
  - Added the required column `slug` to the `SubModule` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `Module` ADD COLUMN `route` VARCHAR(191) NOT NULL,
    ADD COLUMN `slug` VARCHAR(191) NOT NULL,
    ADD COLUMN `sortOrder` INTEGER NOT NULL DEFAULT 100;

-- AlterTable
ALTER TABLE `SubModule` ADD COLUMN `route` VARCHAR(191) NOT NULL,
    ADD COLUMN `slug` VARCHAR(191) NOT NULL,
    ADD COLUMN `sortOrder` INTEGER NOT NULL DEFAULT 100;

-- CreateIndex
CREATE UNIQUE INDEX `Module_slug_key` ON `Module`(`slug`);

-- CreateIndex
CREATE INDEX `Module_sortOrder_idx` ON `Module`(`sortOrder`);

-- CreateIndex
CREATE UNIQUE INDEX `SubModule_slug_key` ON `SubModule`(`slug`);

-- CreateIndex
CREATE INDEX `SubModule_moduleId_sortOrder_idx` ON `SubModule`(`moduleId`, `sortOrder`);

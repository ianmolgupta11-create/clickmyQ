-- CreateTable
CREATE TABLE `HospitalMedicine` (
    `id` VARCHAR(191) NOT NULL,
    `hospitalId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `normalizedName` VARCHAR(191) NOT NULL,
    `genericName` VARCHAR(191) NULL,
    `strength` VARCHAR(191) NULL,
    `dosageForm` VARCHAR(191) NULL,
    `defaultRoute` VARCHAR(191) NULL,
    `usageCount` INTEGER NOT NULL DEFAULT 0,
    `lastUsedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `addedByDoctorId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `HospitalMedicine_hospitalId_isActive_idx`(`hospitalId`, `isActive`),
    INDEX `HospitalMedicine_hospitalId_lastUsedAt_idx`(`hospitalId`, `lastUsedAt`),
    INDEX `HospitalMedicine_addedByDoctorId_idx`(`addedByDoctorId`),
    UNIQUE INDEX `HospitalMedicine_hospitalId_normalizedName_key`(`hospitalId`, `normalizedName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `HospitalMedicine` ADD CONSTRAINT `HospitalMedicine_hospitalId_fkey` FOREIGN KEY (`hospitalId`) REFERENCES `Hospital`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HospitalMedicine` ADD CONSTRAINT `HospitalMedicine_addedByDoctorId_fkey` FOREIGN KEY (`addedByDoctorId`) REFERENCES `Doctor`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

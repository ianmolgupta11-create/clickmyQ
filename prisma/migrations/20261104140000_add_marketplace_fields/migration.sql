-- Add marketplace configuration fields to HospitalSettings
ALTER TABLE `HospitalSettings` ADD COLUMN `googlePlaceId` VARCHAR(191) NULL;
ALTER TABLE `HospitalSettings` ADD COLUMN `marketplaceDoctorOrder` JSON NULL;

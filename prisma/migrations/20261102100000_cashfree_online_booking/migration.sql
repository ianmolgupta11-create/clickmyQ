ALTER TABLE `PaymentTransaction`
  ADD COLUMN `baseAmountPaise` INTEGER NULL,
  ADD COLUMN `convenienceFeePaise` INTEGER NULL,
  ADD COLUMN `currency` VARCHAR(3) NOT NULL DEFAULT 'INR',
  ADD COLUMN `bookingFingerprint` CHAR(64) NULL,
  ADD COLUMN `bookingData` JSON NULL;

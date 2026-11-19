-- Add the doctor's online booking fee, separate from the consultation fee.

ALTER TABLE `Doctor`
  ADD COLUMN `onlineBookingFee` DOUBLE NOT NULL DEFAULT 0 AFTER `consultationFee`;
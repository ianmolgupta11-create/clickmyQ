ALTER TABLE `Appointment`
  ADD COLUMN `onlineBookingFee` DOUBLE NULL;

UPDATE `Appointment` a
SET a.`onlineBookingFee` = COALESCE(
  (
    SELECT p.`baseAmountPaise` / 100
    FROM `PaymentTransaction` p
    WHERE p.`appointmentId` = a.`id`
      AND p.`status` = 'PAID'
      AND p.`baseAmountPaise` IS NOT NULL
    ORDER BY p.`paidAt` DESC
    LIMIT 1
  ),
  (
    SELECT NULLIF(d.`onlineBookingFee`, 0)
    FROM `Doctor` d
    WHERE d.`id` = a.`doctorId`
  )
)
WHERE a.`bookingSource` = 'ONLINE';

-- Migration: add_doctor_interruption_status
-- Purpose: Add emergency/break interruption status and timestamps to the Doctor model.
-- Non-destructive: only ADD COLUMN statements. No data is dropped or modified.

ALTER TABLE \`Doctor\`
  ADD COLUMN \`status\` ENUM('ACTIVE','EMERGENCY','ON_BREAK') NOT NULL DEFAULT 'ACTIVE' AFTER \`isAvailable\`,
  ADD COLUMN \`statusStartedAt\` DATETIME(3) NULL,
  ADD COLUMN \`expectedReturnAt\` DATETIME(3) NULL,
  ADD COLUMN \`actualReturnAt\` DATETIME(3) NULL;

-- Migration: add membership_type to students table
-- Adds a new column `membership_type` with allowed values and defaults existing rows to 'full_time'

BEGIN;

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS membership_type VARCHAR(20) DEFAULT 'full_time' CHECK (membership_type IN ('full_time', 'half_time', 'two_hours'));

-- Update existing rows explicitly to 'full_time' where NULL
UPDATE students SET membership_type = 'full_time' WHERE membership_type IS NULL;

COMMIT;

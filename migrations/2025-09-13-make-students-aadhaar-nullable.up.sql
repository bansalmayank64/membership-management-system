-- Migration: make students.aadhaar_number nullable
-- UP: Alter students.aadhaar_number to allow NULL, and students_history.aadhaar_number to allow NULL

BEGIN;

-- Allow NULL on main table
ALTER TABLE IF EXISTS students ALTER COLUMN aadhaar_number DROP NOT NULL;

-- The students_history table currently defines aadhaar_number NOT NULL; allow NULL for history as well
ALTER TABLE IF EXISTS students_history ALTER COLUMN aadhaar_number DROP NOT NULL;

COMMIT;

-- Migration: revert make students.aadhaar_number nullable
-- DOWN: Restore NOT NULL constraint on students.aadhaar_number and students_history.aadhaar_number

BEGIN;

-- For safety, ensure there are no NULLs before adding NOT NULL constraint
-- If NULLs exist, this will fail; run appropriate cleanup or set default values before reverting.

ALTER TABLE IF EXISTS students_history ALTER COLUMN aadhaar_number SET NOT NULL;
ALTER TABLE IF EXISTS students ALTER COLUMN aadhaar_number SET NOT NULL;

COMMIT;

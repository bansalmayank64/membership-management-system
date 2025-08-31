-- Migration: add unique index on aadhaar_number to prevent duplicates
-- Non-destructive: only creates unique index if not exists
BEGIN;

-- Create a unique index on aadhaar_number after normalizing to digits only would be ideal,
-- but to keep it simple and safe, add a unique index on the aadhaar_number column directly.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_index i
        JOIN pg_class c ON c.oid = i.indexrelid
        WHERE c.relname = 'students_aadhaar_number_key'
    ) THEN
        -- Create a unique index to enforce uniqueness
        CREATE UNIQUE INDEX students_aadhaar_number_key ON students (aadhaar_number);
    END IF;
END$$;

COMMIT;

-- Migration to add 'inactive' status to membership_status check constraint
-- This script updates the existing check constraint to allow 'inactive' as a valid membership status

-- Drop the existing check constraint
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_membership_status_check;

-- Add the new check constraint with 'inactive' included
ALTER TABLE students ADD CONSTRAINT students_membership_status_check 
  CHECK (membership_status IN ('active','expired','suspended','inactive'));

-- Verify the constraint was added successfully
SELECT conname, consrc 
FROM pg_constraint 
WHERE conrelid = 'students'::regclass 
  AND conname = 'students_membership_status_check';

-- Optional: Display current membership_status values to verify
SELECT DISTINCT membership_status, COUNT(*) as count
FROM students 
GROUP BY membership_status
ORDER BY membership_status;

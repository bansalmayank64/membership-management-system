-- Migration to remove membership type constraints and allow flexible membership types
-- This allows any membership type value to be used in the system

BEGIN;

-- Remove CHECK constraint on students.membership_type
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_membership_type_check;

-- Remove CHECK constraint on student_fees_config.membership_type  
ALTER TABLE student_fees_config DROP CONSTRAINT IF EXISTS student_fees_config_membership_type_check;

-- Modify the columns to allow any varchar value
ALTER TABLE students ALTER COLUMN membership_type TYPE VARCHAR(50);
ALTER TABLE student_fees_config ALTER COLUMN membership_type TYPE VARCHAR(50);

COMMIT;
-- Migration: Reset sequences for serial 'id' columns to max(id)+1
-- Date: 2025-09-01
-- Purpose: After bulk imports/restores, ensure sequences used by serial/bigserial
-- columns are advanced to the current maximum + 1 so future inserts do not conflict.

BEGIN;

DO $$
DECLARE
  r RECORD;
  seqname TEXT;
  maxid BIGINT;
  nextval BIGINT;
BEGIN
  FOR r IN
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'id'
      AND column_default LIKE 'nextval(%'
  LOOP
    -- find the sequence backing the serial/bigserial column
    SELECT pg_get_serial_sequence(r.table_name, 'id') INTO seqname;
    IF seqname IS NULL THEN
      RAISE NOTICE 'No serial sequence found for table %', r.table_name;
      CONTINUE;
    END IF;

    EXECUTE format('SELECT COALESCE(MAX(id),0) FROM %I', r.table_name) INTO maxid;
    nextval := COALESCE(maxid, 0) + 1;

    RAISE NOTICE 'Setting sequence % for table % to next value %', seqname, r.table_name, nextval;

    -- set sequence so next nextval() returns nextval
    EXECUTE format('SELECT setval(%L, %s, false)', seqname, nextval);
  END LOOP;
END$$;

COMMIT;

-- Notes:
-- - This migration is idempotent: running it multiple times will re-evaluate max(id) and set the sequence accordingly.
-- - It targets columns named 'id' whose defaults use nextval(...). If you have PKs with different names, add them explicitly.

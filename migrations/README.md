This directory contains SQL migrations to be applied to the Postgres database.

Migration files:
- 2025-09-13-make-students-aadhaar-nullable.up.sql: Alters `students.aadhaar_number` and `students_history.aadhaar_number` to allow NULL.
- 2025-09-13-make-students-aadhaar-nullable.down.sql: Reverts the change (sets NOT NULL). The DOWN migration will fail if NULL values exist in the columns.

How to apply (psql):

# apply UP
psql "postgresql://<user>:<pass>@<host>:<port>/<db>" -f migrations/2025-09-13-make-students-aadhaar-nullable.up.sql

# revert (if needed)
psql "postgresql://<user>:<pass>@<host>:<port>/<db>" -f migrations/2025-09-13-make-students-aadhaar-nullable.down.sql

Notes:
- Ensure you have a recent backup before running migrations.
- The DOWN migration assumes no NULL values exist; if you need to revert, first set a non-null default for existing NULLs or restore from backup.
- If you use a migration tool (like Flyway, Liquibase, or a custom runner), integrate these SQL files to your migration pipeline instead of running them manually.

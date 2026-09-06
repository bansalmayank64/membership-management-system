-- STUDY ROOM MANAGEMENT SYSTEM - DATABASE SCHEMA
-- 
-- IMPORTANT: The 'status' field has been removed from the seats table.
-- Seat status is now determined by joining with the students table:
-- - 'occupied' = seat has a student assigned (students.seat_number = seats.seat_number)  
-- - 'available' = seat has no student assigned
-- Use the seat_status_view for queries that need seat status information.
--
-- DROP COMMANDS - Clean up existing objects
-- Drop triggers first (depend on functions)
DROP MATERIALIZED VIEW IF EXISTS bpss_scores;
DROP VIEW IF EXISTS seat_status_view;
DROP TRIGGER IF EXISTS trg_check_seat_sex_match ON students;
DROP TRIGGER IF EXISTS trg_students_audit ON students;
DROP TRIGGER IF EXISTS trg_seats_audit ON seats;

-- Drop functions
DROP FUNCTION IF EXISTS check_seat_sex_match();
DROP FUNCTION IF EXISTS log_students_changes();
DROP FUNCTION IF EXISTS log_seats_changes();

-- Drop indexes
DROP INDEX IF EXISTS idx_students_contact;
DROP INDEX IF EXISTS idx_payments_student;
DROP INDEX IF EXISTS idx_payments_date;
DROP INDEX IF EXISTS idx_expenses_date;
DROP INDEX IF EXISTS idx_expenses_category;

-- Drop foreign key constraints
-- No longer needed as we're removing student_id from seats table

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS payments_history CASCADE;
DROP TABLE IF EXISTS seats_history CASCADE;
DROP TABLE IF EXISTS students_history CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS expense_categories CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS seats CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS student_fees_config CASCADE;
DROP TABLE IF EXISTS activity_logs CASCADE;
DROP TABLE IF EXISTS token_blacklist CASCADE;

-- Users table (must be first for foreign key references)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    permissions JSONB DEFAULT '{}',
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Main tables
CREATE TABLE seats (
    seat_number VARCHAR(20) PRIMARY KEY,
    occupant_sex VARCHAR(10) CHECK (occupant_sex IN ('male','female')) DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modified_by INTEGER NOT NULL REFERENCES users(id)
);

CREATE TABLE students (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    father_name VARCHAR(100) NOT NULL,
    -- Enforce exactly 10 digits for contact numbers at the DB level
    contact_number VARCHAR(10) NOT NULL CHECK (contact_number ~ '^[0-9]{10}$'),
    aadhaar_number VARCHAR(20) UNIQUE,
    address TEXT NOT NULL,
    sex VARCHAR(10) CHECK (sex IN ('male','female')) NOT NULL,
    membership_type VARCHAR(50) NOT NULL DEFAULT 'full_time',
    seat_number VARCHAR(20),
    membership_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    membership_till TIMESTAMP,
    membership_status VARCHAR(30) NOT NULL CHECK (membership_status IN ('active','expired','suspended','inactive')) DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modified_by INTEGER NOT NULL REFERENCES users(id)
);

-- Set student ID sequence to start from 20250001
ALTER SEQUENCE students_id_seq RESTART WITH 20250001;

CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students(id),
    amount NUMERIC(10,2) NOT NULL,
    payment_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    payment_mode VARCHAR(20) NOT NULL CHECK (payment_mode IN ('cash','online')) DEFAULT 'cash',
    payment_type VARCHAR(50) NOT NULL CHECK (payment_type IN ('monthly_fee','refund')) DEFAULT 'monthly_fee',
    description TEXT,
    remarks TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modified_by INTEGER NOT NULL REFERENCES users(id)
);

-- Normalized expense categories table
CREATE TABLE expense_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE expenses (
    id SERIAL PRIMARY KEY,
    expense_category_id INTEGER NOT NULL REFERENCES expense_categories(id),
    description TEXT NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    expense_date TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modified_by INTEGER NOT NULL REFERENCES users(id)
);

-- Insert default expense categories (idempotent)
INSERT INTO expense_categories (name, description, created_at, updated_at) VALUES
('salary of caretaker', 'Monthly salary payments for caretaker(s)', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('electricity', 'Electricity and power charges', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('cleaning', 'Cleaning and housekeeping expenses', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (name) DO NOTHING;

-- Student fees configuration table for membership types (flexible - any membership type allowed)
CREATE TABLE student_fees_config (
    id SERIAL PRIMARY KEY,
    membership_type VARCHAR(50) NOT NULL,
    male_monthly_fees NUMERIC(10,2) NOT NULL,
    female_monthly_fees NUMERIC(10,2) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(membership_type)
);

-- History tables to track all changes
CREATE TABLE students_history (
    history_id SERIAL PRIMARY KEY NOT NULL,
    id INTEGER NOT NULL,
    seat_number VARCHAR(20),
    sex VARCHAR(10) NOT NULL CHECK (sex IN ('male', 'female')),
    name VARCHAR(100) NOT NULL,
    father_name VARCHAR(100) NOT NULL,
    -- Store contact number snapshot in history and enforce 10 digits for consistency
    contact_number VARCHAR(10) NOT NULL CHECK (contact_number ~ '^[0-9]{10}$'),
    aadhaar_number VARCHAR(20),
    address TEXT NOT NULL,
    membership_date TIMESTAMP NOT NULL,
    membership_till TIMESTAMP,
    membership_status VARCHAR(30) NOT NULL CHECK (membership_status IN ('active','expired','suspended','inactive')) ,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modified_by INTEGER NOT NULL,
    action VARCHAR(10) NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
    action_timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE seats_history (
    history_id SERIAL PRIMARY KEY NOT NULL,
    student_id INTEGER NOT NULL,
    seat_number VARCHAR(20) NOT NULL,
    student_name VARCHAR(100) NOT NULL,
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP,
    occupant_sex VARCHAR(10) NOT NULL CHECK (occupant_sex IN ('male', 'female')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modified_by INTEGER NOT NULL,
    action VARCHAR(10) NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE','ASSIGN','UNASSIGN')),
    action_timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Function to log changes to history tables
CREATE OR REPLACE FUNCTION log_students_changes() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        INSERT INTO students_history (
            id, seat_number, sex, name, father_name, contact_number, aadhaar_number, address,
            membership_date, membership_till, membership_status,
            created_at, updated_at, modified_by, action
        ) VALUES (
            OLD.id, OLD.seat_number, OLD.sex, OLD.name, OLD.father_name, OLD.contact_number, OLD.aadhaar_number, OLD.address,
            OLD.membership_date, OLD.membership_till, OLD.membership_status,
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, OLD.modified_by, 'DELETE'
        );
        
        -- If student had a seat, update the previous seats_history record's end_date
        IF OLD.seat_number IS NOT NULL THEN
            UPDATE seats_history 
            SET end_date = CURRENT_TIMESTAMP,
                modified_by = OLD.modified_by
            WHERE student_id = OLD.id 
                AND seat_number = OLD.seat_number 
                AND end_date IS NULL
                AND action = 'ASSIGN';
        END IF;
        
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO students_history (
            id, seat_number, sex, name, father_name, contact_number, aadhaar_number, address,
            membership_date, membership_till, membership_status,
            created_at, updated_at, modified_by, action
        ) VALUES (
            NEW.id, NEW.seat_number, NEW.sex, NEW.name, NEW.father_name, NEW.contact_number, NEW.aadhaar_number, NEW.address,
            NEW.membership_date, NEW.membership_till, NEW.membership_status,
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NEW.modified_by, 'UPDATE'
        );
        
        -- Handle seat assignment changes
        IF OLD.seat_number IS DISTINCT FROM NEW.seat_number THEN
            -- If old seat exists, update the previous seats_history record's end_date
            IF OLD.seat_number IS NOT NULL THEN
                UPDATE seats_history 
                SET end_date = CURRENT_TIMESTAMP,
                    modified_by = NEW.modified_by
                WHERE student_id = OLD.id 
                    AND seat_number = OLD.seat_number 
                    AND end_date IS NULL
                    AND action = 'ASSIGN';
            END IF;
            
            -- If new seat exists, log assignment
            IF NEW.seat_number IS NOT NULL THEN
                INSERT INTO seats_history (
                    student_id, seat_number, student_name, start_date, end_date,
                    occupant_sex, created_at, updated_at, modified_by, action
                ) VALUES (
                    NEW.id, NEW.seat_number, NEW.name, CURRENT_TIMESTAMP, NULL,
                    NEW.sex, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NEW.modified_by, 'ASSIGN'
                );
            END IF;
        END IF;
        
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO students_history (
            id, seat_number, sex, name, father_name, contact_number, aadhaar_number, address,
            membership_date, membership_till, membership_status,
            created_at, updated_at, modified_by, action
        ) VALUES (
            NEW.id, NEW.seat_number, NEW.sex, NEW.name, NEW.father_name, NEW.contact_number, NEW.aadhaar_number, NEW.address,
            NEW.membership_date, NEW.membership_till, NEW.membership_status,
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NEW.modified_by, 'INSERT'
        );
        
        -- If new student has a seat assigned, log seat assignment
        IF NEW.seat_number IS NOT NULL THEN
            INSERT INTO seats_history (
                student_id, seat_number, student_name, start_date, end_date,
                occupant_sex, created_at, updated_at, modified_by, action
            ) VALUES (
                NEW.id, NEW.seat_number, NEW.name, CURRENT_TIMESTAMP, NULL,
                NEW.sex, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NEW.modified_by, 'ASSIGN'
            );
        END IF;
        
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Triggers for logging
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_name = 'trg_students_audit'
    ) THEN
        CREATE TRIGGER trg_students_audit
        AFTER INSERT OR UPDATE OR DELETE ON students
        FOR EACH ROW EXECUTE FUNCTION log_students_changes();
    END IF;
END $$;

-- Create default seat records
-- INSERT INTO seats (seat_number, occupant_sex) 
-- SELECT s::text, 'male'
-- FROM generate_series(1,100) s
-- WHERE NOT EXISTS (SELECT 1 FROM seats WHERE seat_number = s::text);

-- INSERT INTO seats (seat_number, occupant_sex) 
-- SELECT s::text, 'female'
-- FROM generate_series(101,120) s
-- WHERE NOT EXISTS (SELECT 1 FROM seats WHERE seat_number = s::text);

-- Add foreign key constraint for seats.student_id after students table exists
-- No longer needed as student_id field has been removed from seats table

-- Create indexes for better performance
CREATE INDEX idx_students_contact ON students(contact_number);
CREATE INDEX idx_students_seat_number ON students(seat_number);
-- Unique constraint on aadhaar_number already defined inline in students table; add index name for compatibility if needed
CREATE UNIQUE INDEX IF NOT EXISTS students_aadhaar_number_key ON students(aadhaar_number);
CREATE INDEX idx_payments_student ON payments(student_id);
CREATE INDEX idx_payments_date ON payments(payment_date);
CREATE INDEX idx_expenses_date ON expenses(expense_date);
-- Index by category id for faster category-based queries
CREATE INDEX idx_expenses_category_id ON expenses(expense_category_id);
-- Index for soft delete filtering on student_fees_config
CREATE INDEX idx_student_fees_config_is_active ON student_fees_config(is_active);

-- Create a view to demonstrate how to check seat status by joining with students table
-- Status is determined as follows:
-- 'occupied' - seat has a student assigned (students.seat_number = seats.seat_number)
-- 'available' - seat has no student assigned
CREATE OR REPLACE VIEW seat_status_view AS
SELECT 
    s.seat_number,
    s.occupant_sex,
    CASE 
        WHEN st.seat_number IS NOT NULL THEN 'occupied'
        ELSE 'available'
    END as status,
    st.id as student_id,
    st.name as student_name,
    st.sex as student_sex,
    st.membership_status,
    st.membership_till,
    s.created_at,
    s.updated_at,
    s.modified_by
FROM seats s
LEFT JOIN students st ON s.seat_number = st.seat_number;

-- Create default admin user (password: admin123)
INSERT INTO users (username, password_hash, role, permissions) VALUES 
('admin', '$2a$12$OwZfLUjJlc39xuV6JCpE/.fBrPNb1hBxPL/n/yNNn1OYvMEZsyW4C', 'admin', '{}')
ON CONFLICT (username) DO NOTHING;

-- Create default user (password: user123)
INSERT INTO users (username, password_hash, role, permissions) VALUES 
('user', '$2a$12$P.qziy9SRcHCnUizu99ebOoj69xsdhiUin2Jajn.Q1xPcu016Saom', 'user', '{}')
ON CONFLICT (username) DO NOTHING;

-- Insert default fee configuration for membership types (example values)
INSERT INTO student_fees_config (membership_type, male_monthly_fees, female_monthly_fees) VALUES
('full_time', 700.00, 600.00),
('half_time', 400.00, 350.00),
('two_hours', 200.00, 200.00),
('Old student', 650.00, 600.00),
('free', 0.00, 0.00)
ON CONFLICT (membership_type) DO UPDATE SET
    male_monthly_fees = EXCLUDED.male_monthly_fees,
    female_monthly_fees = EXCLUDED.female_monthly_fees;

-- Activity logs table (centralized log of user actions, auth events, and system activities)
CREATE TABLE IF NOT EXISTS activity_logs (
    id SERIAL PRIMARY KEY,
    actor_user_id INTEGER REFERENCES users(id),
    actor_username VARCHAR(50),
    action_type VARCHAR(50) NOT NULL,
    action_description TEXT,
    subject_type VARCHAR(50),
    subject_id INTEGER,
    metadata JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_actor ON activity_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);

-- Token blacklist table (for user logout functionality)
CREATE TABLE IF NOT EXISTS token_blacklist (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) UNIQUE,
    username VARCHAR(50) NOT NULL,
    blacklisted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    blacklisted_by INTEGER REFERENCES users(id),
    reason VARCHAR(255) DEFAULT 'Admin logout'
);

CREATE INDEX IF NOT EXISTS idx_token_blacklist_user_id ON token_blacklist(user_id);
CREATE INDEX IF NOT EXISTS idx_token_blacklist_blacklisted_at ON token_blacklist(blacklisted_at);

-- Migration: Add AI query frequency tracking table
-- This table stores user query patterns and frequency for AI chat suggestions

CREATE TABLE IF NOT EXISTS ai_query_frequency (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    normalized_query TEXT NOT NULL,
    original_query_example TEXT NOT NULL,
    frequency_count INTEGER DEFAULT 1,
    first_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ai_query_frequency_user_id ON ai_query_frequency(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_query_frequency_user_query ON ai_query_frequency(user_id, normalized_query);
CREATE INDEX IF NOT EXISTS idx_ai_query_frequency_last_used ON ai_query_frequency(last_used_at);

-- Create unique constraint to prevent duplicate entries
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_query_frequency_unique ON ai_query_frequency(user_id, normalized_query);

-- Add comments for documentation
COMMENT ON TABLE ai_query_frequency IS 'Stores AI chat query frequency patterns for personalized suggestions';
COMMENT ON COLUMN ai_query_frequency.normalized_query IS 'Normalized query pattern for grouping similar queries';
COMMENT ON COLUMN ai_query_frequency.original_query_example IS 'Example of the original query for display purposes';
COMMENT ON COLUMN ai_query_frequency.frequency_count IS 'Number of times this query pattern has been used';
COMMENT ON COLUMN ai_query_frequency.first_used_at IS 'When this query pattern was first used';
COMMENT ON COLUMN ai_query_frequency.last_used_at IS 'When this query pattern was last used';

-- BPSS (Behavior Payment Score System) Materialized View
--
-- Computes a 0–100 payment behavior score per student from existing data only.
-- No new tables are created. Refresh daily at 01:00 AM IST via node-cron (server.js).
-- Manual refresh: REFRESH MATERIALIZED VIEW CONCURRENTLY bpss_scores;
--
-- Scoring formula (100 pts total):
--   35 pts  Payment Timeliness  (late_cycles / applicable_cycles)
--   25 pts  Average Delay       (avg delay days, capped at 30)
--   20 pts  Recent Behavior     (weighted 50/30/20 across last 3/4-6/7-12 months)
--   10 pts  Consecutive Late    (−2 pts per streak cycle, min 0)
--   10 pts  Maximum Delay       (max delay days, capped at 30)
--
-- Inactive-return rule: a payment is not counted as late when a students_history
-- record with membership_status = 'inactive' exists between the previous period
-- end and the payment date — i.e., the student was explicitly deactivated.
-- First payment per student (enrollment) is excluded from applicable cycles.
-- Students with no applicable cycles → bpss_score = 100, score_status = 'NO_DATA'.

CREATE MATERIALIZED VIEW bpss_scores AS
WITH RECURSIVE

-- Gender-specific monthly fee per student from the current fee config.
-- LEFT JOIN so students with no fee config still appear (monthly_fee = 0, excluded downstream).
student_fee AS (
  SELECT
    s.id   AS student_id,
    s.name AS student_name,
    s.sex,
    s.membership_date::DATE AS membership_date,
    CASE WHEN s.sex = 'male'
         THEN COALESCE(fc.male_monthly_fees, 0)
         ELSE COALESCE(fc.female_monthly_fees, 0)
    END AS monthly_fee
  FROM students s
  LEFT JOIN student_fees_config fc
    ON fc.membership_type = s.membership_type
),

-- All monthly_fee payments per student, ranked oldest-first.
-- ext_days = how many days of membership the payment buys (amount / monthly_fee × 30).
-- Free memberships (monthly_fee = 0) are excluded to avoid division by zero.
-- Payments before membership_date are excluded so that a "fresh membership start"
-- on reactivation resets the PBS timeline to the new start date.
numbered_payments AS (
  SELECT
    p.id,
    p.student_id,
    p.payment_date::DATE                                                 AS payment_date,
    p.amount,
    sf.monthly_fee,
    sf.membership_date,
    FLOOR((p.amount / sf.monthly_fee) * 30)::INTEGER                    AS ext_days,
    ROW_NUMBER() OVER (PARTITION BY p.student_id ORDER BY p.payment_date, p.id) AS rn
  FROM payments p
  JOIN student_fee sf ON sf.student_id = p.student_id
  WHERE p.payment_type = 'monthly_fee'
    AND sf.monthly_fee > 0
    AND p.payment_date >= sf.membership_date
),

-- Recursive CTE: walks each student's payment chain to compute, for every payment:
--   expected_due    — when membership should have been renewed (= simulated_till of prior payment)
--   simulated_till  — mirrors app logic: GREATEST(expected_due, payment_date) + ext_days
--   delay_raw       — calendar days between expected_due and actual payment (0 if early)
--   is_inactive_return — TRUE when a students_history row proves the student was deactivated
--                        during the gap; those gaps are not penalised as late payments
--
-- Column list is explicit so the UNION ALL member's positional mapping is unambiguous.
timeline(
  id, student_id, payment_date, amount, monthly_fee, ext_days, rn,
  expected_due, simulated_till, delay_raw, is_inactive_return
) AS (
  -- Base case: enrollment payment. Sets the first simulated_till; excluded from scoring (rn=1).
  -- expected_due = membership_date (the original join date, not payment_date).
  -- GREATEST(...) + ext_days prevents backdating when the first payment arrives late.
  SELECT
    np.id, np.student_id, np.payment_date, np.amount, np.monthly_fee, np.ext_days, np.rn,
    np.membership_date,
    GREATEST(np.membership_date, np.payment_date) + np.ext_days,
    GREATEST(0, (np.payment_date - np.membership_date)),
    FALSE
  FROM numbered_payments np
  WHERE np.rn = 1

  UNION ALL

  -- Recursive case: each renewal payment.
  -- expected_due = previous simulated_till (the date membership should have been renewed).
  -- is_inactive_return: check students_history for an explicit deactivation event in the gap;
  --   avoids penalising planned inactive periods as late payments.
  SELECT
    np.id, np.student_id, np.payment_date, np.amount, np.monthly_fee, np.ext_days, np.rn,
    tl.simulated_till,
    GREATEST(tl.simulated_till, np.payment_date) + np.ext_days,
    GREATEST(0, (np.payment_date - tl.simulated_till)),
    EXISTS (
      SELECT 1 FROM students_history sh
      WHERE sh.id                     = tl.student_id
        AND sh.membership_status      = 'inactive'
        AND sh.action_timestamp::DATE > tl.simulated_till   -- deactivation happened after last period
        AND sh.action_timestamp::DATE <= np.payment_date    -- and before (or on) this payment
    )                                                                    AS is_inactive_return
  FROM timeline tl
  JOIN numbered_payments np
    ON np.student_id = tl.student_id
   AND np.rn         = tl.rn + 1
),

-- Renewal payments (rn > 1) in the last 12 months, classified for scoring.
-- delay_days is zeroed for inactive returns so they don't skew averages.
-- is_late uses a 2-day grace period (scored on-time, but UI still shows the real delay).
recent_cycles AS (
  SELECT
    student_id,
    payment_date,
    CASE WHEN is_inactive_return THEN 0 ELSE delay_raw END              AS delay_days,
    (NOT is_inactive_return)                                             AS is_applicable,
    (NOT is_inactive_return AND delay_raw > 2)                          AS is_late  -- 2-day grace
  FROM timeline
  WHERE payment_date >= CURRENT_DATE - INTERVAL '1 year'
    AND rn > 1
),

-- Per-student totals and sub-period counts needed for the weighted recent-behavior component.
agg AS (
  SELECT
    student_id,
    COUNT(*)           FILTER (WHERE is_applicable)                      AS total_applicable,
    COUNT(*)           FILTER (WHERE is_applicable AND NOT is_late)      AS on_time,
    COUNT(*)           FILTER (WHERE is_applicable AND is_late)          AS total_late,
    COALESCE(AVG(delay_days) FILTER (WHERE is_applicable AND is_late), 0) AS avg_delay,
    COALESCE(MAX(delay_days) FILTER (WHERE is_applicable),             0) AS max_delay,
    MAX(payment_date)                                                    AS last_payment_date,
    COUNT(*) FILTER (WHERE is_applicable
                       AND payment_date >= CURRENT_DATE - INTERVAL '3 months')  AS applicable_3m,
    COUNT(*) FILTER (WHERE is_applicable AND is_late
                       AND payment_date >= CURRENT_DATE - INTERVAL '3 months')  AS late_3m,
    COUNT(*) FILTER (WHERE is_applicable
                       AND payment_date >= CURRENT_DATE - INTERVAL '6 months')  AS applicable_6m,
    COUNT(*) FILTER (WHERE is_applicable AND is_late
                       AND payment_date >= CURRENT_DATE - INTERVAL '6 months')  AS late_6m
  FROM recent_cycles
  GROUP BY student_id
),

-- Rank applicable cycles newest-first per student to identify the current late streak.
recent_ordered AS (
  SELECT
    student_id, is_late,
    ROW_NUMBER() OVER (PARTITION BY student_id ORDER BY payment_date DESC) AS rn
  FROM recent_cycles
  WHERE is_applicable
),

-- For each row, find the rank of the most recent on-time payment.
-- Rows with rn < first_ontime_rn are part of the current consecutive late run.
streak_base AS (
  SELECT
    student_id, is_late, rn,
    MIN(CASE WHEN NOT is_late THEN rn ELSE NULL END)
      OVER (PARTITION BY student_id)                                     AS first_ontime_rn
  FROM recent_ordered
),

-- Count late cycles that are strictly more recent than the last on-time cycle.
-- If first_ontime_rn IS NULL the student has never paid on time → count all late rows.
streak_calc AS (
  SELECT
    student_id,
    COUNT(*) FILTER (WHERE is_late
                       AND (first_ontime_rn IS NULL OR rn < first_ontime_rn)) AS consec_streak
  FROM streak_base
  GROUP BY student_id
),

-- Simplified scoring formula:
--   faultRate  = faults / payments
--   rawScore   = 100 × (1 − faultRate)
--   confidence = min(payments / 12, 1)   — blends toward 100 when data is sparse
--   PBS        = rawScore × confidence + 100 × (1 − confidence)
pbs_calc AS (
  SELECT
    a.student_id,
    LEAST(a.total_applicable::NUMERIC / 12, 1.0)                         AS confidence,
    CASE WHEN a.total_applicable > 0
         THEN ROUND(100.0 * (1.0 - a.total_late::NUMERIC / a.total_applicable), 1)
         ELSE 100 END                                                     AS raw_score,
    CASE WHEN a.total_applicable = 0 THEN 100
         ELSE GREATEST(0, LEAST(100, ROUND(
           100.0 * (1.0 - a.total_late::NUMERIC / a.total_applicable)
             * LEAST(a.total_applicable::NUMERIC / 12, 1.0)
           + 100.0 * (1.0 - LEAST(a.total_applicable::NUMERIC / 12, 1.0))
         )::INTEGER))
    END                                                                   AS pbs_score
  FROM agg a
)

-- Final output: one row per student.
-- Students with no applicable cycles get score = 100, score_status = 'NO_DATA'.
-- confidence_pct (0–100) expresses how much of a full 12-month history is available.
SELECT
  sf.student_id,
  sf.student_name,
  COALESCE(pc.pbs_score, 100)                                            AS bpss_score,
  CASE
    WHEN COALESCE(a.total_applicable, 0) = 0 THEN 'Trusted'
    WHEN pc.pbs_score >= 90                   THEN 'Trusted'
    WHEN pc.pbs_score >= 75                   THEN 'Reliable'
    WHEN pc.pbs_score >= 60                   THEN 'Average'
    WHEN pc.pbs_score >= 40                   THEN 'Watchlist'
    ELSE                                           'Defaulter'
  END                                                                    AS risk_level,
  CASE WHEN COALESCE(a.total_applicable, 0) = 0 THEN 'NO_DATA'
       ELSE 'ACTIVE'
  END                                                                    AS score_status,
  COALESCE(a.total_applicable, 0)                                        AS total_applicable_cycles,
  COALESCE(a.on_time,          0)                                        AS on_time_cycles,
  COALESCE(a.total_late,       0)                                        AS late_cycles,
  CASE WHEN COALESCE(a.total_applicable, 0) > 0
       THEN ROUND(a.total_late::NUMERIC / a.total_applicable * 100, 1)
       ELSE 0 END                                                        AS late_percentage,
  COALESCE(a.avg_delay,        0)                                        AS average_delay_days,
  COALESCE(a.max_delay,        0)                                        AS maximum_delay_days,
  ROUND(COALESCE(pc.confidence, 0) * 100)::INTEGER                       AS confidence_pct,
  COALESCE(pc.raw_score,       100)                                      AS raw_score,
  -- sub-period late rates kept for display (non-overlapping windows)
  CASE WHEN COALESCE(a.applicable_3m, 0) > 0
       THEN ROUND(a.late_3m::NUMERIC / a.applicable_3m * 100, 1)
       ELSE 0 END                                                        AS recent_3_month_late_pct,
  CASE WHEN COALESCE(a.applicable_6m - a.applicable_3m, 0) > 0
       THEN ROUND((a.late_6m - a.late_3m)::NUMERIC
                  / (a.applicable_6m - a.applicable_3m) * 100, 1)
       ELSE 0 END                                                        AS recent_4_6_month_late_pct,
  CASE WHEN COALESCE(a.total_applicable - a.applicable_6m, 0) > 0
       THEN ROUND((a.total_late - a.late_6m)::NUMERIC
                  / (a.total_applicable - a.applicable_6m) * 100, 1)
       ELSE 0 END                                                        AS recent_7_12_month_late_pct,
  COALESCE(sc.consec_streak,   0)                                        AS current_consecutive_late_cycles,
  a.last_payment_date
FROM student_fee sf
LEFT JOIN agg        a  ON a.student_id  = sf.student_id
LEFT JOIN pbs_calc   pc ON pc.student_id = sf.student_id
LEFT JOIN streak_calc sc ON sc.student_id = sf.student_id;

CREATE UNIQUE INDEX idx_bpss_scores_student_id ON bpss_scores(student_id);
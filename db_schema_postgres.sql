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
DROP TABLE IF EXISTS expenses_history CASCADE;
DROP TABLE IF EXISTS payments_history CASCADE;
DROP TABLE IF EXISTS seats_history CASCADE;
DROP TABLE IF EXISTS students_history CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS seats CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS student_fees_config CASCADE;
DROP TABLE IF EXISTS activity_logs CASCADE;

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
    aadhaar_number VARCHAR(20) NOT NULL UNIQUE,
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

CREATE TABLE expenses (
    id SERIAL PRIMARY KEY,
    category VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    expense_date TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modified_by INTEGER NOT NULL REFERENCES users(id)
);

-- Student fees configuration table for membership types (flexible - any membership type allowed)
CREATE TABLE student_fees_config (
    id SERIAL PRIMARY KEY,
    membership_type VARCHAR(50) NOT NULL,
    male_monthly_fees NUMERIC(10,2) NOT NULL,
    female_monthly_fees NUMERIC(10,2) NOT NULL,
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
    aadhaar_number VARCHAR(20)  NOT NULL,
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

CREATE TABLE expenses_history (
    history_id SERIAL PRIMARY KEY NOT NULL,
    id INTEGER NOT NULL,
    category VARCHAR(50) NOT NULL,
    description TEXT,
    amount NUMERIC(10,2),
    expense_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modified_by INTEGER NOT NULL,
    action VARCHAR(10) CHECK (action IN ('INSERT','UPDATE','DELETE')),
    action_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
CREATE INDEX idx_expenses_category ON expenses(category);

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
('full_time', 600.00, 550.00),
('half_time', 400.00, 350.00),
('two_hours', 200.00, 200.00),
('special', 650.00, 550.00),
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

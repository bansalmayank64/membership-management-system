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
DROP TABLE IF EXISTS expenses_history;
DROP TABLE IF EXISTS payments_history;
DROP TABLE IF EXISTS seats_history;
DROP TABLE IF EXISTS students_history;
DROP TABLE IF EXISTS expenses;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS students;
DROP TABLE IF EXISTS seats;
DROP TABLE IF EXISTS users;

-- Users table (must be first for foreign key references)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    permissions JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Main tables
CREATE TABLE seats (
    seat_number VARCHAR(20) PRIMARY KEY,
    occupant_sex VARCHAR(10) CHECK (occupant_sex IN ('male','female')) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    modified_by INTEGER REFERENCES users(id)
);

CREATE TABLE students (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    father_name VARCHAR(100),
    contact_number VARCHAR(20) UNIQUE,
    sex VARCHAR(10) CHECK (sex IN ('male','female')) NOT NULL,
    seat_number VARCHAR(20),
    membership_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    membership_till TIMESTAMP,
    membership_status VARCHAR(30) CHECK (membership_status IN ('active','expired','suspended','inactive')) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    modified_by INTEGER REFERENCES users(id)
);

-- Set student ID sequence to start from 20250001
ALTER SEQUENCE students_id_seq RESTART WITH 20250001;

CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES students(id),
    amount NUMERIC(10,2) NOT NULL,
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    payment_mode VARCHAR(20) CHECK (payment_mode IN ('cash','online')) DEFAULT 'cash',
    payment_type VARCHAR(50) CHECK (payment_type IN ('monthly_fee','refund')) DEFAULT 'monthly_fee',
    description TEXT,
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    modified_by INTEGER REFERENCES users(id)
);

CREATE TABLE expenses (
    id SERIAL PRIMARY KEY,
    category VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    expense_date TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    modified_by INTEGER REFERENCES users(id)
);

-- Student fees configuration table for membership extension
CREATE TABLE student_fees_config (
    id SERIAL PRIMARY KEY,
    gender VARCHAR(10) NOT NULL CHECK (gender IN ('male', 'female')),
    monthly_fees NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(gender)
);

-- History tables to track all changes
CREATE TABLE students_history (
    history_id SERIAL PRIMARY KEY,
    id INTEGER,
    seat_number VARCHAR(20),
    sex VARCHAR(10),
    name VARCHAR(100),
    father_name VARCHAR(100),
    contact_number VARCHAR(20),
    membership_date TIMESTAMP,
    membership_till TIMESTAMP,
    membership_status VARCHAR(30),
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    modified_by INTEGER,
    action VARCHAR(10) CHECK (action IN ('INSERT','UPDATE','DELETE')),
    action_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE seats_history (
    history_id SERIAL PRIMARY KEY,
    student_id INTEGER,
    seat_number VARCHAR(20),
    student_name VARCHAR(100),
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    occupant_sex VARCHAR(10),
    created_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    modified_by INTEGER,
    action VARCHAR(10) CHECK (action IN ('INSERT','UPDATE','DELETE','ASSIGN','UNASSIGN')),
    action_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE expenses_history (
    history_id SERIAL PRIMARY KEY,
    id INTEGER,
    category VARCHAR(50),
    description TEXT,
    amount NUMERIC(10,2),
    expense_date TIMESTAMP,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    modified_by INTEGER,
    action VARCHAR(10) CHECK (action IN ('INSERT','UPDATE','DELETE')),
    action_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



-- Function to log changes to history tables
CREATE OR REPLACE FUNCTION log_students_changes() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        INSERT INTO students_history (
            id, seat_number, sex, name, father_name, contact_number,
            membership_date, membership_till, membership_status,
            created_at, updated_at, modified_by, action
        ) VALUES (
            OLD.id, OLD.seat_number, OLD.sex, OLD.name, OLD.father_name, OLD.contact_number,
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
            id, seat_number, sex, name, father_name, contact_number,
            membership_date, membership_till, membership_status,
            created_at, updated_at, modified_by, action
        ) VALUES (
            NEW.id, NEW.seat_number, NEW.sex, NEW.name, NEW.father_name, NEW.contact_number,
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
            id, seat_number, sex, name, father_name, contact_number,
            membership_date, membership_till, membership_status,
            created_at, updated_at, modified_by, action
        ) VALUES (
            NEW.id, NEW.seat_number, NEW.sex, NEW.name, NEW.father_name, NEW.contact_number,
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
INSERT INTO seats (seat_number, occupant_sex) 
SELECT s::text, 'male'
FROM generate_series(1,100) s
WHERE NOT EXISTS (SELECT 1 FROM seats WHERE seat_number = s::text);

INSERT INTO seats (seat_number, occupant_sex) 
SELECT s::text, 'female'
FROM generate_series(101,120) s
WHERE NOT EXISTS (SELECT 1 FROM seats WHERE seat_number = s::text);

-- Add foreign key constraint for seats.student_id after students table exists
-- No longer needed as student_id field has been removed from seats table

-- Create indexes for better performance
CREATE INDEX idx_students_contact ON students(contact_number);
CREATE INDEX idx_students_seat_number ON students(seat_number);
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
('admin', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj92OBLKdZy6', 'admin', 
 '{"canManageUsers": true, "canImportData": true, "canExportData": true, "canDeleteData": true, "canManageSeats": true, "canManageStudents": true, "canManagePayments": true, "canManageExpenses": true}')
ON CONFLICT (username) DO NOTHING;

-- Insert default fee configuration for membership extension
INSERT INTO student_fees_config (gender, monthly_fees) VALUES 
('male', 600.00),
('female', 550.00)
ON CONFLICT (gender) DO UPDATE SET monthly_fees = EXCLUDED.monthly_fees;

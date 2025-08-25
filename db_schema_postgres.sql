-- DROP COMMANDS - Clean up existing objects
-- Drop triggers first (depend on functions)
DROP TRIGGER IF EXISTS trg_check_seat_sex_match ON students;
DROP TRIGGER IF EXISTS trg_students_audit ON students;

-- Drop functions
DROP FUNCTION IF EXISTS check_seat_sex_match();
DROP FUNCTION IF EXISTS log_students_changes();

-- Drop indexes
DROP INDEX IF EXISTS idx_students_contact;
DROP INDEX IF EXISTS idx_payments_student;
DROP INDEX IF EXISTS idx_payments_date;
DROP INDEX IF EXISTS idx_expenses_date;
DROP INDEX IF EXISTS idx_expenses_category;
DROP INDEX IF EXISTS idx_seats_student;

-- Drop foreign key constraints
ALTER TABLE IF EXISTS seats DROP CONSTRAINT IF EXISTS fk_seats_student_id;

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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Main tables
CREATE TABLE seats (
    seat_number VARCHAR(20) PRIMARY KEY,
    student_id INTEGER,
    status VARCHAR(20) CHECK (status IN ('available','occupied','maintenance','removed')) DEFAULT 'available',
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
    membership_status VARCHAR(30) CHECK (membership_status IN ('active','expired','suspended')) DEFAULT 'active',
    total_paid NUMERIC(10,2) DEFAULT 0,
    last_payment_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    modified_by INTEGER REFERENCES users(id)
);

CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES students(id),
    amount NUMERIC(10,2) NOT NULL,
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    payment_mode VARCHAR(20) CHECK (payment_mode IN ('cash','online')) DEFAULT 'cash',
    description TEXT,
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
    total_paid NUMERIC(10,2),
    membership_till TIMESTAMP,
    membership_status VARCHAR(30),
    last_payment_date TIMESTAMP,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    modified_by INTEGER,
    action VARCHAR(10) CHECK (action IN ('INSERT','UPDATE','DELETE')),
    action_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE seats_history (
    history_id SERIAL PRIMARY KEY,
    seat_number VARCHAR(20),
    status VARCHAR(20),
    occupant_sex VARCHAR(10),
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    modified_by INTEGER,
    action VARCHAR(10) CHECK (action IN ('INSERT','UPDATE','DELETE')),
    action_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE payments_history (
    history_id SERIAL PRIMARY KEY,
    id INTEGER,
    student_id INTEGER,
    seat_number VARCHAR(20),
    amount NUMERIC(10,2),
    payment_date TIMESTAMP,
    payment_method VARCHAR(20),
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    modified_by INTEGER,
    action VARCHAR(10) CHECK (action IN ('INSERT','UPDATE','DELETE')),
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

-- Trigger function to enforce seat sex restriction
CREATE OR REPLACE FUNCTION check_seat_sex_match() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.seat_number IS NOT NULL THEN
        PERFORM 1 FROM seats WHERE seat_number = NEW.seat_number AND (occupant_sex = NEW.sex OR occupant_sex IS NULL);
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Student sex % does not match seat % restriction', NEW.sex, NEW.seat_number;
        END IF;
        
        -- Update seat occupant_sex when student is assigned
        UPDATE seats SET occupant_sex = NEW.sex, status = 'occupied' WHERE seat_number = NEW.seat_number;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to enforce seat sex restriction
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_name = 'trg_check_seat_sex_match'
    ) THEN
        CREATE TRIGGER trg_check_seat_sex_match
        BEFORE INSERT OR UPDATE ON students
        FOR EACH ROW EXECUTE FUNCTION check_seat_sex_match();
    END IF;
END $$;

-- Function to log changes to history tables
CREATE OR REPLACE FUNCTION log_students_changes() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        INSERT INTO students_history (
            id, seat_number, sex, name, father_name, contact_number,
            membership_date, total_paid, membership_till, membership_status,
            last_payment_date, created_at, updated_at, modified_by, action
        ) VALUES (
            OLD.id, OLD.seat_number, OLD.sex, OLD.name, OLD.father_name, OLD.contact_number,
            OLD.membership_date, OLD.total_paid, OLD.membership_till, OLD.membership_status,
            OLD.last_payment_date, OLD.created_at, OLD.updated_at, OLD.modified_by, 'DELETE'
        );
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO students_history (
            id, seat_number, sex, name, father_name, contact_number,
            membership_date, total_paid, membership_till, membership_status,
            last_payment_date, created_at, updated_at, modified_by, action
        ) VALUES (
            NEW.id, NEW.seat_number, NEW.sex, NEW.name, NEW.father_name, NEW.contact_number,
            NEW.membership_date, NEW.total_paid, NEW.membership_till, NEW.membership_status,
            NEW.last_payment_date, NEW.created_at, NEW.updated_at, NEW.modified_by, 'UPDATE'
        );
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO students_history (
            id, seat_number, sex, name, father_name, contact_number,
            membership_date, total_paid, membership_till, membership_status,
            last_payment_date, created_at, updated_at, modified_by, action
        ) VALUES (
            NEW.id, NEW.seat_number, NEW.sex, NEW.name, NEW.father_name, NEW.contact_number,
            NEW.membership_date, NEW.total_paid, NEW.membership_till, NEW.membership_status,
            NEW.last_payment_date, NEW.created_at, NEW.updated_at, NEW.modified_by, 'INSERT'
        );
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

-- Create default seat records (flexible seat numbers)
-- Insert basic numbered seats 1-100 with male restriction by default
INSERT INTO seats (seat_number, status, occupant_sex) 
SELECT s::text, 'available', 'male'
FROM generate_series(1,100) s
WHERE NOT EXISTS (SELECT 1 FROM seats WHERE seat_number = s::text);

-- Add foreign key constraint for seats.student_id after students table exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_seats_student_id'
    ) THEN
        ALTER TABLE seats ADD CONSTRAINT fk_seats_student_id FOREIGN KEY (student_id) REFERENCES students(id);
    END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX idx_students_contact ON students(contact_number);
CREATE INDEX idx_payments_student ON payments(student_id);
CREATE INDEX idx_payments_date ON payments(payment_date);
CREATE INDEX idx_expenses_date ON expenses(expense_date);
CREATE INDEX idx_expenses_category ON expenses(category);
CREATE INDEX idx_seats_student ON seats(student_id);

-- Create default admin user (password: admin123)
INSERT INTO users (username, password_hash, role, permissions) VALUES 
('admin', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj92OBLKdZy6', 'admin', 
 '{"canManageUsers": true, "canImportData": true, "canExportData": true, "canDeleteData": true, "canManageSeats": true, "canManageStudents": true, "canManagePayments": true, "canManageExpenses": true}')
ON CONFLICT (username) DO NOTHING;

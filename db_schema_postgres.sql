-- Trigger function to enforce seat sex restriction
CREATE OR REPLACE FUNCTION check_seat_sex_match() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.seat_number IS NOT NULL THEN
        PERFORM 1 FROM seats WHERE seat_number = NEW.seat_number AND occupant_sex = NEW.sex;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Student sex (%%) does not match seat (%%) restriction', NEW.sex, NEW.seat_number;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_seat_sex_match
BEFORE INSERT OR UPDATE ON students
FOR EACH ROW EXECUTE FUNCTION check_seat_sex_match();

-- History tables to track all changes
CREATE TABLE students_history (
    history_id SERIAL PRIMARY KEY,
    id INTEGER,
    seat_number VARCHAR(20),
    sex VARCHAR(10),
    name_student VARCHAR(100),
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
    amount NUMERIC(10,2),
    payment_date TIMESTAMP,
    payment_mode VARCHAR(10),
    remarks TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    modified_by INTEGER,
    action VARCHAR(10) CHECK (action IN ('INSERT','UPDATE','DELETE')),
    action_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE expenses_history (
    history_id SERIAL PRIMARY KEY,
    id INTEGER,
    description TEXT,
    amount NUMERIC(10,2),
    expense_date TIMESTAMP,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    modified_by INTEGER,
    action VARCHAR(10) CHECK (action IN ('INSERT','UPDATE','DELETE')),
    action_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- PostgreSQL schema for Study Room Management App
-- Created on 2025-08-25

CREATE TABLE seats (
    seat_number VARCHAR(20) PRIMARY KEY,
    status VARCHAR(20) CHECK (status IN ('available', 'occupied', 'maintenance', 'removed')) DEFAULT 'available',
    occupant_sex VARCHAR(10) CHECK (occupant_sex IN ('male', 'female')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    modified_by INTEGER REFERENCES users(id)
);

CREATE TABLE students (
    id SERIAL PRIMARY KEY,
    seat_number VARCHAR(20) REFERENCES seats(seat_number),
    sex VARCHAR(10) CHECK (sex IN ('male', 'female')),
    name_student VARCHAR(100) NOT NULL,
    father_name VARCHAR(100),
    contact_number VARCHAR(20),
    membership_date TIMESTAMP  NOT NULL,
    total_paid NUMERIC(10,2) DEFAULT 0,
    membership_till TIMESTAMP NOT NULL,
    membership_status VARCHAR(30) CHECK (membership_status IN ('ACTIVE', 'EXPIRED')),
    last_payment_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    modified_by INTEGER REFERENCES users(id)
);

CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES students(id),
    amount NUMERIC(10,2) NOT NULL,
    payment_date TIMESTAMP NOT NULL,
    payment_mode VARCHAR(10) CHECK (payment_mode IN ('CASH', 'ONLINE')),
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    modified_by INTEGER REFERENCES users(id)
);

CREATE TABLE expenses (
    id SERIAL PRIMARY KEY,
    description TEXT NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    expense_date TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    modified_by INTEGER REFERENCES users(id)
);

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

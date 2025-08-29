-- Create student_fees_config table
CREATE TABLE student_fees_config (
    id SERIAL PRIMARY KEY,
    gender VARCHAR(10) NOT NULL CHECK (gender IN ('male', 'female')),
    monthly_fees NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(gender)
);

-- Insert fee configuration records
INSERT INTO student_fees_config (gender, monthly_fees) VALUES 
('male', 600.00),
('female', 550.00);

-- Verify the data
SELECT * FROM student_fees_config;

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
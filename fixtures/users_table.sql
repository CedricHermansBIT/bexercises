-- Sample MariaDB fixture for exercises
-- This creates a users table with sample data

CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL,
    age INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO users (name, email, age) VALUES
    ('Alice Smith', 'alice@example.com', 30),
    ('Bob Johnson', 'bob@example.com', 25),
    ('Charlie Brown', 'charlie@example.com', 35);

# Database Fixtures Guide

This guide explains how to use database fixtures with MariaDB and MongoDB exercises.

## Overview

Database fixtures allow you to initialize a database with predefined tables, collections, and data before running an exercise. This is essential for exercises that test:

- **SELECT queries** (query existing data)
- **INSERT operations** (add to existing tables)
- **UPDATE operations** (modify existing data)
- **DELETE operations** (remove data)
- **Table structure validation** (check schemas)

## How It Works

1. **Fixture Files**: SQL files for MariaDB, JavaScript files for MongoDB
2. **Container Initialization**: A Docker container starts with your fixtures loaded
3. **Persistent State**: User's query and validation query run in the same database instance
4. **CRUD Support**: All database operations work because state persists during test execution

## MariaDB Fixtures

### Creating a Fixture

Create a `.sql` file in the `fixtures/` directory:

```sql
-- fixtures/users_table.sql
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL
);

INSERT INTO users (name, email) VALUES
    ('Alice', 'alice@example.com'),
    ('Bob', 'bob@example.com');
```

### Using in Exercises

**Example 1: SELECT Exercise**
```json
{
  "title": "Query All Users",
  "exercise_type": "database",
  "language_id": "mariadb",
  "testCases": [{
    "fixtures": ["users_table.sql"],
    "expectedOutput": "1\tAlice\talice@example.com\n2\tBob\tbob@example.com"
  }]
}
```

User writes:
```sql
SELECT * FROM users ORDER BY id;
```

**Example 2: INSERT Exercise**
```json
{
  "title": "Add New User",
  "testCases": [{
    "fixtures": ["users_table.sql"],
    "expectedOutput": "3\tCharlie\tcharlie@example.com",
    "validationQuery": "SELECT * FROM users WHERE id = 3;"
  }]
}
```

User writes:
```sql
INSERT INTO users (name, email) VALUES ('Charlie', 'charlie@example.com');
```

**Example 3: UPDATE Exercise**
```json
{
  "testCases": [{
    "fixtures": ["users_table.sql"],
    "expectedOutput": "alice_updated@example.com",
    "validationQuery": "SELECT email FROM users WHERE id = 1;"
  }]
}
```

User writes:
```sql
UPDATE users SET email = 'alice_updated@example.com' WHERE id = 1;
```

**Example 4: CREATE TABLE (Empty Database)**
```json
{
  "testCases": [{
    "fixtures": ["empty_db.sql"],
    "expectedOutput": "products",
    "validationQuery": "SHOW TABLES;"
  }]
}
```

User writes:
```sql
CREATE TABLE products (
    id INT PRIMARY KEY,
    name VARCHAR(100)
);
```

## MongoDB Fixtures

### Creating a Fixture

Create a `.js` file in the `fixtures/` directory:

```javascript
// fixtures/products_collection.js
db.products.insertMany([
    {
        name: "Laptop",
        price: 999.99,
        stock: 50
    },
    {
        name: "Mouse",
        price: 29.99,
        stock: 200
    }
]);
```

### Using in Exercises

**Example 1: Query Exercise**
```json
{
  "title": "Find Expensive Products",
  "exercise_type": "database",
  "language_id": "mongodb",
  "testCases": [{
    "fixtures": ["products_collection.js"],
    "expectedOutput": "{ name: 'Laptop', price: 999.99, stock: 50 }"
  }]
}
```

User writes:
```javascript
db.products.findOne({price: {$gt: 500}});
```

**Example 2: Insert Exercise**
```json
{
  "testCases": [{
    "fixtures": ["products_collection.js"],
    "expectedOutput": "3",
    "validationQuery": "db.products.countDocuments();"
  }]
}
```

User writes:
```javascript
db.products.insertOne({name: "Keyboard", price: 79.99, stock: 100});
```

**Example 3: Update Exercise**
```json
{
  "testCases": [{
    "fixtures": ["products_collection.js"],
    "expectedOutput": "25",
    "validationQuery": "db.products.findOne({name: 'Mouse'}).stock;"
  }]
}
```

User writes:
```javascript
db.products.updateOne({name: 'Mouse'}, {$set: {stock: 25}});
```

## Key Features

### 1. Persistent State

The database container runs for the entire test case, maintaining state:

```
Start Container → Load Fixtures → Run User Query → Run Validation Query → Cleanup
```

All queries see the same database state!

### 2. Multiple Fixtures

You can load multiple fixture files:

```json
{
  "fixtures": ["users_table.sql", "orders_table.sql", "products_table.sql"]
}
```

They're loaded in order, so you can have dependencies.

### 3. Empty Database Support

Use `empty_db.sql` or don't specify fixtures for CREATE DATABASE/TABLE exercises:

```json
{
  "fixtures": [],  // or ["empty_db.sql"]
  "validationQuery": "SHOW TABLES;"
}
```

### 4. Validation Queries

Check actual database state instead of command output:

```json
{
  "validationQuery": "SELECT COUNT(*) FROM users;"
}
```

This is crucial because:
- INSERT output: "Query OK, 1 row affected" (not helpful)
- Validation output: "5" (actual row count - helpful!)

## Best Practices

### 1. Fixture Naming

- Use descriptive names: `users_table.sql`, `orders_with_items.sql`
- Include schema + data: `customers_and_orders.sql`
- Empty fixtures: `empty_db.sql`, `blank_schema.sql`

### 2. Idempotent Fixtures

Use `CREATE TABLE IF NOT EXISTS` and `INSERT IGNORE`:

```sql
CREATE TABLE IF NOT EXISTS users (...);
INSERT IGNORE INTO users VALUES (...);
```

### 3. Minimal Fixtures

Include only the data needed for the exercise:

```sql
-- Good: Just enough data
INSERT INTO users VALUES (1, 'Alice'), (2, 'Bob');

-- Bad: Too much data obscures the exercise
INSERT INTO users VALUES (1, 'Alice'), (2, 'Bob'), ... (98 more rows);
```

### 4. Test Isolation

Each test case gets a fresh database:
- Test 1: Uses fixtures → runs query → validates → cleanup
- Test 2: Gets NEW database with same fixtures → independent

### 5. Validation Query Design

Be specific about what you're checking:

```sql
-- Good: Check specific data
SELECT name, email FROM users WHERE id = 1;

-- Bad: Returns too much
SELECT * FROM users;
```

## Limitations

1. **Container Lifecycle**: One container per exercise (reused across test cases)
2. **Fixture Size**: Keep fixtures small (< 1MB) for fast loading
3. **Timeout**: Container initialization counts against test timeout
4. **Network**: Containers run with `--network none` for security

## Troubleshooting

### Fixtures Not Loading

Check:
1. File exists in `fixtures/` directory
2. Correct file extension (`.sql` for MariaDB, `.js` for MongoDB)
3. No syntax errors in fixture file
4. File listed in test case `fixtures` array

### Query Fails But Works Locally

Check:
1. Database name: Uses `testdb` by default
2. User permissions: Full access in container
3. Timing: Wait for container initialization (3 seconds)

### Validation Query Returns Wrong Data

Remember:
1. Validation runs AFTER user query
2. Both queries see the same database state
3. Order matters for INSERT/UPDATE operations

## Example: Complete CRUD Exercise Set

```json
{
  "title": "User Management CRUD",
  "language_id": "mariadb",
  "testCases": [
    {
      "name": "Read: Query all users",
      "fixtures": ["users_table.sql"],
      "expectedOutput": "Alice\nBob"
    },
    {
      "name": "Create: Add new user",
      "fixtures": ["users_table.sql"],
      "validationQuery": "SELECT name FROM users WHERE id = 3;",
      "expectedOutput": "Charlie"
    },
    {
      "name": "Update: Change user email",
      "fixtures": ["users_table.sql"],
      "validationQuery": "SELECT email FROM users WHERE name = 'Alice';",
      "expectedOutput": "alice_new@example.com"
    },
    {
      "name": "Delete: Remove user",
      "fixtures": ["users_table.sql"],
      "validationQuery": "SELECT COUNT(*) FROM users;",
      "expectedOutput": "2"
    }
  ]
}
```

Each test case gets a fresh database with the same initial data, allowing complete CRUD testing!

# First Admin Setup Guide

This guide explains how to set up the first administrator account for BITLab.

## Overview

BITLab uses Google OAuth for authentication. The first time a user logs in, they are created as a regular user. You need to manually promote the first user to admin status using the database.

## Prerequisites

- BITLab server is installed and running
- You have access to the server's file system
- SQLite is available (comes with Node.js sqlite3 package)

## Steps to Create First Admin

### Method 1: Using SQLite Command Line

1. **Log in to the application** with the Google account you want to make an admin
   - Navigate to `http://localhost:3000` (or your server URL)
   - Click "Sign in with Google"
   - Complete the authentication flow
   - This creates your user record in the database

2. **Stop the server** (optional, but recommended for safety)
   ```bash
   # Press Ctrl+C in the terminal where the server is running
   ```

3. **Open the database** using SQLite:
   ```bash
   sqlite3 data/exercises.db
   ```

4. **Find your user ID** using your email:
   ```sql
   SELECT id, email, name, is_admin FROM users WHERE email = 'your-email@example.com';
   ```

5. **Promote the user to admin**:
   ```sql
   UPDATE users SET is_admin = 1 WHERE email = 'your-email@example.com';
   ```

6. **Verify the change**:
   ```sql
   SELECT id, email, name, is_admin FROM users WHERE is_admin = 1;
   ```

7. **Exit SQLite**:
   ```sql
   .quit
   ```

8. **Restart the server**:
   ```bash
   npm start
   ```

### Method 2: Using Node.js Script

Create a temporary script to promote a user:

1. **Create a file** named `promote-admin.js` in the project root:

```javascript
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

async function promoteToAdmin(email) {
    const db = await open({
        filename: path.join(__dirname, 'data/exercises.db'),
        driver: sqlite3.Database
    });

    const result = await db.run(
        'UPDATE users SET is_admin = 1 WHERE email = ?',
        [email]
    );

    if (result.changes === 0) {
        console.log(`No user found with email: ${email}`);
        console.log('Make sure the user has logged in at least once.');
    } else {
        console.log(`Successfully promoted ${email} to admin!`);
    }

    const admin = await db.get(
        'SELECT id, email, name, is_admin FROM users WHERE email = ?',
        [email]
    );
    console.log('User details:', admin);

    await db.close();
}

const email = process.argv[2];
if (!email) {
    console.log('Usage: node promote-admin.js <email>');
    process.exit(1);
}

promoteToAdmin(email).catch(console.error);
```

2. **Run the script**:
   ```bash
   node promote-admin.js your-email@example.com
   ```

3. **Delete the script** after use (for security):
   ```bash
   rm promote-admin.js
   ```

## Verifying Admin Access

1. **Log in to the application** with your newly promoted admin account

2. **Check for admin features**:
   - You should see an "Admin Panel" link in the navigation or user menu
   - Navigate to the admin page (usually `/pages/admin.html`)

3. **Admin capabilities include**:
   - Creating and editing exercises
   - Managing test cases
   - Viewing all user submissions
   - Accessing statistics and leaderboards
   - Promoting other users to admin
   - Managing languages

## Promoting Additional Admins

Once you have admin access, you can promote other users through the admin panel:

1. Go to the Admin Panel
2. Navigate to the Users section
3. Find the user you want to promote
4. Click "Make Admin" or toggle the admin switch

Alternatively, use the same database methods described above.

## Security Considerations

- **Limit admin accounts**: Only promote trusted users to admin status
- **Review regularly**: Periodically audit who has admin access
- **Secure the database**: Ensure the `data/` directory has appropriate file permissions
- **Production deployment**: In production, restrict access to the database file and server

## Troubleshooting

### User not found in database

If the user doesn't exist in the database:
- Ensure they have logged in at least once via Google OAuth
- Check the `users` table: `SELECT * FROM users;`

### Changes not taking effect

- Restart the server after making database changes
- Clear browser cookies and log in again
- Check for session caching issues

### Cannot access database file

- Ensure the `data/` directory exists
- Check file permissions on `data/exercises.db`
- Verify the database path in your configuration

## Database Schema Reference

The `users` table structure:

```sql
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    google_id TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    picture_url TEXT,
    is_admin BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

Where:
- `is_admin = 0` → Regular user
- `is_admin = 1` → Administrator


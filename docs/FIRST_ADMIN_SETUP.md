# Making Your First Admin User

Since admin status is now stored in the database, here's how to create your first admin user.

## Option 1: Direct Database Update (Recommended)

After logging in once with Google OAuth:

```bash
# Open the database
sqlite3 data/exercises.db

# Find your user
SELECT id, email, display_name, is_admin FROM users;

# Make yourself admin (replace YOUR_EMAIL with your actual email)
UPDATE users SET is_admin = 1 WHERE email = 'YOUR_EMAIL@example.com';

# Verify
SELECT id, email, display_name, is_admin FROM users;

# Exit
.quit
```

## Option 2: Environment Variable (Temporary)

You can still use the `ADMIN_EMAILS` environment variable as a fallback:

```env
# In .env file
ADMIN_EMAILS=your.email@example.com,another.admin@example.com
```

This allows admin access without database changes, useful for initial setup.

## Option 3: Direct SQL Script

Create a file `make_admin.sql`:
```sql
-- Replace with your email
UPDATE users SET is_admin = 1 WHERE email = 'your.email@example.com';
```

Run it:
```bash
sqlite3 data/exercises.db < make_admin.sql
```

## Verification

1. Login to the application
2. Go to admin panel
3. Check if you can access the Users tab
4. You should see yourself listed with a 👑 Admin badge

## Making Others Admin

Once you're an admin:
1. Go to Admin Panel → Users tab
2. Find the user you want to make admin
3. Click the crown icon (👑)
4. Confirm

## Removing Admin Status

1. Go to Admin Panel → Users tab
2. Find the admin user
3. Click the user icon (👤)
4. Confirm

## Important Notes

- **First admin must be created manually** (database or env var)
- **Environment variable is fallback only** - database is the source of truth
- **Admin status persists** across sessions
- **You can have multiple admins**

## Troubleshooting

### "Admin access required" error
- Check database: `SELECT is_admin FROM users WHERE email = 'YOUR_EMAIL';`
- Should return `1`, not `0`
- Try adding email to `ADMIN_EMAILS` env var temporarily

### Can't access admin panel
- Ensure you're logged in
- Check browser console for errors
- Verify admin routes are accessible

### Changes not taking effect
- Clear browser cache/cookies
- Logout and login again
- Restart the server

## Security Best Practices

1. **Limit admin users** - Only trusted individuals
2. **Regular audits** - Check who has admin access
3. **Remove inactive admins** - Use the Users tab
4. **Monitor admin actions** - Check user activity regularly

---

**Example: Complete First-Time Setup**

```bash
# 1. Start the server
npm start

# 2. Login with Google OAuth
#    (opens browser, login with Google)

# 3. Check your email was recorded
sqlite3 data/exercises.db "SELECT * FROM users;"

# 4. Make yourself admin
sqlite3 data/exercises.db "UPDATE users SET is_admin = 1 WHERE email = 'YOUR_EMAIL';"

# 5. Refresh browser
#    (you should now see admin panel access)

# 6. Done!
```


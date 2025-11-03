# Bulk Test Verification Feature

## Overview
The Bulk Test Verification feature allows administrators to re-run all test cases across all exercises in one go and review any differences between the current database values and the newly generated outputs. This is particularly useful when:
- Logic changes have been made to the test runner (e.g., adding stderr validation)
- Docker image updates might affect output
- You want to verify that all existing exercises still work correctly

## How to Use

### 1. Open Bulk Verification
1. Navigate to the Admin Exercises page (`/admin/exercises.html`)
2. Click the **"🔍 Verify Tests"** button in the sidebar header
3. A modal will open and automatically start running tests

### 2. Wait for Verification
- The system will run through all exercises that have solutions
- A progress bar shows the current status
- Each exercise's test cases are executed with their configured arguments, inputs, and fixtures

### 3. Review Results
After completion, you'll see a summary showing:
- **Total Tests**: All test cases that were run
- **Changed**: Test cases where output, stderr, or exit code differ from database
- **Unchanged**: Test cases that match their expected values
- **Errors**: Test cases that failed to run

### 4. Inspect Changes
For each test case with differences, you'll see:
- **Side-by-side comparison** of old vs new values
- **What changed**: Output, STDERR, and/or Exit Code
- **Diff view** showing exactly what's different

### 5. Approve or Reject Changes

#### To Approve Changes
- Click the **"✓ Approve Changes"** button for a specific test case
- This updates the database with the new expected values
- The button will change to "✓ Approved" and become disabled
- **Changes are saved immediately** to that exercise

#### To Reject Changes
- Click the **"✗ Keep Old Values"** button
- This does nothing - the database values remain unchanged
- Use this when the new output indicates a regression or bug

## Important Notes

### ⚠️ No Automatic Saving
- Changes are **NOT** saved automatically
- You must **manually review and approve** each change
- This prevents accidental overwrites from bugs in new logic

### 📝 Per-Test Approval
- Each test case can be approved independently
- You can approve some changes and reject others
- Approved changes are saved immediately (no need to save the whole exercise)

### 🔍 What Gets Compared
For each test case, the system compares:
1. **Expected Output** vs **Actual Output** (stdout)
2. **Expected STDERR** vs **Actual STDERR**
3. **Expected Exit Code** vs **Actual Exit Code**

### 🎯 Use Cases

#### When Logic Changes
Example: You just added stderr verification to the test runner.
1. Run bulk verification
2. Review exercises where stderr now appears in output
3. Approve changes where stderr is expected
4. Reject changes where stderr indicates an error in your solution

#### After System Updates
Example: Docker image was updated.
1. Run bulk verification
2. Look for unexpected changes
3. If outputs are better (e.g., cleaner formatting), approve
4. If outputs are worse or broken, investigate and fix the issue

#### Regular Audits
1. Run periodically to ensure exercises still work
2. Verify that solutions produce expected outputs
3. Catch any environmental changes early

## Technical Details

### What Exercises Are Tested
- Only exercises **with solutions** are tested
- Exercises without test cases are skipped
- All test cases within an exercise are run sequentially

### Performance
- Tests run sequentially (one at a time)
- Each test runs in Docker with the configured timeout
- Large test suites may take several minutes

### Error Handling
- If a test case fails to run, it's marked as an error
- Errors are displayed in the results
- You can still approve working test cases in the same exercise

### Data Safety
- Original database values are never modified without explicit approval
- Each approval is a separate database update
- Failed approvals show an error message
- No batch operations - reduces risk of data loss

## Filtering Results

### Current Behavior
- Only exercises with **at least one changed test case** are shown
- Unchanged exercises are hidden to reduce clutter

### Future Enhancements
- Filter by language or chapter
- Show only errors
- Show only specific types of changes (output, stderr, exit code)
- Export comparison report

## Best Practices

1. **Test in Development First**
   - Run bulk verification on a development/staging database
   - Review results before running on production

2. **Review Carefully**
   - Don't blindly approve all changes
   - Understand why values changed
   - Check if the new output is actually correct

3. **Document Major Changes**
   - If approving many changes due to logic updates, document why
   - Keep notes of what changed and when

4. **Regular Verification**
   - Run monthly to catch drift
   - Run after any system updates
   - Run before major releases

5. **Backup First**
   - Always backup your database before approving changes
   - Especially important for bulk approvals

## Troubleshooting

### Modal Doesn't Open
- Check browser console for JavaScript errors
- Ensure you have admin privileges
- Refresh the page and try again

### Tests Take Too Long
- This is normal for large test suites
- Each test must run in Docker
- Consider reducing timeout in config (not recommended)

### All Tests Show as Changed
- Likely indicates a logic change affecting all exercises
- Review the changes carefully before approving
- Verify that the new logic is correct

### Cannot Approve Changes
- Check browser console for API errors
- Ensure you have write permissions
- Verify the exercise still exists

### Some Tests Error Out
- Check if Docker is running
- Verify fixture files exist
- Check server logs for detailed errors

## API Endpoints Used

The feature uses existing API endpoints:
- `GET /api/admin/exercises` - List all exercises
- `GET /api/admin/exercises/:id` - Get exercise details
- `POST /api/admin/run-test-case` - Run individual test case
- `PUT /api/admin/exercises/:id` - Update exercise with new test values

No new backend endpoints are required.


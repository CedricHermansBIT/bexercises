# File Output Verification with SHA-256 Hashing

## Overview

BITLab supports verifying that exercises produce the correct output files by comparing SHA-256 hashes instead of storing actual file content. This is particularly useful for:

- **Binary files** (images, compressed archives, executables)
- **Large files** (avoiding database bloat)
- **Tar/gzip archives** (exercises that create archives)
- **Generated files** (CSV, JSON, XML output)

## How It Works

### 1. Hash-Based Verification
- Instead of storing file content, we store SHA-256 hashes
- After script execution, specified files are hashed
- Hashes are compared against expected values
- Tests pass only if all file hashes match

### 2. Storage Efficiency
- Hashes are always 64 characters (256 bits in hex)
- Doesn't matter if file is 1KB or 1GB
- Database stays small even with many file-based tests

### 3. Binary File Support
- Works with any file type
- No encoding issues
- No size limitations

## Creating Exercises with File Verification

### Admin Interface

1. **Navigate to Admin → Exercises**
2. **Create or edit an exercise**
3. **Add a test case**
4. **Specify output files** in the "Expected Output Files" field:
   ```
   output.txt, result.tar.gz, data.json
   ```
5. **Write the solution** that creates these files
6. **Click "Test Solution"**
7. **System automatically**:
   - Runs your solution
   - Finds the specified files
   - Computes SHA-256 hashes
   - Stores hashes in database
   - Displays file info (hash preview, size)

### Example Exercise

**Title**: Create a Tar Archive

**Description**: Create a compressed tar archive named `backup.tar.gz` containing all `.txt` files in the current directory.

**Solution**:
```bash
#!/bin/bash
tar -czf backup.tar.gz *.txt
```

**Test Case**:
- **Fixtures**: `file1.txt`, `file2.txt`, `file3.txt`
- **Arguments**: (none)
- **Expected Output Files**: `backup.tar.gz`
- **Expected Output** (stdout): (empty)
- **Expected Exit Code**: `0`

When tested, the system will:
1. Create temp directory
2. Copy fixture files
3. Run the script
4. Hash `backup.tar.gz`
5. Store hash: `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`
6. Display: "✓ backup.tar.gz - SHA-256: e3b0c44... - Size: 485 bytes"

### Another Example: CSV Generation

**Title**: Generate CSV Report

**Description**: Create a CSV file named `report.csv` with headers and data rows.

**Solution**:
```bash
#!/bin/bash
echo "Name,Age,City" > report.csv
echo "Alice,30,NYC" >> report.csv
echo "Bob,25,LA" >> report.csv
```

**Test Case**:
- **Expected Output Files**: `report.csv`
- **Expected Output** (stdout): (empty)

## User Experience

When a user submits code for an exercise with file verification:

### Test Results Display

The test results show a **Files** tab with:

```
✓ Match
output.txt
Expected: a3f5b8c2d1e9f7a4b6c8d9e0f1a2b3c4...
Actual:   a3f5b8c2d1e9f7a4b6c8d9e0f1a2b3c4...
Size: 1024 bytes

✗ Mismatch
result.tar.gz
Expected: 5f6a8b9c1d2e3f4a5b6c7d8e9f0a1b2c...
Actual:   7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a...
Size: 2048 bytes

✗ File not found
data.json
File not found
```

### Status Indicators
- **Green ✓**: File hash matches
- **Red ✗**: File hash doesn't match or file missing
- **Color-coded borders**: Visual distinction

## Database Schema

### test_cases Table

```sql
CREATE TABLE test_cases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exercise_id TEXT NOT NULL,
    arguments TEXT,                    -- JSON array
    input TEXT,                        -- JSON array
    expected_output TEXT,              -- stdout
    expected_stderr TEXT DEFAULT '',   -- stderr
    expected_exit_code INTEGER DEFAULT 0,
    expected_output_files TEXT DEFAULT '[]',  -- JSON array of {filename, sha256}
    order_num INTEGER DEFAULT 0,
    FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
);
```

### expected_output_files Format

JSON array of objects:
```json
[
  {
    "filename": "output.txt",
    "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
  },
  {
    "filename": "result.tar.gz",
    "sha256": "5f6a8b9c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a"
  }
]
```

## API

### POST /api/admin/run-test-case

**Request**:
```json
{
  "solution": "#!/bin/bash\ntar -czf backup.tar.gz *.txt",
  "arguments": [],
  "input": [],
  "fixtures": ["file1.txt", "file2.txt"],
  "outputFiles": ["backup.tar.gz"]
}
```

**Response**:
```json
{
  "output": "",
  "stderr": "",
  "exitCode": 0,
  "timedOut": false,
  "error": null,
  "fileHashes": [
    {
      "filename": "backup.tar.gz",
      "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "exists": true,
      "size": 485
    }
  ]
}
```

### POST /api/exercises/:id/run

When running tests, the response includes file verification results:

```json
{
  "results": [
    {
      "testNumber": 1,
      "arguments": [],
      "expectedOutput": "",
      "actualOutput": "",
      "expectedStderr": "",
      "actualStderr": "",
      "expectedExitCode": 0,
      "exitCode": 0,
      "outputFiles": [
        {
          "filename": "backup.tar.gz",
          "expectedHash": "e3b0c44...",
          "actualHash": "e3b0c44...",
          "exists": true,
          "size": 485,
          "matches": true
        }
      ],
      "passed": true
    }
  ]
}
```

## Implementation Details

### Backend

#### dockerService.js

**hashFile(filePath)**: Computes SHA-256 hash
```javascript
async function hashFile(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);
        
        stream.on('data', (data) => hash.update(data));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', reject);
    });
}
```

**hashOutputFiles(tmpdir, filenames)**: Hashes multiple files
```javascript
async function hashOutputFiles(tmpdir, filenames = []) {
    const results = [];
    
    for (const filename of filenames) {
        const filePath = path.join(tmpdir, filename);
        
        if (!fs.existsSync(filePath)) {
            results.push({
                filename,
                sha256: null,
                exists: false,
                error: 'File not found'
            });
            continue;
        }
        
        const hash = await hashFile(filePath);
        const stat = await fs.stat(filePath);
        
        results.push({
            filename,
            sha256: hash,
            exists: true,
            size: stat.size
        });
    }
    
    return results;
}
```

#### testRunner.js

Verification logic:
```javascript
// Keep track of fixture files and script to avoid deleting them
const protectedFiles = new Set(['script.sh']);

for (let i = 0; i < exercise.testCases.length; i++) {
    const tc = exercise.testCases[i];
    
    // Clean up output files from previous test case (but keep fixtures and script)
    if (i > 0) {
        // Delete all files except script.sh and fixtures
        const entries = await fs.readdir(tmpdir);
        for (const entry of entries) {
            if (!protectedFiles.has(entry)) {
                await fs.unlink(path.join(tmpdir, entry));
            }
        }
    }
    
    // Copy fixtures and mark as protected
    if (tc.fixtures && tc.fixtures.length > 0) {
        await copyFixtures(tmpdir, tc.fixtures);
        tc.fixtures.forEach(f => protectedFiles.add(f));
    }
    
    // Run script...
    
    // Hash output files if specified
    let outputFilesResult = [];
    let outputFilesMatch = true;
    
    if (tc.expectedOutputFiles && tc.expectedOutputFiles.length > 0) {
        const filenames = tc.expectedOutputFiles.map(f => f.filename);
        const actualFileHashes = await hashOutputFiles(tmpdir, filenames);
        
        // Compare each file's hash
        outputFilesResult = actualFileHashes.map((actual) => {
            const expected = tc.expectedOutputFiles.find(e => e.filename === actual.filename);
            const hashMatches = expected && actual.sha256 === expected.sha256;
            
            if (!hashMatches) {
                outputFilesMatch = false;
            }
            
            return {
                filename: actual.filename,
                expectedHash: expected ? expected.sha256 : null,
                actualHash: actual.sha256,
                exists: actual.exists,
                size: actual.size,
                error: actual.error,
                matches: hashMatches
            };
        });
    }
    
    // Test passes only if stdout, stderr, exit code, AND file hashes all match
    const passed = (!r.timedOut)
        && (r.exitCode !== null)
        && (String(r.exitCode) === String(expectedExitCode))
        && (actual === expected)
        && (actualStderr === expectedStderr)
        && outputFilesMatch;
}
```

**Important**: Between test cases, all files except `script.sh` and fixture files are deleted. This prevents output files from one test case contaminating subsequent test cases.

### Frontend

#### Test Case Form

Admins specify output files to verify:
```html
<div class="form-group-inline">
    <label>Expected Output Files (comma-separated filenames to verify)</label>
    <input type="text" class="form-input" data-field="outputFiles" data-index="0"
           value="" placeholder="output.txt, result.tar.gz">
    <small>Files created by script that will be hash-verified</small>
</div>

<div class="form-group-inline">
    <label>Expected File Hashes (auto-filled when testing)</label>
    <textarea class="form-input" data-field="expectedOutputFiles" readonly>
        output.txt: e3b0c44298fc1c14...
        result.tar.gz: 5f6a8b9c1d2e3f4a...
    </textarea>
</div>
```

#### Test Results Display

testResults.js shows file comparison in a dedicated tab:
```javascript
if (result.outputFiles && result.outputFiles.length > 0) {
    filesMatch = result.outputFiles.every(f => f.matches) ? '✓' : '✗';
    
    // Add Files tab
    tabsHtml += `<button class="result-tab" data-tab="files">Files ${filesMatch}</button>`;
    
    // Show each file's hash comparison
    result.outputFiles.forEach(file => {
        filesContent += `
            <div class="file-result">
                <strong>${file.filename}</strong>
                <span>${file.matches ? '✓ Match' : '✗ Mismatch'}</span>
                Expected: ${file.expectedHash}
                Actual: ${file.actualHash}
                Size: ${file.size} bytes
            </div>
        `;
    });
}
```

## Use Cases

### 1. Archive Creation
Exercise teaches tar, zip, gzip:
```bash
#!/bin/bash
tar -czf archive.tar.gz *.txt
```
Verify: `archive.tar.gz` hash matches

### 2. Image Processing
Exercise manipulates images:
```bash
#!/bin/bash
convert input.png -resize 50% output.png
```
Verify: `output.png` hash matches

### 3. Data Transformation
Exercise converts CSV to JSON:
```bash
#!/bin/bash
python3 convert.py data.csv > output.json
```
Verify: `output.json` hash matches

### 4. Multi-File Output
Exercise creates multiple files:
```bash
#!/bin/bash
split -l 100 large.txt part_
```
Verify: `part_aa`, `part_ab`, `part_ac` hashes

### 5. Binary Output
Exercise compiles code:
```bash
#!/bin/bash
gcc -o program source.c
```
Verify: `program` hash matches

## Best Practices

### For Exercise Creators

1. **Test Determinism**: Ensure your solution always produces the same file
   - Avoid timestamps in output
   - Use fixed random seeds if randomness is needed
   - Sort data if order matters

2. **Specify All Files**: List every file the script should create
   - Missing files will fail the test
   - Extra files are ignored

3. **Use Fixtures**: Provide necessary input files
   - Upload to fixtures manager
   - Link to test case

4. **Test Your Solution**: Always test before saving
   - Verifies files are created correctly
   - Captures accurate hashes
   - Catches file permission issues

5. **Test Isolation**: Each test case runs in isolation
   - Output files from previous tests are automatically cleaned up
   - Fixture files and script.sh are preserved across tests
   - Don't rely on files persisting between test cases

### For Platform Administrators

1. **Bulk Verification**: After system updates, verify all file-based exercises
   - Docker image changes might affect output
   - Tool version updates could change hashes

2. **Monitor Storage**: File hashes are small, but monitor database size
   - 64 bytes per file hash
   - Negligible compared to storing actual files

3. **Document Exercises**: Clearly explain what files should be created
   - Users need to know expected output files
   - Include in exercise description

4. **Understand Test Isolation**: Multiple test cases share the same temp directory
   - Files are cleaned between tests (except fixtures and script)
   - Fixtures can be reused across test cases
   - Each test starts with a clean slate

## Troubleshooting

### Hash Mismatch After Code Change

**Problem**: Your solution produces the correct file, but hash doesn't match

**Causes**:
- File includes timestamps
- File has trailing whitespace differences
- Line ending differences (CRLF vs LF)
- Character encoding differences

**Solution**: Ensure deterministic output

### File Not Found

**Problem**: Test reports "File not found"

**Causes**:
- Script didn't create the file
- File created in wrong directory
- Filename typo
- Case sensitivity (Linux/Docker is case-sensitive)

**Solution**: 
- Check script creates file in current directory
- Verify exact filename spelling and case
- Test locally in Docker container

### File From Previous Test Detected

**Problem**: Test case fails because it detects an output file from the previous test

**This has been fixed**: The test runner now automatically cleans up output files between test cases, keeping only:
- `script.sh` (the user's script)
- Fixture files specified for the test case

**How it works**:
- Before each test case (except the first), all files except protected files are deleted
- Fixture files are marked as protected when copied
- Only new output files from the current test are hashed

**Example**:
- Test 1: Expects `output.txt` → Creates `output.txt`
- (Cleanup runs: deletes `output.txt`)
- Test 2: Expects no output files → Starts with clean directory
- Test 2 correctly passes without detecting Test 1's `output.txt`

### All Hashes Changed

**Problem**: After system update, all file hashes are different

**Causes**:
- Docker image update changed tool versions
- Changed default tool options
- Updated dependencies

**Solution**:
- Use bulk verification to review changes
- Approve if new hashes are correct
- Investigate if files are corrupted

## Security Considerations

### Hash Collisions
- SHA-256 is cryptographically secure
- Collision probability is astronomically low (2^256)
- Practically impossible for students to forge

### File Size Limits
- No explicit limit, but Docker has resource constraints
- Default memory limit applies
- Timeout prevents long-running operations

### Path Traversal
- Output files must be in temp directory
- Absolute paths and `..` are not supported
- Files outside temp dir are not accessible

## Performance

### Hashing Speed
- SHA-256 is fast (hundreds of MB/s)
- Typical file hashes compute in milliseconds
- Negligible impact on test execution time

### Storage
- Hash: 64 characters (64 bytes)
- vs storing 1MB file: 1,048,576 bytes
- **16,384x space savings** for 1MB file

### Scalability
- Handles any file size
- No memory issues (streaming hash computation)
- Parallel test execution unaffected

## Future Enhancements

Potential improvements:

1. **Partial Hash Matching**: Allow hash prefix matching for very large files
2. **File Count Verification**: Verify number of files created
3. **Directory Hashing**: Hash entire directory trees
4. **Content Preview**: Show first/last N bytes of mismatched files
5. **Hash Algorithm Choice**: Support SHA-512, BLAKE2 for future-proofing
6. **Diff View**: Show binary diff for small files
7. **Compression Detection**: Verify compressed content matches

## Related Features

- **STDERR Verification**: Verify error output
- **Exit Code Verification**: Verify program exit status
- **Stdout Verification**: Verify standard output
- **Bulk Test Verification**: Re-verify all exercises after changes
- **Fixture Management**: Manage input files for exercises


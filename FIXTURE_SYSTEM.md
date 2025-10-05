# File Fixture System Implementation

## Problem
Some bash exercises require access to files (e.g., reading FASTQ files, counting mines in a file, testing file permissions). Previously, these were handled by a virtual filesystem in the bash interpreter, but now that we're using Docker containers, we need real files.

## Solution

### 1. Fixture Files Directory
Created `/srv/bexercises/fixtures/` containing:
- `FASTQ.txt` - Sample FASTQ file with 12 DNA sequences
- `minefield.txt` - Minefield file with 10 mines
- `empty.txt` - Empty minefield (0 mines)
- `testfile` - Executable file (755 permissions)
- `testfile2` - Non-executable file (644 permissions)

### 2. Test Case Configuration
Updated `exercises-internal.json` to add a `fixtures` property to test cases that need files:
```json
{
  "arguments": ["testfile"],
  "expectedOutput": "...",
  "expectedExitCode": 0,
  "fixtures": ["testfile"]  // <-- NEW
}
```

### 3. Server Implementation
Modified `server.js`:

- Added `FIXTURES_DIR` constant pointing to the fixtures directory
- Created `copyFixtures()` function to copy fixture files into the temp directory
- Modified `runScriptInContainer()` to mount the entire temp directory instead of just the script file
  - Changed from: `-v ${scriptPath}:/home/runner/script.sh:ro`
  - Changed to: `-v ${tmpdir}:/home/runner:rw`
  - This gives the script read/write access to all files in the temp directory
- Updated test execution loop to call `copyFixtures()` before running each test case

### 4. Docker Container Changes
- Mount changed from read-only single file to read-write directory
- This allows:
  - Scripts to read fixture files
  - Scripts to create output files (e.g., FASTQ exercise creates output_file.txt)
  - Proper file permission testing

## Affected Exercises
1. **fastq-file-summary** - Reads FASTQ.txt file
2. **file-tests** - Tests file permissions on testfile and testfile2
3. **mine-counter** - Counts mines in minefield.txt and empty.txt

## Benefits
- Real file I/O testing
- Proper permission handling
- Support for creating output files
- Easy to add new fixtures
- Isolated per-test (each test gets its own temp directory)

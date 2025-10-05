# Test Fixtures

This directory contains test fixture files that are used by exercises requiring file I/O operations.

## How it works

1. Fixture files are stored in this directory
2. Test cases in `exercises-internal.json` can specify a `fixtures` array listing which files they need
3. The server copies these files into the temporary directory before running the test
4. The Docker container mounts the entire temp directory, giving the script access to both the script and fixture files

## Available Fixtures

- **FASTQ.txt**: Sample FASTQ file for bioinformatics exercises (12 sequences)
- **empty.txt**: Empty minefield file (no mines)
- **minefield.txt**: Sample minefield file with 10 mines
- **testfile**: Executable test file (rwxr-xr-x)
- **testfile2**: Non-executable test file (rw-r--r--)

## Adding New Fixtures

1. Create the file in this directory
2. Set appropriate permissions (e.g., `chmod +x filename` for executable files)
3. Add the filename to the `fixtures` array in the relevant test case in `exercises-internal.json`

Example test case with fixtures:
```json
{
  "arguments": ["testfile"],
  "expectedOutput": "testfile is readable\n",
  "expectedExitCode": 0,
  "fixtures": ["testfile"]
}
```

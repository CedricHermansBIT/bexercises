# Python course exercise bank

73 exercises arranged as a gradual course companion. Descriptions are in English. Each chapter starts with a smaller task and builds toward combinations of familiar skills.

All 15 existing exercise IDs are incorporated. The existing live InterPro task becomes saved-response parsing; routine grading does not depend on a public API. The old Additional exercises chapter is removed after moving its exercises.

Reference solutions and tests are included in [bank.json](bank.json). Tiny fixtures are under fixtures/python-course. 33 guided exercises have an exercise-specific starter that is loaded into the student editor for new attempts and Reset code. Independent exercises inherit the language template. Existing student drafts are preserved.

## 1. Python basics

First steps: input, values, strings, collections, decisions, loops and a first function.

1. **Hello, Python!** (easy) — `hello-world`
2. **A personalised greeting** (easy) — `python-input-output`
3. **Variables and two inputs** (easy) — `python-variables-two-inputs`
4. **Add two numbers** (easy) — `python-arithmetic`
5. **Minutes and seconds** (easy) — `python-minutes-seconds`
6. **A result with two decimals** (easy) — `python-two-decimal-mean`
7. **Sequence length** (easy) — `python-sequence-length`
8. **First and last character** (easy) — `python-first-last-character`
9. **A small slice** (easy) — `python-small-slice`
10. **Clean a sample label** (easy) — `python-string-operations`
11. **Make a list** (easy) — `python-lists`
12. **Unpack a tuple** (easy) — `python-unpack-tuple`
13. **Look up a dictionary value** (easy) — `python-dictionaries`
14. **Count unique labels** (easy) — `python-unique-labels`
15. **Above or below the limit** (easy) — `python-limit-check`
16. **Print a numbered range** (easy) — `python-loops`
17. **A countdown** (easy) — `python-countdown`
18. **Your first function** (easy) — `python-functions`

## 2. Strings and collections

Practice indexing, methods, lists, tuples, dictionaries and sets after the basics.

1. **Every third character** (easy) — `python-every-third-character`
2. **Find a sample prefix** (easy) — `python-sample-prefix`
3. **Merge two lists** (easy) — `python-merge-lists`
4. **Parse a measurement record** (medium) — `python-measurement-record`
5. **Update a small inventory** (medium) — `python-update-inventory`
6. **Shared sample labels** (medium) — `python-shared-labels`

## 3. Decisions, loops and comprehensions

Build from branching and iteration to counting, comprehensions and sentinel input.

1. **Classify a measurement** (easy) — `python-conditionals`
2. **Number the samples** (easy) — `python-number-samples`
3. **Count label occurrences** (medium) — `python-count-labels`
4. **Skip comments, stop at END** (medium) — `python-skip-stop`
5. **Transform measurements** (medium) — `python-list-comprehension`
6. **Build two comprehensions** (medium) — `python-two-comprehensions`
7. **A running total** (harder) — `python-running-total`

## 4. Functions and standard modules

Return values, default arguments, imports and small standard-library tools.

1. **A function with a default** (easy) — `python-default-function`
2. **Pair labels and counts** (easy) — `python-pair-counts`
3. **Use a supplied module** (medium) — `python-supplied-module`
4. **Format a fixed timestamp** (medium) — `python-fixed-timestamp`
5. **Extract sample numbers** (medium) — `python-extract-sample-numbers`
6. **Generate sample combinations** (medium) — `python-sample-combinations`
7. **A command-line sampling tool** (harder) — `python-sampling-tool`

## 5. Files and small reports

Read, write, append, organise and filter tiny local files; introduce exceptions.

1. **Count non-empty lines** (easy) — `python-nonempty-lines`
2. **Write an uppercase copy** (easy) — `python-uppercase-copy`
3. **Append a sample** (easy) — `python-append-sample`
4. **List count files** (medium) — `python-list-count-files`
5. **Organise files and compare copies** (medium) — `python-organise-copies`
6. **Filter a CSV table** (medium) — `python-filter-csv`
7. **Handle a missing file** (medium) — `python-missing-file`
8. **Summarise a tiny variant table** (harder) — `python-variant-table`

## 6. Spreadsheets and documents

Read and create small Excel, Word and PDF files using supplied libraries.

1. **Read a worksheet** (easy) — `python-read-worksheet`
2. **Create your first Excel file** (easy) — `python-first-excel-report`
3. **Write a worksheet from CSV** (medium) — `python-write-worksheet`
4. **Create a short Word report** (medium) — `python-short-word-report`
5. **Create a one-page PDF report** (medium) — `python-one-page-pdf-report`

## 7. Python and SQLite

Connect, query, insert and join using tiny local SQLite databases.

1. **Read a small database** (easy) — `python-read-database`
2. **Find one sample safely** (medium) — `python-find-sample`
3. **Insert and commit** (medium) — `python-insert-commit`
4. **Join genes and transcripts** (harder) — `python-join-transcripts`

## 8. Web data and HTML

Build URLs and parse saved JSON, XML and HTML responses without depending on external services.

1. **Build a query URL** (easy) — `python-query-url`
2. **Read a saved API response** (medium) — `python-fetch-pfam-entry`
3. **Read saved search IDs** (medium) — `python-search-ids`
4. **Extract links from saved HTML** (medium) — `python-html-links`
5. **Read a small HTML table** (harder) — `python-html-table`

## 9. Scientific data and plots

Use NumPy, pandas, Biopython and matplotlib with small local datasets.

1. **Inspect a numerical array** (easy) — `python-inspect-array`
2. **Summarise an array** (medium) — `python-summarise-array`
3. **Inspect a CSV with pandas** (easy) — `python-inspect-pandas`
4. **Select and sort measurements** (medium) — `python-select-measurements`
5. **Summarise groups with missing data** (harder) — `python-group-missing-data`
6. **Read a FASTA file** (medium) — `python-read-fasta`
7. **Plot small group counts** (harder) — `python-small-bar-chart`

## 10. Image processing

Inspect and transform tiny images, then introduce grayscale conversion and edge detection.

1. **Inspect an image** (easy) — `python-inspect-image`
2. **Crop a rectangle** (medium) — `python-crop-rectangle`
3. **Flip and rotate** (medium) — `python-flip-rotate`
4. **Make a thumbnail** (medium) — `python-thumbnail`
5. **Convert to grayscale** (medium) — `python-grayscale`
6. **Detect edges in a synthetic image** (harder) — `python-synthetic-edges`

## Scope and grading

- All exercises use local fixtures; no changes to external services are required.
- Output text is compared with the platform’s consistent line-ending/outer-whitespace rules.
- Function returns are tested directly for the default-argument exercise.
- Text/CSV outputs and copied directory contents are checked as files.
- Excel values/types, committed SQLite rows, Word content/headings, PDF text/positions, image pixels and plot appearance use the new artifact checks.
- Each reference is run twice: to generate expected state, then to verify it. Stated console examples and boundary results are checked independently; incorrect answers are rejected. Generated-file tasks also reject a deliberately incorrect file with matching console output.
- The course library versions are pinned by the runtime.
- Tests grade behaviour; they do not prove use of loops, comprehensions, imports or parameterised SQL. Those requirements remain teaching/code-review points.
- Notebooks, environment setup, interactive plots, remote databases and full photograph-based colony detection remain lab activities.
- Existing Python language visibility is preserved.

## Publication and validation

Published on 9 October 2026: 58 new exercises and 15 revised/repositioned exercises, with 227 test cases. All reference cases passed twice; each exercise rejects a wrong answer. All 14 generated-file exercises also reject an incorrect file with matching console output. Six representative saved exercises passed all 18 cases through the running Bitlab service. Chapter and exercise positions were confirmed through MCP.

The previous Additional exercises chapter was removed after moving its exercises. Python is currently disabled for students in the language settings; the bank is available for admin review.

A database backup was created before publication at `/srv/bitlab/data/python-course-backup-jqYZEB/exercises.db`.

# Python function tests and course runtime

Function testing is an additional test-case mode for Python. Existing script exercises and all other languages keep their current mode.

## Deployment on this server

The service runs as `bikc`. Its rootless Podman storage is separate from the development account's storage. Build and activate using the service account and its `.env`; the Node scripts load the same configuration as Bitlab. A tested development image is already available as `localhost/bitlab-python-course:2026.2` in the development account, but this does **not** mean the service account can see it.

Run from `/srv/bitlab`:

```sh
sudo -u bikc /srv/miniconda3/bin/node src/scripts/buildPythonCourse.js
sudo -u bikc /srv/miniconda3/bin/node src/scripts/activatePythonCourse.js
sudo systemctl restart bitlab
```

The activation script first imports all teaching libraries and the PDF reader in the restricted runner, then compares the reference results for every existing Python test using the previous and new images. It refuses to change the runtime if outputs, errors, pass/fail results or generated files differ. It makes a consistent SQLite backup, adds the `function_test`, `artifact_checks` and `network_hosts` columns if necessary, and updates only the Python image configuration. It does not publish exercises or change student progress. The database owner check prevents accidentally selecting an image in another account's rootless storage. `node src/scripts/activatePythonCourse.js --verify-only` performs the compatibility comparison with a read-only database and leaves the live configuration unchanged; it may run under a development account with both images available. Semantic files are compared by content, so differing creation metadata does not block activation.

The normal startup migration also adds these columns for deployments that only want function testing. Existing custom runtime choices are preserved by migrations; the new course image is the default only for newly configured Python languages. To use a different course-image name, set `PYTHON_COURSE_IMAGE` consistently when building and starting the service.

After restarting, refresh the admin page. It reads `/api/admin/capabilities` and offers function and semantic file authoring only when the backend supports it. During an update, an old backend therefore continues offering script tests.

For rollback, select the previous Python image in the language editor and restart the service. On this server it was `python:3.11-alpine`. Keep the new nullable database column: removing it is unnecessary. Do not restore an entire database backup after students have made further progress merely to change an image.

## Authoring a function exercise

In the Python exercise editor, add a test case and choose **Call a function**. Enter:

- Function name, for example `double`.
- Positional arguments as a JSON array, for example `[6]`.
- Keyword arguments as a JSON object, for example `{}` or `{"times":3}`.

Write a reference solution such as:

```python
def double(value):
    return value * 2
```

Testing the solution fills the expected return value (`12` in this example), stderr and exit code. Add separate cases for zero, negative values and other appropriate boundaries. Each case imports a fresh copy of the submission and calls the named function once. An `if __name__ == '__main__'` block is not executed. Top-level definitions/imports still run, so function-only submissions should not contain unguarded `input()` calls.

Function inputs replace script arguments and stdin. Dynamic reference output and database validation queries cannot be combined with function mode. Fixtures and explicitly checked output files remain available.

Student feedback names the function, shows positional/keyword inputs, and compares **Return value**. Debug prints are shown separately, capped at 8,192 characters, and do not become the returned result. stderr still participates in grading. Missing functions, exceptions and unsupported return types have a readable error. A broken function reference is rejected during authoring rather than being saved as the expected error.

Return values can be `None`, booleans, finite numbers, strings, lists, tuples (compared as lists), and dictionaries with string keys. Dictionary key ordering is ignored. Numbers use exact JSON comparison; no floating-point tolerance is implemented. For NumPy/pandas values, return ordinary Python values using `float(...)`, `int(...)` or `.tolist()`. Integers must be within JSON's safe range of ±9,007,199,254,740,991. Large integers should be returned as strings. Inputs and return structures have bounded nesting. This initial mode assesses behaviour, not whether a student used a particular algorithm or library.

The harness is run inside the existing private, non-root container with networking disabled and the same CPU/memory/time/output limits as other programming tests. Only call inputs enter the container; stored expected answers and the reference solution do not. This is ordinary isolated behavioural grading, not a tamper-proof in-process Python interpreter.

## MCP authoring

`bitlab_test_exercise` and `bitlab_save_exercise` accept the same optional test-case field:

```json
{"functionTest":{"name":"double","args":[6],"kwargs":{}}}
```

Expected return values are generated from the reference and verified using the normal runner. Existing exercise schemas without `functionTest` retain script behaviour. The server must be restarted for clients to discover the expanded schema.

## Reproducible Python environment

The image definition lives in `src/runtimes/python-course`. Its official Python base is pinned by digest. `requirements.in` lists ten direct teaching dependencies: NumPy, pandas, Biopython, Pillow, Beautiful Soup, openpyxl, matplotlib, scikit-image, python-docx and reportlab; the grader also installs the pinned pypdfium2/PDFium reader. `requirements.lock` pins all 31 packages and their wheel SHA-256 hashes. The lock targets Linux amd64 and Python 3.11; regenerate it for another architecture.

Scientific thread counts are limited to one. Matplotlib uses the headless `Agg` backend with writable cache locations under `/tmp`. Runtime network access remains disabled. Libraries are installed during the image build, never during student tests.

The checked versions support the proposed exercises, but older slide examples such as `np.int` need updating to supported APIs when writing new descriptions. Four small demonstrator exercises have also been added; lecture material is unchanged.

## Validation

```sh
npm test
RUN_CONTAINER_TESTS=1 node --test src/tests/pythonFunctions.test.js
```

The container tests check multiple function inputs, the distinction between printing and returning, useful missing-function errors, existing script mode, all ten library imports, SQLite and saving an image/plot under the normal runner restrictions. Database tests cover saving/editing function arguments, legacy cases, repeated migration and refusing to move a function test to a non-Python chapter.

Notebook support and private HTTP fixture services remain future features.


## Generated-file content checks and previews

Declare output paths as usual, then select **Excel cells and types**, **SQLite query results** or **Image pixels** for each file in the admin editor. Exact hashes remain the default for existing exercises. Test the reference solution before saving; this stores typed content and a bounded preview. Changing the content-check configuration requires retesting. Admin verification and student grading share the same comparator, and approving a changed reference stores the new file state too.

MCP test cases accept the same `artifactChecks` field, for example:

```json
{
  "outputFiles": ["report.xlsx", "results.db", "image.png"],
  "artifactChecks": [
    {"filename": "report.xlsx", "kind": "xlsx"},
    {"filename": "results.db", "kind": "sqlite", "queries": [
      {"name": "scores", "sql": "SELECT name, score FROM results ORDER BY name", "ordered": true}
    ]},
    {"filename": "image.png", "kind": "image"}
  ]
}
```

- Excel compares worksheet names and populated cell coordinates, values and types. Number `7` differs from string `"7"`. Formatting, archive metadata and empty styled cells are ignored. Formulas are compared as formula text; there is no Excel recalculation engine. Optional `sheets` selects named sheets; otherwise all sheets are checked. Sheet order is ignored.
- SQLite runs instructor-defined named read-only SELECT/WITH queries with optional scalar `parameters`. Column names and typed rows must match. Rows are ordered by default; use explicit SQL `ORDER BY`, or set `ordered: false` to ignore row order while retaining duplicate counts. Only those query results are assessed, not database schema/layout or unqueried tables. SELECT queries can inspect `sqlite_master` if schema matters. Committed WAL data is included. Integer values retain 64-bit precision.
- Images compare dimensions and every decoded RGBA pixel. Encoding, compression and metadata may differ. RGB and fully opaque RGBA representations are equivalent. There is no pixel tolerance: use deterministic small images for exact transformations, not plots whose visual layout can vary. Single-frame Pillow-supported formats can be inspected; feedback thumbnails are always freshly generated PNGs.

Student feedback displays up to 25 specific differences and expected/student previews: cell tables, query rows or image thumbnails. Table previews show the first 20 rows/cells and image previews fit within 256×256; grading checks all data within the limits. Internal full snapshots are excluded from student responses and submission history.

Files are inspected after execution in a separate non-root, network-disabled course container. It receives only the generated binary file (and SQLite WAL), the trusted inspector and check configuration. Student modules, reference code and expected snapshots are not copied into that container. Only regular files inside the workspace are accepted. Read-only SQL authorisation and query-step limits apply in addition to normal container CPU/memory/time limits.

Limits per test: eight checked files, each at most 16 MiB; Excel at most 20 selected sheets and 2,500 populated checked cells (16 MiB expanded ZIP); SQLite at most eight queries, 50 columns and 1,000 returned rows total; images at most 1,000,000 pixels, 512 KiB compressed pixel data and 64 KiB thumbnail. Each snapshot is at most 1 MiB. Large/noisy images may require smaller inputs. Authenticated admin exercise/reference requests allow up to 20 MiB including stored snapshots; split large exercises into smaller cases/exercises if needed.

The inspector requires the course image in the service account's container storage, even when checking files generated by another programming language. Build/activate/restart using the deployment commands above. Existing tests with no content checks retain their current comparisons.

```sh
RUN_CONTAINER_TESTS=1 node --test src/tests/artifacts.test.js src/tests/pythonFunctions.test.js
```


## Word, PDF and plot checks

Additional check kinds are `docx`, `pdf` and `plot`; they use the same isolated artifact inspector, save/retest flow, student previews and admin comparison as other content checks.

- `docx`: compare ordered non-empty body paragraphs and table cells. `headings` defaults to true and checks the built-in Title/Heading styles; set it to false to assess text without heading levels. Blank layout-only paragraphs, fonts, colours, margins, document properties, headers/footers and embedded pictures are ignored. Feedback is an escaped content preview, not a rendered Word page. Limits: 200 content blocks, 128 KiB extracted content, 16 MiB expanded ZIP, 1,000 ZIP members.
- `pdf`: compare page count and normalized text per page (whitespace differences ignored). Set `layout: true` to also compare page dimensions and non-whitespace character bounding boxes; `positionTolerance` defaults to 2 PDF points, with an allowed range 0–10. These are positions of extracted glyph boxes, not checks of font choice, colour or arbitrary graphics. Text inside scanned images is not OCR'd. Page previews are freshly rendered PNGs for the first three pages, with a text excerpt. All pages participate in grading. Limits: 1–10 pages, 10,000 extracted characters, at most 3,000 points per page dimension; the normal file/snapshot/container limits still apply. PDFium rendering runs only in the offline isolated inspector.
- `plot`: compare equal image dimensions and decoded appearance, composited over white to accept equivalent transparent backgrounds. Default `channelTolerance: 3` means a pixel is counted as changed only when a channel differs by more than three; `maxDifferentPixelRatio: 0.005` permits up to 0.5% changed pixels; `maxMeanAbsoluteError: 0.5` bounds mean RGBA channel error. Both thresholds must pass. Configurable maxima are respectively 20, 0.05 and 10. Students see measured differences and chart thumbnails. This is a visual check, not semantic recovery of bars, labels or source data. Grade underlying numbers separately using stdout/function checks, and specify figure size, DPI, labels and layout in the description. Larger font/layout changes are deliberately rejected. The exact `image` mode remains available for pixel transformation exercises.

Example:

```json
{"outputFiles":["report.docx","report.pdf","counts.png"],"artifactChecks":[
  {"filename":"report.docx","kind":"docx","headings":true},
  {"filename":"report.pdf","kind":"pdf","layout":true,"positionTolerance":2},
  {"filename":"counts.png","kind":"plot","channelTolerance":3,"maxDifferentPixelRatio":0.005,"maxMeanAbsoluteError":0.5}
]}
```

PDF text coordinates and rendering use the pinned [pypdfium2 API](https://pypdfium2.readthedocs.io/en/stable/python_api.html). No original DOCX/PDF is embedded in the browser; previews are escaped text or regenerated PNGs.

## Restricted public HTTPS access

Each Python test can specify `networkHosts`, an array of approved **exact** hostnames. Empty/omitted means fully offline. The admin editor offers approved sites and MCP uses the same schema. Student request bodies cannot grant network access.

The starter list matches the course's web-interaction labs:

- `www.ncbi.nlm.nih.gov`: SRA/NCBI web pages.
- `eutils.ncbi.nlm.nih.gov`: NCBI E-utilities JSON/XML requests.
- `www.ebi.ac.uk`: InterPro/Pfam API.
- `rest.kegg.jp`: KEGG REST data.
- `www.kegg.jp` and `www.genome.jp`: KEGG/GenomeNet pages or redirects.

A server operator may extend this list with `BITLAB_NETWORK_HOSTS=host1,host2`, then restart; instructors must still select each hostname explicitly per test. Subdomains and redirect destinations are not implicitly allowed. Only HTTPS port 443 is supported; no plain HTTP, FTP, remote SQL or unrestricted sockets.

```json
{"input":["PF00001"],"networkHosts":["www.ebi.ac.uk"]}
```

The student container still has `--network none`. A trusted loopback forwarder relays the HTTP proxy protocol over a per-run Unix socket to the host's gateway. Only the gateway makes external connections. `HTTP_PROXY`/`HTTPS_PROXY` are set automatically for Python urllib and other proxy-aware clients; clients that ignore proxies have no external route. Explicitly disabling a client's proxy does not enable a bypass. The forwarder requires Python in the runtime; only Python exercises currently expose this feature.

For every CONNECT request, the gateway verifies hostname/port, resolves DNS, rejects any private/reserved destination (IPv4 and IPv6), and connects to the checked IP without resolving it again. It parses the first TLS ClientHello and requires SNI to match that approved hostname before forwarding bytes. TLS stays end-to-end, so normal client certificate validation remains enabled and no interception CA is installed. The hostname rule is a destination/SNI restriction, not a URL-path or HTTP-method rule: HTTPS request bodies are encrypted and the gateway does not enforce GET-only or inspect request/response content. Do not describe these exercises as read-only HTTP sandboxes.

Per-run limits: four simultaneous proxy sockets, twelve approved connection attempts, 4 MiB cumulative tunnel traffic, 128 KiB upload per tunnel, bounded headers/TLS hello, 3-second DNS lookup, 5-second connection setup and 10-second idle timeout, plus the usual script timeout. Proxy directories use the configured `TEMP_DIR` workspace root rather than OS `/tmp`, which may be hidden from the container engine by systemd `PrivateTmp`. Keep this root visible to both the service and container engine. Socket lifecycle is tied to the run; cleanup closes all peers and removes the Unix socket directory. Student feedback reports selected hosts and policy failures. Connections are bounded, but these are not application-request rate limits inside encrypted/reused TLS tunnels.

Use short, stable live API queries; public services may change or be unavailable, so avoid volatile lists and do not make live requests part of unrelated exercise grading. Prefer cached fixtures for deterministic parsing tasks. [NCBI guidance](https://www.ncbi.nlm.nih.gov/books/NBK25497/) limits unkeyed E-utilities requests to three per second per IP; course code must respect provider limits across the class. [InterPro API documentation](https://interpro-documentation.readthedocs.io/en/latest/api.html) identifies the endpoint used in the demo. [KEGG REST](https://www.genome.jp/kegg/rest/) is offered for academic use; include the provider's usage rules in KEGG-specific exercises.

## Demonstrator exercises and verification

Four exercises are saved in Python → Additional exercises after the existing Excel demo:

1. Create a Short Word Report (`python-short-word-report`).
2. Create a One-Page PDF Report (`python-one-page-pdf-report`).
3. Plot Two Sample Counts (`python-small-bar-chart`).
4. Fetch a Pfam Entry from InterPro (`python-fetch-pfam-entry`).

Each has two reference test cases and a cleanly failing incorrect candidate. Their descriptions and reference solutions are in `src/exercise-drafts/python-course-demos.json`. `node src/scripts/createPythonCourseDemos.js` verifies unsaved drafts; `--save` publishes all four atomically after verification and a backup. The script refuses to overwrite existing IDs. No student progress or language-enabled setting is changed. These demos require activation/restart of this update; the saved metadata alone does not update a running server's code.

Additional checks:

```sh
npm test
RUN_CONTAINER_TESTS=1 node --test src/tests/artifacts.test.js src/tests/documentArtifacts.test.js src/tests/pythonFunctions.test.js
RUN_NETWORK_TESTS=1 node --test src/tests/networkAccess.test.js
```

The document tests accept Word font/metadata changes and PDF positions within tolerance, reject changed table values/text positions and blank plots, and verify page previews. Network tests verify exact-host validation, private-address denial, DNS pinning, mismatched SNI denial, cleanup and legacy offline cases; the opt-in live test requests one InterPro accession, then attempts an unapproved site and direct Internet connection.


## Published course bank

The course bank now contains **73 exercises and 227 test cases in 10 ordered chapters**. The full ordered catalogue, difficulty levels and stable IDs are in [the course catalogue](../src/exercise-drafts/python-course-content/README.md). The content source, reference scripts and tiny fixtures are stored alongside that catalogue.

All 15 earlier Python exercise IDs are reused with revised content and placement; 58 new exercises are added. The old Additional exercises chapter is removed after moving its content. The live InterPro demonstration becomes saved JSON parsing so routine grading is independent of API availability. The four original demonstration JSON drafts above are historical examples; their live IDs now use the full bank's definitions and three test cases each.

The sequence is basics, strings/collections, control flow, functions/modules, files, spreadsheets/documents, SQLite, web data/HTML, scientific data/plots, and image processing. Label counting follows loop lessons. Documents follow files, while scientific work and images come later.

Verification runs every reference twice, checks stated console examples and boundary answers, rejects an incorrect answer for every exercise, and rejects a corrupted generated file with matching console output for all 14 file-producing exercises. All 227 reference cases passed. Six representative saved exercises (18 cases) also passed through the running Bitlab MCP service. Exercise and chapter positions were checked after publishing.

`src/scripts/publishPythonCourse.js` uses the same draft schema and authoring service as MCP, with a two-runner verification limit, content/fixture hashes for resumable verification, a database backup, concurrency-change detection, and one publication transaction. It refuses to overwrite fixture paths. Existing unrelated foreign-key issues are tolerated; newly introduced issues abort publication. It preserves the existing Python language visibility setting.

For a fresh platform or verification of the source bank:

```sh
node src/scripts/publishPythonCourse.js --fixtures "$PWD/src/exercise-drafts/python-course-content/fixtures"
```

Add `--save` to publish on a platform without these course fixtures. `--resume` reuses verified drafts only when exercise content, fixture contents and runtime tag match. Do not regenerate fixtures between verification and publication; semantic checks accept equivalent workbook metadata, but cached verification hashes deliberately require the same fixture bytes.

## Bulk verification performance

The admin verifier now uses two exercise workers instead of running the whole language sequentially. Tests within an exercise remain sequential; results retain the saved chapter/exercise order. The existing server execution queue still enforces its configured concurrency cap and shares capacity with student runs. The verification button is disabled during a run, and duplicate clicks do not start another batch. Progress counts completed exercises and lists active ones.

A local Podman benchmark of eight basic Python cases passed in both modes: 7.99 seconds sequentially, 4.86 seconds with two workers (1.65× throughput for this sample). This is not a timing guarantee for the full bank. Artifact inspection, scientific imports and database startup still add work. Every case retains a fresh container and the same grading checks. The change is in the frontend; refresh the admin page to load it, without restarting the server.


## Exercise-specific starter code

Exercises have optional `starter_code` metadata, editable separately from the reference solution. In admin, enable **Use exercise-specific starter code** and edit the code editor beneath it. The editor has line numbers, language highlighting and the same theme as the solution editor. An enabled empty value intentionally starts blank; disabling the override stores null and inherits the language template. Omitted values on API/MCP updates preserve the current override. Starter text is limited to 64 KiB and is never used to generate grading expectations.

Public exercise responses include the raw override and a resolved `code_template` for compatibility. The workspace uses the exercise override for new attempts and Reset code; saved local/server drafts, including deliberately empty drafts, take priority when reopening an exercise. The admin controls are shown only when the backend advertises starter support.

The existing 33 labelled starter blocks were extracted into exercise metadata, and the redundant starter sections were removed from descriptions. All 254 exercises were inspected for explicitly labelled starter sections; the remaining exercises inherit their language template. Solutions, grading tests and student progress were compared with the migration backup and are identical. The reproducible Python bank and generator now contain the starter metadata too.

The schema migration runs at normal startup. `node src/scripts/migrateExerciseStarters.js` previews content changes; `--save` backs up the database, adds the column and migrates starters in one transaction. Running it again is safe. The live migration backup is `/srv/bitlab/data/exercise-starter-backup-1Kjo55/exercises.db`. Restart the Bitlab service after deploying the backend code, then refresh the admin/student pages.

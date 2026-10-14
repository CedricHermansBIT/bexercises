// Instructor help is kept alongside the controls, with one popup outside scrollable panels.
const help = {
 'admin-language-select': 'Choose the programming language or database runtime whose exercises you want to manage. New exercises use the selected language.',
 'exercise-id': 'A unique internal identifier, for example python-short-word-report. Use lowercase letters, numbers and hyphens. It is used in links and saved student progress; choose it before creating the exercise.',
 'exercise-title': 'The exercise name students see in the chapter list. Keep it short and describe the task, for example Create a Short Word Report.',
 'exercise-chapter': 'The chapter that contains this exercise. Select an existing chapter or create one. Place it after the topics students need to complete the task.',
 'exercise-description': 'The instructions students see. Markdown supports headings, lists, code examples and tables. State the input, required output or generated files, and any rules that affect grading.',
 'exercise-use-starter': 'Enable a template just for this exercise. New attempts and Reset code use it; existing saved student code is preserved. Disable it to inherit the language template. An enabled empty template starts with a blank editor.',
 'exercise-starter-code': 'Code shown to students before they solve the exercise, such as imports, a function signature or a supplied caller. Include only scaffolding, not the reference solution. This code is not run to generate expected answers.',
 'exercise-solution': 'The instructor reference solution. Test Solution runs it for every test case to generate expected results. It should satisfy the same instructions as a student submission.',
 fixtures: 'Files supplied before this test runs, such as a CSV or sample database. Select files students need to read. For database exercises, selected SQL or MongoDB fixtures initialize the database. Hold Ctrl/Cmd to select several files.',
 testMode: 'Run script executes the whole program and grades its printed output. Call a function imports a Python submission, calls the named function with JSON inputs, and grades its returned value. Debug prints are shown separately in function mode.',
 functionName: 'The Python function the student must define, for example double. Enter only its name, without parentheses. Use the same name in the exercise instructions.',
 functionArgs: 'Values passed to the function in order, written as a JSON array. For example [6] calls double(6); ["sample A", 3] passes a string and a number. Use [] when there are no positional arguments.',
 functionKwargs: 'Named values passed to the function, written as a JSON object. For example {"times": 3} passes times=3. Use {} when there are no keyword arguments. JSON strings and keys need double quotes.',
 arguments: 'Command-line values passed after the script name. Separate them with commas. For example input.txt, 5 passes two arguments; in Python they are available through sys.argv. This does not supply input() values.',
 input: 'Text supplied to the running program as standard input. Each line is a separate input() or read response. Do not include the prompts printed by the program; those belong to expected output.',
 validationQuery: 'A query run after the submitted database query to inspect its effect. For example SELECT * FROM users ORDER BY id checks inserted rows. Use a stable row order. Test Solution stores the reference result for comparison.',
 expectedValidationOutput: 'The expected result of the validation query after the reference solution runs. Students must produce the same checked database state. This is filled automatically by Test Solution.',
 outputFiles: 'Files, directories or symbolic links the submission must create in its working directory. Separate paths with commas, for example report.docx, counts.png. Choose a check for each file below, then run Test Solution to record the expected result.',
 expectedOutput: 'The reference result, filled by Test Solution. Script mode compares printed output; function mode compares the returned JSON value. Leading/trailing whitespace and Windows/Unix line endings are normalized; content inside the output still matters.',
 expectedOutputFiles: 'A summary of the generated files or paths recorded from the reference solution. Students are graded using the selected file checks. Run Test Solution again after changing a file check or the reference solution.',
 expectedStderr: 'Expected text from the program’s error stream, separate from normal printed output. It is normally empty for a successful program. Unexpected warnings or errors can make a test fail. Test Solution fills this value.',
 expectedExitCode: 'The program’s completion status: 0 usually means success; a nonzero value usually means an error. Students must match the reference status. Test Solution fills this value automatically.',
 useDynamicOutput: 'Run the reference solution again for each student test instead of relying only on saved results. Useful for dates or changing directory contents. It regenerates expected text and file contents and takes extra time. It does not make changing public API data predictable.',
 networkHosts: 'Only the selected exact hostnames are reachable through HTTPS for this test. Leave all unselected for an offline exercise. Select redirect destinations separately. Standard proxy-aware Python clients such as urllib work automatically; direct Internet sockets remain blocked. Live websites can change or be unavailable.',
 queries: 'A JSON array of named read-only database checks. Example: [{"name":"scores","sql":"SELECT name, score FROM results ORDER BY name"}]. Rows are compared in order by default; add "ordered": false to ignore row order while still checking duplicates. Optional "parameters": [7] supplies values for SQL ? placeholders. Only these query results are graded.',
 sheets: 'The Excel worksheets to grade, separated by commas. Leave this empty to check every worksheet. Named sheets must exist; other sheets are ignored when you select specific ones. Cell values, types and formula text are checked; formatting is ignored.',
 headings: 'Also compare Word heading levels, such as Heading 1 versus Heading 2, using the reference document. Turn this off to check only body text and table cells. Fonts, margins, headers, footers and pictures are not checked by this mode.',
 layout: 'Also compare PDF page dimensions and the positions of extracted text characters. Page count and text are always checked. Use this when the instructions specify text placement. It does not assess arbitrary graphics or text inside scanned images.',
 positionTolerance: 'How far a PDF text character or page dimension may differ from the reference, measured in points. One point is 1/72 inch. The default 2 allows small position differences; 0 requires the same measured positions. Allowed range: 0–10. Used only when position checking is enabled.',
 channelTolerance: 'A pixel has red, green, blue and transparency values from 0 to 255. This is the allowed difference in any one of those values before the pixel is counted as changed. With the default 3, red changing from 100 to 103 is ignored; 100 to 104 counts as changed. The average-error limit below still applies. Allowed range: 0–20.',
 maxDifferentPixelRatio: 'The largest share of plot pixels allowed to count as changed after channel tolerance is applied. Enter a fraction: 0.005 means 0.5%, or 5 pixels out of 1,000. The default is 0.005; 0 permits no changed pixels. Allowed range: 0–0.05 (5%). The average-error limit must pass too.',
 maxMeanAbsoluteError: 'The largest average difference across all red, green, blue and transparency values in the plot, on a 0–255 scale. This catches small colour changes spread across the whole image, even if few pixels count as changed. The default is 0.5; lower values are stricter. Allowed range: 0–10. Both plot limits must pass.',
};
const fileHelp = {
 hash: 'Exact file hash compares the file bytes. Even metadata changes can cause a mismatch. Use a content check for Excel, Word, PDF, images or plots when equivalent files should pass. Directories are checked by their contents and links by their target.',
 xlsx: 'Compare worksheet names and populated cell values and types. Numeric 7 differs from text "7". Formatting and file metadata are ignored. Formulas are compared as text, not recalculated. You can select which sheets to check below.',
 sqlite: 'Run your named read-only queries against the generated SQLite file and compare their columns and typed rows. Database file layout and unqueried data are ignored. Configure the queries below; use ORDER BY for predictable ordered results.',
 image: 'Compare image dimensions and every decoded pixel exactly. Compression, file format and metadata may differ; changed pixel colours fail. Use this for precise image transformations. Plot appearance is a separate mode with tolerances.',
 docx: 'Compare the order of non-empty body paragraphs and table cells in the Word document. Heading levels are checked unless disabled below. Fonts, page layout, headers, footers and embedded pictures are ignored. Feedback shows a content preview.',
 pdf: 'Compare page count and extracted text on each PDF page, ignoring whitespace differences and file metadata. Enable the option below to check page sizes and text positions too. Feedback shows page previews; scanned text is not read by OCR.',
 plot: 'Compare plot dimensions and visual appearance against the reference, allowing the small differences configured below. Transparent backgrounds are compared over white. This does not recover or grade the plotted data itself; check those values separately using printed output or a function test.',
};
const controllers = new WeakMap();

function helpController(document) {
 if (controllers.has(document)) return controllers.get(document);
 const tooltip = document.createElement('div');
 tooltip.id = 'admin-exercise-help-tooltip';
 tooltip.className = 'admin-help-tooltip';
 tooltip.setAttribute('role', 'tooltip');
 tooltip.hidden = true;
 document.body.appendChild(tooltip);
 let active = null, pinned = false, timer;
 const hide = () => {
  clearTimeout(timer);
  active?.removeAttribute('aria-describedby');
  active?.setAttribute('aria-expanded', 'false');
  active = null; pinned = false; tooltip.hidden = true;
 };
 const show = (button, text) => {
  clearTimeout(timer);
  if (active !== button) { hide(); active = button; }
  tooltip.textContent = text;
  tooltip.hidden = false;
  button.setAttribute('aria-describedby', tooltip.id);
  button.setAttribute('aria-expanded', 'true');
  const box = button.getBoundingClientRect(), size = tooltip.getBoundingClientRect();
  const view = document.defaultView;
  tooltip.style.left = `${Math.max(8, Math.min(box.left, view.innerWidth - size.width - 8))}px`;
  const below = box.bottom + 8;
  tooltip.style.top = `${Math.max(8, below + size.height <= view.innerHeight - 8 ? below : box.top - size.height - 8)}px`;
 };
 const scheduleHide = () => { if (!pinned) timer = setTimeout(hide, 150); };
 tooltip.addEventListener('pointerenter', () => clearTimeout(timer));
 tooltip.addEventListener('pointerleave', scheduleHide);
 document.addEventListener('keydown', event => { if (event.key === 'Escape') hide(); });
 document.addEventListener('click', event => {
  if (!tooltip.contains(event.target) && !event.target.closest('.admin-help-trigger')) hide();
 });
 document.addEventListener('scroll', event => { if (!tooltip.contains(event.target)) hide(); }, true);
 document.defaultView.addEventListener('resize', hide);
 const controller = { hide, attach(button, text) {
  button.addEventListener('pointerenter', () => show(button, text));
  button.addEventListener('pointerleave', scheduleHide);
  button.addEventListener('focus', () => show(button, text));
  button.addEventListener('blur', scheduleHide);
  button.addEventListener('click', () => {
   if (active === button && pinned) hide();
   else { show(button, text); pinned = true; }
  });
 } };
 controllers.set(document, controller);
 return controller;
}

export function installExerciseHelp(root) {
 const document = root.ownerDocument || root;
 const controller = helpController(document);
 controller.hide();
 root.querySelectorAll('label').forEach(label => {
  if (label.parentElement.classList.contains('admin-field-label')) return;
  const control = (label.htmlFor && document.getElementById(label.htmlFor))
   || label.querySelector('input') || label.nextElementSibling;
  if (!control) return;
  let text;
  if (control.hasAttribute('data-artifact-mode')) text = fileHelp[control.value];
  else text = help[control.id || control.dataset.key || control.dataset.field
   || (control.hasAttribute('data-artifact-queries') ? 'queries' : control.hasAttribute('data-artifact-sheets') ? 'sheets' : '')];
  if (!text) return;
  const row = document.createElement('div');
  row.className = 'admin-field-label';
  label.before(row); row.appendChild(label);
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'admin-help-trigger'; button.textContent = '?';
  button.setAttribute('aria-label', `Help for ${label.textContent.trim().replace(/\s+/g, ' ')}`);
  button.setAttribute('aria-expanded', 'false');
  row.appendChild(button);
  controller.attach(button, text);
 });
}

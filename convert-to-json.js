// convert-to-json.js
// Reads exercises-data.js (which defines `const exercises = [...]`) and writes exercises-internal.json

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const srcPath = path.join(__dirname, 'frontend/exercises-data.js');
const outPath = path.join(__dirname, 'exercises-internal.json');

if (!fs.existsSync(srcPath)) {
  console.error('Error: exercises-data.js not found in', __dirname);
  process.exit(2);
}

const src = fs.readFileSync(srcPath, 'utf8');

// Create a clean sandbox and evaluate the file there.
// This allows the file to use JS features like template literals safely.
const sandbox = { console: console, exports: {}, module: {}, require: require };
vm.createContext(sandbox);

try {
  // Run the source; it should define `exercises`.
  vm.runInContext(src + '\n;exports = (typeof exercises !== "undefined") ? exercises : (module && module.exports) || exports;', sandbox, { filename: 'exercises-data.js' });

  const exercises = sandbox.exports || sandbox.module && sandbox.module.exports || sandbox.exercises;

  if (!exercises) {
    console.error('Error: could not find `exercises` variable after evaluating the file.');
    process.exit(3);
  }

  fs.writeFileSync(outPath, JSON.stringify(exercises, null, 2), 'utf8');
  console.log('Wrote', outPath);
} catch (err) {
  console.error('Evaluation error:', err);
  process.exit(1);
}


// Test case statement handling in the custom bash interpreter
const { BashRunner } = require('./bash-interpreter.js');

(async function() {
  const runner = new BashRunner();
  const script = `#!/bin/bash

choice="$1"

case "$choice" in
    red)
        echo "You chose the red pill. Welcome to the Matrix!"
        ;;
    blue)
        echo "You chose the blue pill. Enjoy your reality!"
        ;;
    green)
        echo "You chose the green pill. Time to go green!"
        ;;
    *)
        echo "Invalid choice. Please choose red, blue, or green."
        ;;
esac`;

  const tests = [
    { args: ['red'], expected: 'You chose the red pill. Welcome to the Matrix!' },
    { args: ['blue'], expected: 'You chose the blue pill. Enjoy your reality!' },
    { args: ['green'], expected: 'You chose the green pill. Time to go green!' },
    { args: ['yellow'], expected: 'Invalid choice. Please choose red, blue, or green.' }
  ];

  let passCount = 0;
  for (const t of tests) {
    const res = await runner.executeScript(script, t.args, []);
    const out = res.output.trim();
    const pass = out === t.expected;
    if (pass) passCount++;
    console.log(`args=${t.args[0]} => ${pass ? 'PASS' : 'FAIL'}`);
    if (!pass) {
      console.log('  expected:', t.expected);
      console.log('  got     :', out);
    }
  }
  console.log(`\nSummary: ${passCount}/${tests.length} passed`);
})();

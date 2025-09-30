// Debug string concatenation in bash interpreter
const { BashRunner } = require('./bash-interpreter.js');

(async () => {
  const runner = new BashRunner();

  // Test basic concatenation
  const script1 = '#!/bin/bash\n'
    + 'var1="hello"\n'
    + 'var2="world"\n'
    + 'concat="$var1$var2"\n'
    + 'echo "$concat"\n';

  console.log("Test 1 - Basic concatenation:");
  const res1 = await runner.executeScript(script1, [], []);
  console.log('Output:', JSON.stringify(res1.output.trim()), 'Exit code:', res1.exitCode);

  // The original test case from test_concat_substring.js
  const script2 = '#!/bin/bash\n'
    + 'input_string="$1"\n'
    + 'reversed_string=""\n'
    + 'for (( i=${#input_string}-1; i>=0; i-- )); do\n'
    + '  reversed_string="$reversed_string${input_string:$i:1}"\n'
    + 'done\n'
    + 'echo "$reversed_string"\n';

  console.log("\nTest 2 - Original test case (string reversal):");
  const res2 = await runner.executeScript(script2, ['abcd'], []);
  console.log('Output:', JSON.stringify(res2.output.trim()), 'Exit code:', res2.exitCode);

  // Test the string reversal part specifically
  const script3 = '#!/bin/bash\n'
    + 'input_string="abcd"\n'
    + 'reversed_string=""\n'
    + 'for (( i=${#input_string}-1; i>=0; i-- )); do\n'
    + '  char=${input_string:$i:1}\n'
    + '  echo "i=$i, char=$char, current=$reversed_string"\n'
    + '  reversed_string="$reversed_string$char"\n'
    + '  echo "After append: $reversed_string"\n'
    + 'done\n'
    + 'echo "Final: $reversed_string"\n';

  console.log("\nTest 3 - Debugging string reversal with output at each step:");
  const res3 = await runner.executeScript(script3, [], []);
  console.log('Output:', JSON.stringify(res3.output), 'Exit code:', res3.exitCode);
})();

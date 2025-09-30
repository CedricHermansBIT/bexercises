// Modified test case with detailed logging
const { BashRunner } = require('./bash-interpreter.js');

(async () => {
  const runner = new BashRunner();

  // The original test case from test_concat_substring.js with more logging
  const script = '#!/bin/bash\n'
    + 'input_string="$1"\n'
    + 'echo "Input string: \'$input_string\', length: ${#input_string}"\n'
    + 'reversed_string=""\n'
    + 'for (( i=${#input_string}-1; i>=0; i-- )); do\n'
    + '  char=${input_string:$i:1}\n'
    + '  echo "i=$i, char=\'$char\'"\n'
    + '  reversed_string="$reversed_string$char"\n'
    + '  echo "Current reversed_string: \'$reversed_string\'"\n'
    + 'done\n'
    + 'echo "Final result: $reversed_string"\n';

  console.log("Running string reversal test with detailed logging:");
  const res = await runner.executeScript(script, ['abcd'], []);
  console.log('Output:', JSON.stringify(res.output.trim()), 'Exit code:', res.exitCode);
})();

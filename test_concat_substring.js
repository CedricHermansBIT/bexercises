// filepath: \\wsl.localhost\kali-linux\home\cedric\BIT01_dodona\test_concat_substring.js
const { BashRunner } = require('./bash-interpreter.js');

(async () => {
  const runner = new BashRunner();
  const script = '#!/bin/bash\n'
    + 'input_string="$1"\n'
    + 'reversed_string=""\n'
    + 'for (( i=${#input_string}-1; i>=0; i-- )); do\n'
    + '  reversed_string="$reversed_string${input_string:$i:1}"\n'
    + 'done\n'
    + 'echo "$reversed_string"\n';
  const res = await runner.executeScript(script, ['abcd'], []);
  console.log('OUT:', JSON.stringify(res.output.trim()), 'EXIT:', res.exitCode);
})();


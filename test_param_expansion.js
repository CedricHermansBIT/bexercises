const { BashRunner } = require('./bash-interpreter.js');

(async () => {
  const runner = new BashRunner();
  async function run(script, args=[]) {
    const res = await runner.executeScript(script, args, []);
    return { out: res.output.replace(/\r?\n+$/,''), exit: res.exitCode };
  }

  // Test % and %% suffix removal
  let script = '#!/bin/bash\n'
             + 'input_string="$1"\n'
             + 'echo "Original: $input_string"\n'
             + 'echo "${input_string%World*}"\n'
             + 'echo "${input_string%%World*}"';
  let r = await run(script, ['HelloWorldWorldX']);
  console.log('Suffix removal:', JSON.stringify(r));

  // Test # and ## prefix removal
  script = '#!/bin/bash\n'
         + 'v="$1"\n'
         + 'echo "${v#*b}"\n'
         + 'echo "${v##a*}"';
  r = await run(script, ['abcabcX']);
  console.log('Prefix removal:', JSON.stringify(r));

  // Test substitution forms
  script = '#!/bin/bash\n'
         + 'v="abcabcabc"\n'
         + 'echo "${v/ab/X}"\n'
         + 'echo "${v//ab/X}"\n'
         + 'echo "${v/#ab/X}"\n'
         + 'echo "${v/%bc/X}"';
  r = await run(script);
  console.log('Substitution:', JSON.stringify(r));

  // Test escaped delimiter and // global
  script = '#!/bin/bash\n'
         + 'p="/foo/bar/baz"\n'
         + 'echo "${p//\\\//-}"'; // replace / with - (\\/ becomes \/ in the bash script)
  r = await run(script);
  console.log('Escaped slash:', JSON.stringify(r));
})();

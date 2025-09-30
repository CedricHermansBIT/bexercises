const { BashRunner } = require('./bash-interpreter.js');

(async () => {
  const script = `#!/bin/bash
count=0
while read line
do
  count=$((count+1))
  if [ $((count % 2)) -eq 0 ]
  then
    echo $line
  fi
done < test.txt
`;
  const runner = new BashRunner();
  const res = await runner.executeScript(script, [], []);
  console.log('exit=', res.exitCode);
  console.log(res.output);
  if (res.error) console.error('stderr:', res.error);
})();


const { BashRunner } = require('./bash-interpreter.js');
const fs = require('fs');

(async () => {
  const script = fs.readFileSync('./For Loop/solution/solution.en.txt','utf8');
  const runner = new BashRunner();
  for (const height of ['5','3']) {
    const result = await runner.executeScript(script, [height], []);
    console.log(`--- height=${height} exit=${result.exitCode} ---`);
    console.log(result.output);
    console.log('-------------------------------');
  }
})();


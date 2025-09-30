const { BashRunner } = require('./bash-interpreter.js');
const fs = require('fs');

(async () => {
  const script = fs.readFileSync('./Raindrops/solution/solution.en.txt','utf8');
  const runner = new BashRunner();
  const cases = ['28','30','34','105','13','21'];
  for (const n of cases) {
    const result = await runner.executeScript(script, [n], []);
    console.log(`--- n=${n} exit=${result.exitCode} ---`);
    console.log(result.output);
  }
})();


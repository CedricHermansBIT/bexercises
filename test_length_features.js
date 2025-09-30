const { BashRunner } = require('./bash-interpreter.js');
const fs = require('fs');
(async () => {
  const reverse = fs.readFileSync('./Reverse strings/solution/solution.en.txt','utf8');
  const hamming = fs.readFileSync('./Hamming distance/solution/solution.en.txt','utf8');
  const runner = new BashRunner();
  const tests = [
    { script: reverse, args:['hello'], label:'reverse hello'},
    { script: reverse, args:['abc'], label:'reverse abc'},
    { script: hamming, args:['AAAA','AAAT'], label:'hamming 1 diff'},
    { script: hamming, args:['AAA','AAAA'], label:'hamming length mismatch'},
    { script: hamming, args:['GATTACA','GACTATA'], label:'hamming multi diff'}
  ];
  for (const t of tests) {
    const res = await runner.executeScript(t.script, t.args, []);
    console.log('---', t.label, 'args='+t.args.join(' '),'exit='+res.exitCode+' ---');
    console.log(res.output.trim());
  }
})();


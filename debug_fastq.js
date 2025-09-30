const { BashRunner } = require('./bash-interpreter.js');
const fs = require('fs');

(async () => {
  const script = fs.readFileSync('./FASTQ File Summary/solution/solution.en.txt','utf8');
  const runner = new BashRunner();
  const result1 = await runner.executeScript(script, [], ["FASTQ.txt","output_file.txt"]);
  console.log('--- FASTQ existing file exit='+result1.exitCode+' ---');
  console.log(result1.output);
  if (result1.error) console.error('stderr:', result1.error);

  const result2 = await runner.executeScript(script, [], ["FASTQ2.txt","output_file.txt"]);
  console.log('--- FASTQ missing file exit='+result2.exitCode+' ---');
  console.log(result2.output);
  if (result2.error) console.error('stderr:', result2.error);
})();


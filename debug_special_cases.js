// Debug script for special cases: echo ... | tee -a ... and $(grep -o ... | wc -l)
const { BashRunner } = require('./bash-interpreter.js');

(async function() {
  const runner = new BashRunner();
  let script = `
    line="ABCDEF"
    output_file="output_file.txt"
    # Ensure output file starts empty
    > "$output_file"
    echo $line | tee -a $output_file
    echo $line | tee -a $output_file
    echo "--FILE CONTENT--"
    cat $output_file
  `;
  const res1 = await runner.executeScript(script, [], []);
  console.log('--- Echo | tee -a ---');
  console.log(res1.output);

  const runner2 = new BashRunner();
  script = `
    file=minefield.txt
    mine_count=$(grep -o "*" "$file" | wc -l)
    echo $mine_count
  `;
  const res2 = await runner2.executeScript(script, [], []);
  console.log('--- $(grep -o ... | wc -l) ---');
  console.log(res2.output);
})();


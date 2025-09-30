// Test string reversal with concatenation
const { BashRunner } = require('./bash-interpreter.js');

(async function() {
  const runner = new BashRunner();

  // Simple test that just reverses "abcd" and should output "dcba"
  const script = `
    input_string="abcd"
    reversed_string=""
    for (( i=${#input_string}-1; i>=0; i-- )); do
      reversed_string="$reversed_string${input_string:$i:1}"
    done
    echo "$reversed_string"
  `;

  console.log("Running string reversal test...");
  const result = await runner.executeScript(script, [], []);
  console.log("Result:", result.output.trim());
  console.log("Expected: dcba");
})();

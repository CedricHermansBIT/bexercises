const { BashRunner } = require('./bash-interpreter.js');

(async () => {
  const bash = new BashRunner();
  const script = `while true\n do\n  read -p "Enter your name: " name\n  if [ "$name" = "quit" ]; then\n   echo "Goodbye!"\n   break\n  else\n   echo "Hello, $name!"\n  fi\n done`;
  const inputs = ["Alice", "Bob", "quit"]; // Should greet Alice and Bob, then Goodbye and exit
  const result = await bash.executeScript(script, [], inputs);
  console.log('--- OUTPUT START ---');
  console.log(result.output); // Display raw output
  console.log('--- OUTPUT END ---');
})();


// Exercise data converted from Dodona format
const exercises = [
    {
        id: "case-statements",
        title: "Case Statements",
        description: `Write a bash script that takes a single argument and uses a case statement to perform different actions based on the value of the argument. The script should:

1. Print “You chose the red pill. Welcome to the Matrix!” if the argument is “red”.
2. Print “You chose the blue pill. Enjoy your reality!” if the argument is “blue”.
3. Print “You chose the green pill. Time to go green!” if the argument is “green”.
4. Print “Invalid choice. Please choose red, blue, or green.” for any other argument.

## Example Output:

\`\`\`console?lang=bash&promtp=$
$ ./case.sh red
You chose the red pill. Welcome to the Matrix!

$ ./case.sh blue
You chose the blue pill. Enjoy your reality!

$ ./case.sh green
You chose the green pill. Time to go green!

$ ./case.sh yellow
Invalid choice. Please choose red, blue, or green.
\`\`\`
`,
        solution: `#!/bin/bash

choice="$1"

case "$choice" in
    red)
        echo "You chose the red pill. Welcome to the Matrix!"
        ;;
    blue)
        echo "You chose the blue pill. Enjoy your reality!"
        ;;
    green)
        echo "You chose the green pill. Time to go green!"
        ;;
    *)
        echo "Invalid choice. Please choose red, blue, or green."
        ;;
esac
`,
        testCases: [
            {
                arguments: ["red"],
                expectedOutput: "You chose the red pill. Welcome to the Matrix!\n",
                expectedExitCode: 0
            },
            {
                arguments: ["blue"],
                expectedOutput: "You chose the blue pill. Enjoy your reality!\n",
                expectedExitCode: 0
            },
            {
                arguments: ["green"],
                expectedOutput: "You chose the green pill. Time to go green!\n",
                expectedExitCode: 0
            },
            {
                arguments: ["yellow"],
                expectedOutput: "Invalid choice. Please choose red, blue, or green.\n",
                expectedExitCode: 0
            },
            {
                arguments: ["Hello"],
                expectedOutput: "Invalid choice. Please choose red, blue, or green.\n",
                expectedExitCode: 0
            },
        ]
    },
    {
        id: "script-args2",
        title: "Command line argument verification",
        description: `Write a bash script that prints "My name is $1 and I am $2 years old." where $1 and $2 are the first and second arguments passed to the script, respectively. The script should not print any additional characters or whitespace.

Additionally, check that the number of arguments passed to the script is exactly 2. If the number of arguments is different, print the following error message: "name_of_script_here error: you must supply two arguments" (where \`name_of_script_here\` is the name of the script, dynamically determined).

\`\`\`console?lang=bash&promtp=$
$ ./script-args Alice
"name_of_script_here error: you must supply two arguments" 
$ echo $?
1
$ ./script-args Alice 30
My name is Alice and I am 30 years old.
$ echo $?
0
$ ./script-args Alice 30 40
"name_of_script_here error: you must supply two arguments"
$ echo $?
1
\`\`\``,
        solution: `#!/bin/bash
if [ $# -ne 2 ] 
then
    echo "$0 error: you must supply two arguments" 
    exit 1
else
    echo "My name is $1 and I am $2 years old." 
fi
`,
        testCases: [
            {
                arguments: ["John"],
                expectedOutput: "script.sh error: you must supply two arguments",
                expectedExitCode: 1
            },
            {
                arguments: ["Alice", "25"],
                expectedOutput: "My name is Alice and I am 25 years old.",
                expectedExitCode: 0
            },
            {
                arguments: ["Bob", "40", "50"],
                expectedOutput: "script.sh error: you must supply two arguments",
                expectedExitCode: 1
            },
        ]
    },
    {
        id: "script-args",
        title: "Command line arguments",
        description: `Write a bash script that prints "My name is $1 and I am $2 years old." where $1 and $2 are the first and second arguments passed to the script, respectively. The script should not print any additional characters or whitespace.

\`\`\`console?lang=bash&promtp=$
$ ./script-args Alice 30
My name is Alice and I am 30 years old.
\`\`\``,
        solution: `echo "My name is $1 and I am $2 years old.`,
        testCases: [
            {
                arguments: ["John", "30"],
                expectedOutput: "My name is John and I am 30 years old.",
                expectedExitCode: 0
            },
            {
                arguments: ["Alice", "25"],
                expectedOutput: "My name is Alice and I am 25 years old.",
                expectedExitCode: 0
            },
            {
                arguments: ["Bob", "40"],
                expectedOutput: "My name is Bob and I am 40 years old.",
                expectedExitCode: 0
            },
        ]
    },
    {
        id: "continuous-name-prompt",
        title: "Continuous Name Prompt",
        description: `Write a bash script that uses a while loop to continuously prompt the user for their name until they enter “quit” to exit. Use the read -p option for the prompt.

## Example Output:

\`\`\`console?lang=bash&promtp=$
$ ./name_prompt.sh
Enter your name: Alice
Hello, Alice!
Enter your name: Bob
Hello, Bob!
Enter your name: quit
Goodbye!
\`\`\`
`,
        solution: `#!/bin/bash

while true
do
    read -p "Enter your name: " name
    if [ "$name" = "quit" ]; then
        echo "Goodbye!"
        break
    else
        echo "Hello, $name!"
    fi
done
`,
        testCases: [
            {
                arguments: [],
                expectedOutput: "Hello, Alice!\nHello, Bob!\nGoodbye!\n",
                expectedExitCode: 0,
                input: ["Alice", "Bob", "quit"]
            },
            {
                arguments: [],
                expectedOutput: "Hello, Alice!\nHello, Bob!\nHello, Charlie!\nGoodbye!\n",
                expectedExitCode: 0,
                input: ["Alice", "Bob", "Charlie", "quit"]
            },
            {
                arguments: [],
                expectedOutput: "Goodbye!\n",
                expectedExitCode: 0,
                input: ["quit"]
            },
        ]
    },
    {
        id: "fastq-file-summary",
        title: "FASTQ File Summary",
        description: `The FASTQ format is a text-based format for storing both a biological sequence (usually nucleotide sequence) and its corresponding quality scores.

A FASTQ file normally uses four lines per sequence:

- Line 1 begins with a ‘@’ character and is followed by a sequence identifier and an optional description (like a FASTA title line).
- Line 2 is the raw sequence letters.
- Line 3 begins with a ‘+’ character and is optionally followed by the same sequence identifier (and any description) again.
- Line 4 encodes the quality values (using ASCII characters) for the sequence in Line 2 and must contain the same number of symbols as letters in the sequence.
To summarize the information in a FASTQ file, write a script called FASTQ_summary.sh that:

1. Asks for the name of a FASTQ file (e.g., FASTQ.txt) and the name of an output file (e.g., output_file.txt) in an interactive way.
2. Iterates over the FASTQ file and adds the raw sequences (line numbers 2) to the output file.
3. Also print the sequences to the standard output.

## Example Output:

\`\`\`console?lang=bash&promtp=$
$ ./FASTQ_summary.sh
Enter the name of the FASTQ file: FASTQ.txt
Enter the name of the output file: output_file.txt
Processing FASTQ.txt...
TGTTGAATTGAGAGCTTGTGTTNAGTAGATAGTTGA	
CCCACGTATCCAAGTCGAAGAGNAATTGATTTTCCC	
AGGGAGGGAGGGAGTGAGATTGNTTCGATCGCCAAT	
CTGGGTTTTTGTGTTATTGAGANTCTGAGTTTGAGA	
TTGTTCCTTGACGAGATTGGTGNGGCTTACGATGAG	
GATCGGAAGAGCTCGTATGCCGNCTTCTGCTTGAAA	
GCATCGAAGCCAACCTCGAACTNCTGGCCGTGGCCG	
TAAGCGTGTGGATCTAAACAATNACAAGGAGACTTT	
TATCGTCGCTATCGGGAGCTTTNTCTAGATCGGAAG	
TGCCGTTGATTAGTCCATTCTCNGAAGGAGAGATAC	
ATGTCTCGCAAACCGGAAAACANACGTTAAGTCCGG	
GTCCCTCGTTTACAGACTCAGANGTGAATAGAAAAG
Sequences have been written to output_file.txt

$ ./FASTQ_summary.sh
Enter the name of the FASTQ file: FASTQ2.txt
Enter the name of the output file: output_file.txt
Error: FASTQ2.txt does not exist.

$ echo $?
1
\`\`\`
`,
        solution: `#!/bin/bash

read -p "Enter the name of the FASTQ file: " fastq_file
read -p "Enter the name of the output file: " output_file

if [ ! -f "$fastq_file" ]; then
    echo "Error: $fastq_file does not exist."
    exit 1
fi

echo "Processing $fastq_file..."
# Clear the output file
> "$output_file"

i=0
while read line
do
    i=$((i+1))
    if [ $((i%4)) -eq 2 ]
    then
        echo $line | tee -a $output_file
    fi
done < $fastq_file

echo "Sequences have been written to output_file.txt"`,
        testCases: [
            {
                arguments: [],
                expectedOutput: "Processing FASTQ.txt...\nTGTTGAATTGAGAGCTTGTGTTNAGTAGATAGTTGA\nCCCACGTATCCAAGTCGAAGAGNAATTGATTTTCCC\nAGGGAGGGAGGGAGTGAGATTGNTTCGATCGCCAAT\nCTGGGTTTTTGTGTTATTGAGANTCTGAGTTTGAGA\nTTGTTCCTTGACGAGATTGGTGNGGCTTACGATGAG\nGATCGGAAGAGCTCGTATGCCGNCTTCTGCTTGAAA\nGCATCGAAGCCAACCTCGAACTNCTGGCCGTGGCCG\nTAAGCGTGTGGATCTAAACAATNACAAGGAGACTTT\nTATCGTCGCTATCGGGAGCTTTNTCTAGATCGGAAG\nTGCCGTTGATTAGTCCATTCTCNGAAGGAGAGATAC\nATGTCTCGCAAACCGGAAAACANACGTTAAGTCCGG\nGTCCCTCGTTTACAGACTCAGANGTGAATAGAAAAG\nSequences have been written to output_file.txt\n",
                expectedExitCode: 0,
                input: ["FASTQ.txt", "output_file.txt"]
            },
            {
                arguments: [],
                expectedOutput: "Error: FASTQ2.txt does not exist.\n",
                expectedExitCode: 1,
                input: ["FASTQ2.txt", "output_file.txt"]
            },
        ]
    },
    {
        id: "file-tests",
        title: "File Tests",
        description: `Write a bash script that takes a file path as an argument and performs the following file tests using if, then, else, and elif syntax:

1. Check if the file exists and is a regular file.
   - If not, print "<file_name> does not exist or is not a regular file." Exit with status 1.
2. Check if the file is readable.
3. Check if the file is writable.
4. Check if the file is executable.

## Example Output:

\`\`\`console?lang=bash&promtp=$
$ ./file_tests.sh testfile
testfile is a regular file
testfile is readable
testfile is writable
testfile is executable
$ echo $?
0

$ ./file_tests.sh nonexistentfile
nonexistentfile does not exist or is not a regular file
$ echo $?
1
\`\`\``,
        solution: `#!/bin/bash

file_path="$1"

if [ -f "$file_path" ]; then
    echo "$file_path is a regular file"
else
    echo "$file_path does not exist or is not a regular file"
    exit 1
fi

if [ -r "$file_path" ]; then
    echo "$file_path is readable"
else
    echo "$file_path is not readable"
fi
if [ -w "$file_path" ]; then
    echo "$file_path is writable"
else
    echo "$file_path is not writable"
fi
if [ -x "$file_path" ]; then
    echo "$file_path is executable"
else
    echo "$file_path is not executable"
fi
`,
        testCases: [
            {
                arguments: ["testfile"],
                expectedOutput: "testfile is a regular file\ntestfile is readable\ntestfile is writable\ntestfile is executable\n",
                expectedExitCode: 0
            },
            {
                arguments: ["nonexistentfile"],
                expectedOutput: "nonexistentfile does not exist or is not a regular file\n",
                expectedExitCode: 1
            },
            {
                arguments: ["testfile2"],
                expectedOutput: "testfile2 is a regular file\ntestfile2 is readable\ntestfile2 is writable\ntestfile2 is not executable\n",
                expectedExitCode: 0
            },
        ]
    },
    {
        id: "for-loop",
        title: "For Loop",
        description: `Write a bash script that takes a single argument representing the height of a triangle and uses a for loop with the seq command to print a triangle of asterisks (*).

## Example Output:

\`\`\`console?lang=bash&promtp=$
$ ./for_loop_triangle.sh 5
*
**
***
****
*****

$ ./for_loop_triangle.sh 3
*
**
***
\`\`\`
`,
        solution: `#!/bin/bash

height="$1"

for i in $(seq 1 "$height")
do
    for j in $(seq 1 "$i")
    do
        echo -n "*"
    done
    echo ""
done
`,
        testCases: [
            {
                arguments: ["5"],
                expectedOutput: "*\n**\n***\n****\n*****\n",
                expectedExitCode: 0
            },
            {
                arguments: ["3"],
                expectedOutput: "*\n**\n***\n",
                expectedExitCode: 0
            },
        ]
    },
    {
        id: "hamming-distance",
        title: "Hamming distance",
        description: `Write a bash script that takes two DNA strands as arguments and calculates the Hamming distance between them. The Hamming distance is the number of differences between two sequences of equal length. If the sequences are of different lengths, the script should print an error message and exit.

Tip: You can iterate over strings in bash using a for loop with seq (to the number of characters, which you get by using \${#string}) to access each character by its index. You can access the character at index i in a string by using \${string:i:1}.

## Example Output:

\`\`\`console?lang=bash&promtp=$
$ ./hamming_distance.sh GAGCCTACTAACGGGAT CATCGTAATGACGGCCT
The Hamming distance is 7
$ ./hamming_distance.sh GAGCCTACTAACGGGAT CATCGTAATGACGGCC
Error: Sequences must be of equal length

\`\`\`
`,
        solution: `#!/bin/bash

strand1="$1"
strand2="$2"

if [ \${#strand1} -ne \${#strand2} ]; then
    echo "Error: Sequences must be of equal length"
    exit 1
fi

hamming_distance=0

for i in $(seq 0 $((\${#strand1} - 1)))
do
    if [ "\${strand1:$i:1}" != "\${strand2:$i:1}" ]; then
        hamming_distance=$((hamming_distance + 1))
    fi
done

echo "The Hamming distance is $hamming_distance"
`,
        testCases: [
            {
                arguments: ["GAGCCTACTAACGGGAT", "CATCGTAATGACGGCCT"],
                expectedOutput: "The Hamming distance is 7\n",
                expectedExitCode: 0
            },
            {
                arguments: ["GAGCCTACTAACGGGAT", "CATCGTAATGACGGCC"],
                expectedOutput: "Error: Sequences must be of equal length\n",
                expectedExitCode: 1
            },
            {
                arguments: ["GAGCCTACTAACGGGAT", "GAGCCTACTAACGGGAT"],
                expectedOutput: "The Hamming distance is 0\n",
                expectedExitCode: 0
            },
            {
                arguments: ["GAGCCTACTAACGGGAT", "GAGCCTACTAACGGGAA"],
                expectedOutput: "The Hamming distance is 1\n",
                expectedExitCode: 0
            },
        ]
    },
    {
        id: "mine-counter",
        title: "Mine counter",
        description: `Write a bash script that takes a file containing a minefield as an argument. The minefield is represented by . for empty spaces and * for mines. The script should count the number of mines in the file and print the result.

Example minefield file:

\`\`\`
*..*....
........
........
...*....
........
\`\`\`

## Example Output:

\`\`\`console?lang=bash&promtp=$
$ ./mine_counter.sh minefield.txt
Number of mines: 10
\`\`\`
`,
        solution: `#!/bin/bash

file="$1"

if [ ! -f "$file" ]; then
    echo "Error: File not found."
    exit 1
fi

mine_count=$(grep -o '*' "$file" | wc -l)

echo "Number of mines: $mine_count"
`,
        testCases: [
            {
                arguments: ["minefield.txt"],
                expectedOutput: "Number of mines: 10\n",
                expectedExitCode: 0
            },
            {
                arguments: ["empty.txt"],
                expectedOutput: "Number of mines: 0\n",
                expectedExitCode: 0
            },
            {
                arguments: ["missing.txt"],
                expectedOutput: "Error: File not found\n",
                expectedExitCode: 1
            },
        ]
    },
    {
        id: "multiplication-table",
        title: "Multiplication Table",
        description: `Write a bash script that prompts the user to input a number and then uses a for loop to print the multiplication table of that number up to 10.

## Example Output:

\`\`\`console?lang=bash&promtp=$
$ ./multiplication_table.sh
Enter a number: 5
5 x 1 = 5
5 x 2 = 10
5 x 3 = 15
5 x 4 = 20
5 x 5 = 25
5 x 6 = 30
5 x 7 = 35
5 x 8 = 40
5 x 9 = 45
5 x 10 = 50

\`\`\`
`,
        solution: `#!/bin/bash

read -p "Enter a number: " number

for i in $(seq 1 10)
do
    echo "$number x $i = $((number * i))"
done
`,
        testCases: [
            {
                arguments: [],
                expectedOutput: "5 x 1 = 5\n5 x 2 = 10\n5 x 3 = 15\n5 x 4 = 20\n5 x 5 = 25\n5 x 6 = 30\n5 x 7 = 35\n5 x 8 = 40\n5 x 9 = 45\n5 x 10 = 50\n",
                expectedExitCode: 0,
                input: ["5"]
            },
        ]
    },
    {
        id: "numeric-tests",
        title: "Numeric Tests",
        description: `Write a bash script that takes two numbers as arguments and performs the following numeric tests using if, then, else, and elif syntax:

1. Check if the first number is equal to the second number.
2. Check if the first number is greater than the second number.
3. Check if the first number is less than the second number.

## Example Output:

\`\`\`console?lang=bash&promtp=$
$ ./numeric_tests.sh 5 10
5 is less than 10

$ ./numeric_tests.sh 10 5
10 is greater than 5

$ ./numeric_tests.sh 5 5
5 is equal to 5

\`\`\`
`,
        solution: `#!/bin/bash

num1="$1"
num2="$2"

if [ "$num1" -eq "$num2" ]; then
    echo "$num1 is equal to $num2"
elif [ "$num1" -gt "$num2" ]; then
    echo "$num1 is greater than $num2"
else
    echo "$num1 is less than $num2"
fi
`,
        testCases: [
            {
                arguments: ["5", "10"],
                expectedOutput: "5 is less than 10\n",
                expectedExitCode: 0
            },
            {
                arguments: ["10", "5"],
                expectedOutput: "10 is greater than 5\n",
                expectedExitCode: 0
            },
            {
                arguments: ["5", "5"],
                expectedOutput: "5 is equal to 5\n",
                expectedExitCode: 0
            },
        ]
    },
    {
        id: "password-prompt",
        title: "Password Prompt",
        description: `Write a bash script that prompts the user to input a password and keeps prompting until the correct password is entered using a while loop. The correct password should be predefined in the script.

(The correct password is \`secret123\`.)

## Example Output:

\`\`\`console?lang=bash&promtp=$
$ ./password_prompt.sh
Enter the password: wrongpassword
Incorrect password. Try again.
Enter the password: secret123
Password accepted.
\`\`\`
`,
        solution: `#!/bin/bash

correct_password="secret123"

while true
do
    read -p "Enter the password: " input_password
    if [ "$input_password" = "$correct_password" ]; then
        echo "Password accepted."
        break
    else
        echo "Incorrect password. Try again."
    fi
done
`,
        testCases: [
            {
                arguments: [],
                expectedOutput: "Incorrect password. Try again.\nPassword accepted.\n",
                expectedExitCode: 0,
                input: ["wrongpassword", "secret123"]
            },
        ]
    },
    {
        id: "script-args3",
        title: "Print All Arguments",
        description: `Print All Arguments

Description: Write a bash script that prints all the arguments provided to it.

Example Output:
\`\`\`console?lang=bash&promtp=$
$ ./print_args.sh Hello World 123
Hello
World
123

$ ./print_args.sh This is a test
This
is
a
test
\`\`\``,
        solution: `#!/bin/bash
for arg in "$@"
do
    echo "$arg"
done`,
        testCases: [
            {
                arguments: ["Hello", "World", "123"],
                expectedOutput: "Hello\nWorld\n123\n",
                expectedExitCode: 0
            },
            {
                arguments: ["This", "is", "a", "test"],
                expectedOutput: "This\nis\na\ntest\n",
                expectedExitCode: 0
            },
        ]
    },
    {
        id: "raindrops",
        title: "Raindrops",
        description: `Write a bash script that takes a number as an argument and converts it into its corresponding raindrop sounds based on the following rules:

1. If the number is divisible by 3, add “Pling” to the result.
2. If the number is divisible by 5, add “Plang” to the result.
3. If the number is divisible by 7, add “Plong” to the result.
4. If the number is not divisible by 3, 5, or 7, the result should be the number as a string.

## Example Output:

\`\`\`console?lang=bash&promtp=$
$ ./raindrop_sounds.sh 28
Plong
$ ./raindrop_sounds.sh 30
PlingPlang
$ ./raindrop_sounds.sh 34
34
\`\`\`
`,
        solution: `#!/bin/bash

number="$1"
result=""

if (( number % 3 == 0 )); then
    result+="Pling"
fi

if (( number % 5 == 0 )); then
    result+="Plang"
fi

if (( number % 7 == 0 )); then
    result+="Plong"
fi

if [ -z "$result" ]; then
    result="$number"
fi

echo "$result"
`,
        testCases: [
            {
                arguments: ["28"],
                expectedOutput: "Plong\n",
                expectedExitCode: 0
            },
            {
                arguments: ["30"],
                expectedOutput: "PlingPlang\n",
                expectedExitCode: 0
            },
            {
                arguments: ["34"],
                expectedOutput: "34\n",
                expectedExitCode: 0
            },
            {
                arguments: ["105"],
                expectedOutput: "PlingPlangPlong\n",
                expectedExitCode: 0
            },
        ]
    },
    {
        id: "remove-pattern-from-beginning",
        title: "Remove Pattern from Beginning",
        description: `Write a bash script that takes a string as an argument and performs the following tasks:

Save the first command line parameter in a variable called \`input_string\`.

Remove the shortest match of the pattern “*Hello” from the beginning of the string.

Remove the longest match of the pattern “*Hello” from the beginning of the string.

## Example Output:

\`\`\`console?lang=bash&promtp=$
$ ./pattern_match.sh "HelloHelloWorld"
Original string: HelloHelloWorld
Shortest match removed: HelloWorld
Longest match removed: World
\`\`\``,
        solution: `#!/bin/bash

input_string="$1"

echo "Original string: $input_string"
echo "Shortest match removed: \${input_string#*Hello}"
echo "Longest match removed: \${input_string##*Hello}"`,
        testCases: [
            {
                arguments: ["HelloHelloWorld"],
                expectedOutput: "Original string: HelloHelloWorld\nShortest match removed: HelloWorld\nLongest match removed: World\n",
                expectedExitCode: 0
            },
            {
                arguments: ["HelloWorldHello"],
                expectedOutput: "Original string: HelloWorldHello\nShortest match removed: WorldHello\nLongest match removed: \n",
                expectedExitCode: 0
            },
        ]
    },
    {
        id: "remove-pattern-from-end",
        title: "Remove Pattern from End",
        description: `Write a bash script that takes a string as an argument and performs the following tasks:

Save the first command line parameter in a variable called \`input_string\`.

Remove the shortest match of the pattern “World*” from the end of the string.

Remove the longest match of the pattern “World*” from the end of the string.


## Example Output:

\`\`\`console?lang=bash&promtp=$
$ ./pattern_match_end.sh "HelloWorldWorld"
Original string: HelloWorldWorld
Shortest match removed: HelloWorld
Longest match removed: Hello
\`\`\``,
        solution: `#!/bin/bash

input_string="$1"

echo "Original string: $input_string"
echo "Shortest match removed: \${input_string%World*}"
echo "Longest match removed: \${input_string%%World*}"`,
        testCases: [
            {
                arguments: ["HelloWorldWorld"],
                expectedOutput: "Original string: HelloWorldWorld\nShortest match removed: HelloWorld\nLongest match removed: Hello\n",
                expectedExitCode: 0
            },
            {
                arguments: ["WorldHelloWorld"],
                expectedOutput: "Original string: WorldHelloWorld\nShortest match removed: WorldHello\nLongest match removed: \n",
                expectedExitCode: 0
            },
        ]
    },
    {
        id: "replace-pattern-in-string",
        title: "Replace Pattern in String",
        description: `Write a bash script that takes a string, a pattern, and a replacement string as arguments and performs the following tasks:

Save the first command line parameter in a variable called \`input_string\`.

Replace the first match of the pattern in the string with the replacement string.

Replace all matches of the pattern in the string with the replacement string.

## Example Output:

\`\`\`console?lang=bash&promtp=$
./pattern_replace.sh "HelloWorldWorld" "World" "Universe"
Original string: HelloWorldWorld
First match replaced: HelloUniverseWorld
All matches replaced: HelloUniverseUniverse
\`\`\``,
        solution: `#!/bin/bash

input_string="$1"
pattern="$2"
replacement="$3"

echo "Original string: $input_string"
echo "First match replaced: \${input_string/$pattern/$replacement}"
echo "All matches replaced: \${input_string//$pattern/$replacement}"
`,
        testCases: [
            {
                arguments: ["HelloWorldWorld", "World", "Universe"],
                expectedOutput: "Original string: HelloWorldWorld\nFirst match replaced: HelloUniverseWorld\nAll matches replaced: HelloUniverseUniverse\n",
                expectedExitCode: 0
            },
            {
                arguments: ["WorldHelloWorld", "World", "Universe"],
                expectedOutput: "Original string: WorldHelloWorld\nFirst match replaced: UniverseHelloWorld\nAll matches replaced: UniverseHelloUniverse\n",
                expectedExitCode: 0
            },
        ]
    },
    {
        id: "reverse-strings",
        title: "Reverse strings",
        description: `Write a bash script that takes a string as an argument and reverses it. Reversing strings is a common task in programming, especially in bioinformatics for analyzing DNA or RNA sequences.

## Example Output:

\`\`\`console?lang=bash&promtp=$
$ ./reverse_string.sh stressed
desserts
$ ./reverse_string.sh strops
sports
$ ./reverse_string.sh racecar
racecar
\`\`\`
`,
        solution: `#!/bin/bash

input_string="$1"
reversed_string=""

for (( i=\${#input_string}-1; i>=0; i-- ))
do
    reversed_string="$reversed_string\${input_string:$i:1}"
done

echo "$reversed_string"`,
        testCases: [
            {
                arguments: ["stressed"],
                expectedOutput: "desserts\n",
                expectedExitCode: 0
            },
            {
                arguments: ["strops"],
                expectedOutput: "sports\n",
                expectedExitCode: 0
            },
            {
                arguments: ["racecar"],
                expectedOutput: "racecar\n",
                expectedExitCode: 0
            },
        ]
    },
    {
        id: "robot-simulator",
        title: "Robot simulator",
        description: `Note: this is already a quite complex problem. Mainly if you want a challenge!

Write a bash script that simulates the movements of a robot on an infinite grid. The robot can turn right, turn left, and advance. The robot always starts at coordinates {0, 0} facing north. The script should process a series of instructions provided as separate arguments and output the robot’s final position and direction.

Instructions:

- R means turn right.
- L means turn left.
- A means advance.

## Example Output:

\`\`\`console?lang=bash&promtp=$
$ ./robot_simulator.sh R A A L A L
Final position: {2, 1}
Facing: west
\`\`\`
`,
        solution: `#!/bin/bash

x=0
y=0
direction="north"

for instruction in "$@"; do
    case "$instruction" in
        R) case "$direction" in
                north) direction="east" ;;
                east) direction="south" ;;
                south) direction="west" ;;
                west) direction="north" ;;
            esac ;;
        L) case "$direction" in
                north) direction="west" ;;
                west) direction="south" ;;
                south) direction="east" ;;
                east) direction="north" ;;
            esac ;;
        A) case "$direction" in
                north) y=$((y + 1)) ;;
                south) y=$((y - 1)) ;;
                east) x=$((x + 1)) ;;
                west) x=$((x - 1)) ;;
            esac ;;
    esac
done

echo "Final position: {$x, $y}"
echo "Facing: $direction"`,
        testCases: [
            {
                arguments: ["R", "A", "A", "L", "A", "L"],
                expectedOutput: "Final position: {2, 1}\nFacing: west\n",
                expectedExitCode: 0
            },
            {
                arguments: ["A", "A", "R", "A", "L", "A"],
                expectedOutput: "Final position: {1, 3}\nFacing: north\n",
                expectedExitCode: 0
            },
        ]
    },
    {
        id: "string-tests",
        title: "String Tests",
        description: `Write a bash script that takes two strings as arguments and performs the following string tests using if, then, else, and elif syntax:

1. Check if the first string is equal to the second string.
2. Check if the first string has a non-zero length.
3. Check if the second string has a zero length.

## Example Output:

\`\`\`console?lang=bash&promtp=$
$ ./string_tests.sh Hello Hello
Strings are equal
First string has non-zero length
Second string has non-zero length

$ ./string_tests.sh Hello ""
Strings are not equal
First string has non-zero length
Second string has zero length

\`\`\`
`,
        solution: `#!/bin/bash

str1="$1"
str2="$2"

if [ "$str1" = "$str2" ]; then
    echo "Strings are equal"
else
    echo "Strings are not equal"
fi

if [ -n "$str1" ]; then
    echo "First string has non-zero length"
else
    echo "First string has zero length"
fi

if [ -z "$str2" ]; then
    echo "Second string has zero length"
else
    echo "Second string has non-zero length"
fi
`,
        testCases: [
            {
                arguments: ["Hello", "Hello"],
                expectedOutput: "Strings are equal\nFirst string has non-zero length\nSecond string has non-zero length\n",
                expectedExitCode: 0
            },
            {
                arguments: ["Hello", ""],
                expectedOutput: "Strings are not equal\nFirst string has non-zero length\nSecond string has zero length\n",
                expectedExitCode: 0
            },
        ]
    },
    {
        id: "sum-of-odd-integers",
        title: "Sum of Odd Integers",
        description: `Write a bash script that takes two positive integers a and b (where a < b < 10000) as arguments and returns the sum of all odd integers from a through b, inclusively.

## Example Output:

\`\`\`console?lang=bash&promtp=$
$ ./sum_odd_integers.sh 100 200
7500
$ ./sum_odd_integers.sh 1 10
25
\`\`\`
`,
        solution: `#!/bin/bash

a="$1"
b="$2"
sum=0

for (( i=a; i<=b; i++ ))
do
    if (( i % 2 != 0 )); then
        sum=$((sum + i))
    fi
done

echo "$sum"
`,
        testCases: [
            {
                arguments: ["100", "200"],
                expectedOutput: "7500\n",
                expectedExitCode: 0
            },
            {
                arguments: ["1", "10"],
                expectedOutput: "25\n",
                expectedExitCode: 0
            },
            {
                arguments: ["1", "100"],
                expectedOutput: "2500\n",
                expectedExitCode: 0
            },
        ]
    },
    {
        id: "until-loop",
        title: "Until Loop",
        description: `Write a bash script that uses an until loop to print a countdown from 5 to 1, each followed by a fun fact about that number.

Note that you can use until also to count up, it is just a different condition from the while loop. Here we just want to illustrate counting down, which could also be done with a while loop.

## Example Output:

\`\`\`console?lang=bash&promtp=$
5 is the number of fingers on one hand.
4 is the number of seasons in a year.
3 is the first odd prime number.
2 is the only even prime number.
1 is the first positive integer.
\`\`\`
`,
        solution: `#!/bin/bash

i=5
until [ $i -lt 1 ]
do
    case $i in
        1)
            echo "$i is the first positive integer."
            ;;
        2)
            echo "$i is the only even prime number."
            ;;
        3)
            echo "$i is the first odd prime number."
            ;;
        4)
            echo "$i is the number of seasons in a year."
            ;;
        5)
            echo "$i is the number of fingers on one hand."
            ;;
    esac
    i=$((i - 1))
done
`,
        testCases: [
            {
                arguments: [],
                expectedOutput: "5 is the number of fingers on one hand.\n4 is the number of seasons in a year.\n3 is the first odd prime number.\n2 is the only even prime number.\n1 is the first positive integer.\n",
                expectedExitCode: 0
            },
        ]
    },
    {
        id: "substitution-operators",
        title: "Using Substitution Operators with Arguments",
        description: `Write a bash script that demonstrates the use of substitution operators :-, :=, and :? with command-line arguments. The script should:

Store the first, second, and third arguments in variables VAR1, VAR2, and VAR3, respectively.

Use the :- operator to provide a default value if the first argument ($VAR1) is not set.

Use the := operator to set the second argument ($VAR2) to a default value if it is not already set.

Use the :? operator to print an error message and exit if the third argument ($VAR3) is not set.

Due to limitations in the testing capabilities, to get a correct test result, the error for the :? operator should be generated on line 14 of the script.


## Example Output:

\`\`\`console?lang=bash&promtp=$
$ ./substitution_ops.sh
Default value for first argument: default_value
Second argument is set to: default_value
./substitution_ops.sh: line 14: $VAR3: argument is not set
$ echo $?
1

$ ./substitution_ops.sh Hello World
Default value for first argument: Hello
Second argument is set to: World
./substitution_ops.sh: line 14: $VAR3: argument is not set
$ echo $?
1

$ ./substitution_ops.sh Hello World Test
Default value for first argument: Hello
Second argument is set to: World
Third argument is set to: Test
$ echo $?
0
\`\`\``,
        solution: `#!/bin/bash

VAR1=$1
VAR2=$2
VAR3=$3

# Use :- to provide a default value if $VAR1 is not set
echo "Default value for first argument: \${VAR1:-default_value}"

# Use := to set $VAR2 to a default value if it is not already set
echo "Second argument is set to: \${VAR2:=default_value}"

# Use :? to print an error message and exit if $VAR3 is not set
echo "Third argument is set to: \${VAR3:?argument is not set}"
`,
        testCases: [
            {
                arguments: [],
                expectedOutput: "Default value for first argument: default_value\nSecond argument is set to: default_value\n",
                expectedExitCode: 1
            },
            {
                arguments: ["Hello", "World"],
                expectedOutput: "Default value for first argument: Hello\nSecond argument is set to: World\n",
                expectedExitCode: 1
            },
            {
                arguments: ["Hello", "World", "Test"],
                expectedOutput: "Default value for first argument: Hello\nSecond argument is set to: World\nThird argument is set to: Test\n",
                expectedExitCode: 0
            },
        ]
    },
    {
        id: "while-loop",
        title: "While Loop",
        description: `Write a bash script that uses a while loop to print numbers from 1 to 5, each followed by a fun fact about that number.

## Example Output:

\`\`\`console?lang=bash&promtp=$
$ ./while_loop.sh
1 is the first positive integer.
2 is the only even prime number.
3 is the first odd prime number.
4 is the number of seasons in a year.
5 is the number of fingers on one hand.
\`\`\`
`,
        solution: `#!/bin/bash

i=1
while [ $i -le 5 ]
do
    case $i in
        1)
            echo "$i is the first positive integer."
            ;;
        2)
            echo "$i is the only even prime number."
            ;;
        3)
            echo "$i is the first odd prime number."
            ;;
        4)
            echo "$i is the number of seasons in a year."
            ;;
        5)
            echo "$i is the number of fingers on one hand."
            ;;
    esac
    i=$((i + 1))
done
`,
        testCases: [
            {
                arguments: [],
                expectedOutput: "1 is the first positive integer.\n2 is the only even prime number.\n3 is the first odd prime number.\n4 is the number of seasons in a year.\n5 is the number of fingers on one hand.\n",
                expectedExitCode: 0
            },
        ]
    }
];
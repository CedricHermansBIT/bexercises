/**
 * Comprehensive Bash Interpreter - Pure JavaScript Implementation
 * Handles all bash constructs needed for the programming exercises
 */

class BashRunner {
    constructor() {
        this.terminal = null;
        this.interpreter = new BashInterpreter();
        this.initializeTerminal();
    }

    async executeScript(script, args = [], inputLines = []) {
        console.log('Using custom bash interpreter');
        return await this.interpreter.run(script, args, inputLines);
    }

    initializeTerminal() {
        if (typeof Terminal !== 'undefined') {
            this.terminal = new Terminal({
                cursorBlink: true,
                fontSize: 14,
                fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                theme: {
                    background: '#1e1e1e',
                    foreground: '#d4d4d4'
                },
                cols: 80,
                rows: 20
            });

            if (typeof FitAddon !== 'undefined') {
                const fitAddon = new FitAddon.FitAddon();
                this.terminal.loadAddon(fitAddon);
                this.fitAddon = fitAddon;
            }

            this.currentInput = '';
            this.terminal.onData(data => {
                if (data === '\r') {
                    this.terminal.write('\r\n');
                    this.processCommand(this.currentInput);
                    this.currentInput = '';
                    this.terminal.write('$ ');
                } else if (data === '\u007f') {
                    if (this.currentInput.length > 0) {
                        this.currentInput = this.currentInput.slice(0, -1);
                        this.terminal.write('\b \b');
                    }
                } else if (data >= ' ') {
                    this.currentInput += data;
                    this.terminal.write(data);
                }
            });
        }
    }

    async processCommand(command) {
        if (command.trim() === '') return;

        if (command === 'clear') {
            this.terminal.clear();
            return;
        }

        try {
            const result = await this.executeScript(command, []);
            this.terminal.write(result.output.replace(/\n/g, '\r\n'));
        } catch (error) {
            this.terminal.write(`Error: ${error.message}\r\n`);
        }
    }

    mountTerminal(container) {
        if (this.terminal && container) {
            this.terminal.open(container);
            if (this.fitAddon) {
                setTimeout(() => {
                    this.fitAddon.fit();
                }, 100);
            }
        }
    }

    writeToTerminal(text) {
        if (this.terminal) {
            this.terminal.write(text.replace(/\n/g, '\r\n'));
        }
    }

    clearTerminal() {
        if (this.terminal) {
            this.terminal.clear();
        }
    }
}

/**
 * Complete Bash Interpreter Implementation
 */
class BashInterpreter {
    constructor() {
        this.variables = new Map();
        this.output = [];
        this.errorOutput = [];
        this.exitCode = 0;
        this.inputLines = [];
        this.inputIndex = 0;
        this.breakFlag = false;
        this.continueFlag = false;
        this.mockFileSystem = new Map();
        this.setupMockFileSystem();
        this.setupBuiltins();
    }

    setupMockFileSystem() {
        // Mock files for file test exercises
        this.mockFileSystem.set('test.txt', {
            readable: true, writable: true, executable: false, size: 100,
            content: 'test file content\nline 2\nline 3'
        });
        this.mockFileSystem.set('script.sh', {
            readable: true, writable: true, executable: true, size: 200,
            content: '#!/bin/bash\necho "hello world"'
        });
        this.mockFileSystem.set('testfile', {
            readable: true, writable: true, executable: true, size: 150,
            content: 'executable test file'
        });
        this.mockFileSystem.set('testfile2', {
            readable: true, writable: true, executable: false, size: 75,
            content: 'non-executable test file'
        });
        this.mockFileSystem.set('data.txt', {
            readable: true, writable: false, executable: false, size: 50,
            content: 'read-only data'
        });

        // Exercise-specific files
        // Mine counter examples
        this.mockFileSystem.set('minefield.txt', {
            readable: true, writable: false, executable: false, size: 5,
            content: '.......*.*\n..........\n*.*....*..\n..*...*...\n.*.....**..\n'
        });
        this.mockFileSystem.set('empty.txt', {
            readable: true, writable: true, executable: false, size: 0,
            content: ''
        });
        // FASTQ example minimal content (12 sequences -> 12 records => 48 lines); here we include only the sequence lines
        // Since our shell doesn’t handle file input redirection into while loops, this mainly exists to make -f checks pass.
        this.mockFileSystem.set('FASTQ.txt', {
            readable: true, writable: false, executable: false, size: 1024,
            content: '@id1\nTGTTGAATTGAGAGCTTGTGTTNAGTAGATAGTTGA\n+\n!!!!\n' +
                     '@id2\nCCCACGTATCCAAGTCGAAGAGNAATTGATTTTCCC\n+\n!!!!\n' +
                     '@id3\nAGGGAGGGAGGGAGTGAGATTGNTTCGATCGCCAAT\n+\n!!!!\n' +
                     '@id4\nCTGGGTTTTTGTGTTATTGAGANTCTGAGTTTGAGA\n+\n!!!!\n' +
                     '@id5\nTTGTTCCTTGACGAGATTGGTGNGGCTTACGATGAG\n+\n!!!!\n' +
                     '@id6\nGATCGGAAGAGCTCGTATGCCGNCTTCTGCTTGAAA\n+\n!!!!\n' +
                     '@id7\nGCATCGAAGCCAACCTCGAACTNCTGGCCGTGGCCG\n+\n!!!!\n' +
                     '@id8\nTAAGCGTGTGGATCTAAACAATNACAAGGAGACTTT\n+\n!!!!\n' +
                     '@id9\nTATCGTCGCTATCGGGAGCTTTNTCTAGATCGGAAG\n+\n!!!!\n' +
                     '@id10\nTGCCGTTGATTAGTCCATTCTCNGAAGGAGAGATAC\n+\n!!!!\n' +
                     '@id11\nATGTCTCGCAAACCGGAAAACANACGTTAAGTCCGG\n+\n!!!!\n' +
                     '@id12\nGTCCCTCGTTTACAGACTCAGANGTGAATAGAAAAG\n+\n!!!!\n'
        });
        this.mockFileSystem.set('output_file.txt', {
            readable: true, writable: true, executable: false, size: 0,
            content: ''
        });
    }

    setupBuiltins() {
        this.builtins = new Map([
            ['echo', this.cmdEcho.bind(this)],
            ['read', this.cmdRead.bind(this)],
            ['test', this.cmdTest.bind(this)],
            ['[', this.cmdTest.bind(this)],
            ['seq', this.cmdSeq.bind(this)],
            ['exit', this.cmdExit.bind(this)],
            ['true', () => ({exitCode: 0})],
            ['false', () => ({exitCode: 1})],
            ['break', () => {
                this.breakFlag = true;
                return {exitCode: 0};
            }],
            ['continue', () => {
                this.continueFlag = true;
                return {exitCode: 0};
            }],
            ['cat', this.cmdCat.bind(this)],
            ['tee', this.cmdTee.bind(this)],
            ['wc', this.cmdWc.bind(this)],
            ['grep', this.cmdGrep.bind(this)]
        ]);
    }

    async run(script, args = [], inputLines = []) {
        this.reset();
        this.setArgs(args);
        this.setInput(inputLines);

        try {
            const statements = this.parseScript(script);
            await this.executeStatements(statements);
        } catch (error) {
            if (error.message !== 'EXIT') {
                console.error('Script execution error:', error);
                this.exitCode = 1;
                this.errorOutput.push(`Error: ${error.message}\n`);
            }
        }

        return {
            output: this.output.join(''),
            exitCode: this.exitCode,
            error: this.errorOutput.join('')
        };
    }

    reset() {
        this.variables.clear();
        this.output = [];
        this.errorOutput = [];
        this.exitCode = 0;
        this.inputIndex = 0;
        this.breakFlag = false;
        this.continueFlag = false;
    }

    setArgs(args) {
        this.variables.set('0', 'script.sh');
        for (let i = 0; i < args.length; i++) {
            this.variables.set((i + 1).toString(), args[i]);
        }
        this.variables.set('#', args.length.toString());
        this.variables.set('@', args.join(' '));
        this.variables.set('*', args.join(' '));
    }

    setInput(inputLines) {
        this.inputLines = inputLines || [];
        this.inputIndex = 0;
    }

    parseScript(script) {
        // Clean and tokenize
        const rawLines = script.split('\n');
        const processed = [];

        for (let raw of rawLines) {
            raw = raw.replace(/\r$/, '');
            const parts = this.splitBySemicolons(raw);
            for (const part of parts) {
                const trimmed = part.trim();
                if (trimmed && !trimmed.startsWith('#')) processed.push(trimmed);
            }
        }
        // Further split inline 'do <cmd>' or 'then <cmd>' patterns into separate logical lines
        const expanded = [];
        for (const line of processed) {
            if (line.startsWith('do ')) {
                expanded.push('do');
                const rest = line.substring(3).trim();
                if (rest) expanded.push(rest);
            } else if (line.startsWith('then ')) {
                expanded.push('then');
                const rest = line.substring(5).trim();
                if (rest) expanded.push(rest);
            } else {
                expanded.push(line);
            }
        }
        console.log('Script lines after parsing:', expanded);
        return this.parseStatements(expanded);
    }

    splitBySemicolons(line) {
        const result = [];
        let current = '';
        let inSingle = false;
        let inDouble = false;
        let escape = false;
        let arithDepth = 0; // depth for nested (( ... ))
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            // Handle escape
            if (escape) {
                current += ch;
                escape = false;
                continue;
            }
            if (ch === '\\') {
                escape = true;
                current += ch;
                continue;
            }
            // Track quotes (do not enter/exit quotes if in arithmetic)
            if (!arithDepth) {
                if (ch === "'" && !inDouble) {
                    inSingle = !inSingle;
                    current += ch;
                    continue;
                }
                if (ch === '"' && !inSingle) {
                    inDouble = !inDouble;
                    current += ch;
                    continue;
                }
            }
            // Detect entering arithmetic (( ... )) when not in quotes
            if (!inSingle && !inDouble && ch === '(' && i + 1 < line.length && line[i + 1] === '(') {
                arithDepth++;
                current += '(('; i++;
                continue;
            }
            // Detect leaving arithmetic ))
            if (arithDepth && ch === ')' && i + 1 < line.length && line[i + 1] === ')') {
                arithDepth = Math.max(0, arithDepth - 1);
                current += '))'; i++;
                continue;
            }
            // Preserve case arm terminator ';;' as literal (do not split on it)
            if (!inSingle && !inDouble && arithDepth === 0 && ch === ';' && i + 1 < line.length && line[i + 1] === ';') {
                current += ';;';
                i++; // skip the second ';'
                continue;
            }
            // Split on semicolons only when not in quotes and not inside arithmetic (( ))
            if (ch === ';' && !inSingle && !inDouble && arithDepth === 0) {
                if (current.trim()) result.push(current);
                current = '';
                continue;
            }
            current += ch;
        }
        if (current.trim()) result.push(current);
        return result;
    }

    parseStatements(lines) {
        const statements = [];
        let i = 0;

        while (i < lines.length) {
            const {statement, nextIndex} = this.parseStatement(lines, i);
            if (statement) {
                statements.push(statement);
            }
            i = nextIndex;
        }

        return statements;
    }

    parseStatement(lines, index) {
        const line = lines[index];

        // Control structures
        if (line.startsWith('if ')) {
            return this.parseIf(lines, index);
        }
        if (line.startsWith('while ')) {
            return this.parseWhile(lines, index);
        }
        if (line.startsWith('until ')) {
            return this.parseUntil(lines, index);
        }
        if (line.startsWith('for ')) {
            return this.parseFor(lines, index);
        }
        if (line.startsWith('case ')) {
            return this.parseCase(lines, index);
        }

        // Simple command
        return {
            statement: {
                type: 'command',
                line: line
            },
            nextIndex: index + 1
        };
    }

    parseFor(lines, index) {
        const forLine = lines[index];
        // C-style loop? e.g. for (( i=0; i<5; i++ )) or with trailing ; do
        const cStyleMatch = forLine.match(/^for\s*\(\((.*)\)\)\s*(?:;?\s*do)?$/);
        if (cStyleMatch) {
            const inner = cStyleMatch[1].trim();
            const parts = inner.split(';').map(p => p.trim());
            const init = parts[0] || '';
            const condition = parts[1] || '';
            const update = parts[2] || '';
            const {body, endIndex} = this.parseBlock(lines, index + 1, 'done');
            return {
                statement: {type: 'for_c', init, condition, update, body},
                nextIndex: endIndex + 1
            };
        }

        const match = forLine.match(/^for\s+(\w+)\s+in\s+(.+)$/);
        if (!match) {
            return {statement: null, nextIndex: index + 1};
        }
        const variable = match[1];
        let iterable = match[2].trim();
        if (/;?\s*do$/.test(iterable)) {
            iterable = iterable.replace(/;?\s*do$/, '').trim();
        }
        const {body, endIndex} = this.parseBlock(lines, index + 1, 'done');
        return {
            statement: {type: 'for', variable, iterable, body},
            nextIndex: endIndex + 1
        };
    }

    parseWhile(lines, index) {
        const condition = lines[index].substring(6);
        const {body, endIndex, endLine} = this.parseBlock(lines, index + 1, 'done');

        // Detect input redirection attached to the 'done' line, e.g., 'done < $file'
        let inputRedirect = null;
        if (typeof endLine === 'string' && endLine.startsWith('done')) {
            const suffix = endLine.slice(4).trim();
            // Only support simple input redirection of the form: < filename
            const m = suffix.match(/^<\s*(.+)$/);
            if (m) {
                inputRedirect = m[1].trim();
            }
        }

        return {
            statement: {
                type: 'while',
                condition,
                body,
                inputRedirect
            },
            nextIndex: endIndex + 1
        };
    }

    parseUntil(lines, index) {
        const condition = lines[index].substring(6);
        const {body, endIndex} = this.parseBlock(lines, index + 1, 'done');

        return {
            statement: {
                type: 'until',
                condition,
                body
            },
            nextIndex: endIndex + 1
        };
    }

    parseIf(lines, index) {
        let condition = lines[index].substring(3).trim();
        // Handle inline forms like: if [ "$var" = "x" ]; then
        // Remove a trailing '; then' or just 'then' if present at end of condition line
        condition = condition.replace(/;?\s*then$/, '').trim();

        let currentIndex = index + 1;
        if (lines[currentIndex] === 'then') currentIndex++;

        const thenBody = [];
        const elifClauses = [];
        let elseBody = [];

        while (currentIndex < lines.length && lines[currentIndex] !== 'fi') {
            if (lines[currentIndex].startsWith('elif ')) {
                let elifCondition = lines[currentIndex].substring(5).trim();
                // Support inline 'elif <cond>; then'
                elifCondition = elifCondition.replace(/;?\s*then$/, '').trim();
                currentIndex++;
                if (lines[currentIndex] === 'then') currentIndex++;

                const elifBodyLines = [];
                while (currentIndex < lines.length &&
                !lines[currentIndex].startsWith('elif ') &&
                lines[currentIndex] !== 'else' &&
                lines[currentIndex] !== 'fi') {
                    elifBodyLines.push(lines[currentIndex]);
                    currentIndex++;
                }

                elifClauses.push({
                    condition: elifCondition,
                    body: this.parseStatements(elifBodyLines)
                });
            } else if (lines[currentIndex] === 'else') {
                currentIndex++;
                const elseBodyLines = [];
                while (currentIndex < lines.length && lines[currentIndex] !== 'fi') {
                    elseBodyLines.push(lines[currentIndex]);
                    currentIndex++;
                }
                elseBody = this.parseStatements(elseBodyLines);
            } else {
                thenBody.push(lines[currentIndex]);
                currentIndex++;
            }
        }

        return {
            statement: {
                type: 'if',
                condition,
                thenBody: this.parseStatements(thenBody),
                elifClauses,
                elseBody
            },
            nextIndex: currentIndex + 1
        };
    }

    parseCase(lines, index) {
        const caseLine = lines[index];
        const match = caseLine.match(/^case\s+(.+)\s+in$/);
        if (!match) {
            return { statement: null, nextIndex: index + 1 };
        }

        const testValue = match[1];
        const cases = [];
        let currentIndex = index + 1;

        while (currentIndex < lines.length && lines[currentIndex].trim() !== 'esac') {
            let line = lines[currentIndex].trim();

            // Skip empty lines
            if (!line) {
                currentIndex++;
                continue;
            }

            // Find a pattern line, which must contain ')'
            const rp_index = line.indexOf(')');
            if (rp_index === -1) {
                // Not a pattern line, skip
                currentIndex++;
                continue;
            }

            const patternRaw = line.substring(0, rp_index).trim();
            const bodyLines = [];
            let remainder = line.substring(rp_index + 1).trim();

            // Keep track of nested case depth; if the remainder starts a nested case, seed depth
            let nestedCaseDepth = 0;

            if (remainder) {
                // Check if the arm terminates on the same line
                const terminatorIndex = remainder.indexOf(';;');
                if (terminatorIndex !== -1) {
                    const firstPart = remainder.substring(0, terminatorIndex).trim();
                    if (firstPart) bodyLines.push(firstPart);
                    currentIndex++;
                    cases.push({ pattern: patternRaw, body: this.parseStatements(bodyLines) });
                    continue;
                } else {
                    bodyLines.push(remainder);
                    if (remainder.startsWith('case ')) nestedCaseDepth = 1;
                }
            }
            currentIndex++;

            // Collect body lines for the current pattern from subsequent lines
            while (currentIndex < lines.length) {
                const bodyLine = lines[currentIndex].trim();

                if (bodyLine.startsWith('case ')) {
                    nestedCaseDepth++;
                } else if (/^esac(\s|$)/.test(bodyLine)) {
                    if (nestedCaseDepth > 0) nestedCaseDepth--;
                }

                const terminatorIndex = bodyLine.indexOf(';;');
                if (terminatorIndex !== -1 && nestedCaseDepth === 0) {
                    // Found the terminator for the current arm
                    const linePart = bodyLine.substring(0, terminatorIndex).trim();
                    if (linePart) bodyLines.push(linePart);
                    currentIndex++;
                    break; // Exit inner loop and process the next pattern
                }

                bodyLines.push(bodyLine);
                currentIndex++;
            }

            cases.push({ pattern: patternRaw, body: this.parseStatements(bodyLines) });
        }

        // Move past the 'esac'
        if (currentIndex < lines.length && lines[currentIndex].trim() === 'esac') {
            currentIndex++;
        }

        return {
            statement: {
                type: 'case',
                testValue,
                cases
            },
            nextIndex: currentIndex
        };
    }

    parseBlock(lines, startIndex, endKeyword) {
        let currentIndex = startIndex;
        if (lines[currentIndex] === 'do' || lines[currentIndex] === 'then') {
            currentIndex++;
        }


        const bodyLines = [];
        let depth = 1;
        let endLine = null;

        while (currentIndex < lines.length && depth > 0) {
            const line = lines[currentIndex];

            if (['for', 'while', 'until', 'if'].some(kw => line.startsWith(kw + ' '))) {
                depth++;
            } else if (line === endKeyword || line.startsWith(endKeyword) || line === 'fi') {
                depth--;
                if (depth === 0) {
                    endLine = line;
                    break;
                }
            }

            if (depth > 0) {
                bodyLines.push(line);
            }
            currentIndex++;
        }

        return {
            body: this.parseStatements(bodyLines),
            endIndex: currentIndex,
            endLine
        };



    }

    async executeStatements(statements) {
        for (const statement of statements) {
            if (this.breakFlag || this.continueFlag) break;
            await this.executeStatement(statement);
        }
    }

    async executeStatement(statement) {
        switch (statement.type) {
            case 'command':
                await this.executeCommand(statement.line);
                break;
            case 'for':
                await this.executeFor(statement);
                break;
            case 'for_c':
                await this.executeForC(statement);
                break;
            case 'while':
                await this.executeWhile(statement);
                break;
            case 'until':
                await this.executeUntil(statement);
                break;
            case 'if':
                await this.executeIf(statement);
                break;
            case 'case':
                await this.executeCase(statement);
                break;
        }
    }

    async executeFor(statement) {
        const items = await this.expandIterable(statement.iterable);

        for (const item of items) {
            this.variables.set(statement.variable, item.toString());
            this.breakFlag = false;
            this.continueFlag = false;
            await this.executeStatements(statement.body);
            if (this.breakFlag) break;
        }

        this.breakFlag = false;
        this.continueFlag = false;
    }

    async executeForC(statement) {
        console.log("Starting C-style for loop execution");
        console.log("Init:", statement.init);
        console.log("Condition:", statement.condition);
        console.log("Update:", statement.update);

        // Run initialization now (supports simple assignments or arithmetic like i=0 or i=${#var}-1)
        if (statement.init) {
            const arithAssign = statement.init.match(/^([a-zA-Z_][a-zA-Z0-9_]*)=(.+)$/);
            if (arithAssign) {
                const [, v, rhs] = arithAssign;
                const expandedRhs = this.expandVariables(rhs);
                const val = this.evaluateArithmetic(expandedRhs);
                this.variables.set(v, val.toString());
                console.log(`Initialized variable ${v} = ${val}`);
            } else if (/=/.test(statement.init)) {
                await this.executeCommand(statement.init);
                console.log("Executed command for initialization");
            } else {
                // Try arithmetic evaluation side-effect (ignored result)
                this.evaluateArithmetic(statement.init);
                console.log("Evaluated arithmetic for initialization");
            }
        }

        console.log("Variables after initialization:", Object.fromEntries(this.variables));

        this.breakFlag = false;
        this.continueFlag = false;
        let iterationGuard = 0;

        while (true) {
            if (statement.condition) {
                // Evaluate arithmetic condition; treat non-zero as true
                const condVal = this.evaluateArithmetic(statement.condition);
                console.log(`Evaluated condition: ${statement.condition} = ${condVal}`);
                if (!condVal) {
                    console.log("Condition is falsy, breaking loop");
                    break;
                }
            }

            console.log("Executing loop body, iteration:", iterationGuard + 1);
            console.log("Current variables:", Object.fromEntries(this.variables));

            await this.executeStatements(statement.body);

            console.log("After executing body, variables:", Object.fromEntries(this.variables));

            if (this.breakFlag) {
                console.log("Break flag is set, breaking loop");
                break;
            }

            if (statement.update) {
                console.log(`Executing update: ${statement.update}`);
                if (/^[a-zA-Z_][a-zA-Z0-9_]*\+\+$/.test(statement.update)) {
                    const v = statement.update.replace('++', '');
                    const cur = parseInt(this.variables.get(v) || '0');
                    this.variables.set(v, (cur + 1).toString());
                    console.log(`Incremented ${v} to ${cur + 1}`);
                } else if (/^[a-zA-Z_][a-zA-Z0-9_]*--$/.test(statement.update)) {
                    const v = statement.update.replace('--', '');
                    const cur = parseInt(this.variables.get(v) || '0');
                    this.variables.set(v, (cur - 1).toString());
                    console.log(`Decremented ${v} to ${cur - 1}`);
                } else if (/^[a-zA-Z_][a-zA-Z0-9_]*\+=\d+$/.test(statement.update)) {
                    const [v, inc] = statement.update.split('+=');
                    const cur = parseInt(this.variables.get(v) || '0');
                    this.variables.set(v, (cur + parseInt(inc)).toString());
                    console.log(`Added ${inc} to ${v}, now ${cur + parseInt(inc)}`);
                } else if (/=/.test(statement.update)) {
                    const m = statement.update.match(/^([a-zA-Z_][a-zA-Z0-9_]*)=(.+)$/);
                    if (m) {
                        const [, v, rhs] = m;
                        const expandedRhs = this.expandVariables(rhs);
                        const val = this.evaluateArithmetic(expandedRhs);
                        this.variables.set(v, val.toString());
                        console.log(`Assigned ${v} = ${val}`);
                    } else {
                        await this.executeCommand(statement.update);
                        console.log("Executed command for update");
                    }
                } else {
                    this.evaluateArithmetic(statement.update);
                    console.log("Evaluated arithmetic for update");
                }
            }

            this.breakFlag = false;
            if (this.continueFlag) this.continueFlag = false;
            if (++iterationGuard > 1000) {
                console.log("Loop guard exceeded 1000 iterations, breaking");
                break; // safety
            }
        }

        console.log("C-style for loop complete after", iterationGuard, "iterations");
        this.breakFlag = false;
        this.continueFlag = false;
    }

    async executeWhile(statement) {
        console.log(`Starting while loop with condition: ${statement.condition}`);
        let iteration = 0;

        // Handle input redirection for while loop (e.g., done < file)
        let savedInput = null;
        if (statement.inputRedirect) {
            const targetExpr = statement.inputRedirect;
            const targetPath = this.expandVariables(targetExpr).replace(/^["']|["']$/g, '');
            const f = this.mockFileSystem.get(targetPath);
            const redirected = f && typeof f.content === 'string' ? f.content.split('\n') : [];
            // Trim potential trailing empty line caused by final newline in file
            if (redirected.length && redirected[redirected.length - 1] === '') redirected.pop();
            savedInput = { lines: this.inputLines, index: this.inputIndex };
            this.inputLines = redirected;
            this.inputIndex = 0;
        }

        try {
            while (await this.evaluateCondition(statement.condition)) {
                iteration++;
                console.log(`While loop iteration ${iteration}`);
                console.log(`Current variables:`, Object.fromEntries(this.variables));
                console.log(`Input index: ${this.inputIndex}, available inputs:`, this.inputLines);

                this.breakFlag = false;
                this.continueFlag = false;
                await this.executeStatements(statement.body);

                console.log(`After iteration ${iteration} - breakFlag: ${this.breakFlag}`);
                if (this.breakFlag) break;

                if (iteration > 100) {
                    console.error('Breaking infinite loop after 100 iterations');
                    break;
                }
            }
        } finally {
            // Restore original input if it was redirected
            if (savedInput) {
                this.inputLines = savedInput.lines;
                this.inputIndex = savedInput.index;
            }
        }

        console.log(`While loop completed after ${iteration} iterations`);
        this.breakFlag = false;
        this.continueFlag = false;
    }

    async executeUntil(statement) {
        while (!(await this.evaluateCondition(statement.condition))) {
            this.breakFlag = false;
            this.continueFlag = false;
            await this.executeStatements(statement.body);
            if (this.breakFlag) break;
        }

        this.breakFlag = false;
        this.continueFlag = false;
    }

    async executeIf(statement) {
        const conditionResult = await this.evaluateCondition(statement.condition);
        console.log(`If statement: condition="${statement.condition}" → ${conditionResult}`);
        console.log(`Then body:`, statement.thenBody);
        console.log(`Else body:`, statement.elseBody);

        if (conditionResult) {
            console.log('Executing THEN body');
            await this.executeStatements(statement.thenBody);
        } else {
            let executed = false;
            for (const elifClause of statement.elifClauses) {
                if (await this.evaluateCondition(elifClause.condition)) {
                    await this.executeStatements(elifClause.body);
                    executed = true;
                    break;
                }
            }
            if (!executed && statement.elseBody.length > 0) {
                console.log('Executing ELSE body');
                await this.executeStatements(statement.elseBody);
            }
        }
    }

    async executeCase(statement) {
        const testValue = this.expandVariables(statement.testValue).replace(/["']/g, '');

        for (const caseItem of statement.cases) {
            if (this.matchPattern(testValue, caseItem.pattern)) {
                await this.executeStatements(caseItem.body);
                break;
            }
        }
    }

    matchPattern(text, pattern) {
        if (text == null || pattern == null) return false;
        const t = String(text);
        // Support alternation with '|', allow quoting in patterns
        const alts = String(pattern).split('|').map(p => p.trim()).filter(Boolean);
        for (let raw of alts) {
            let p = raw.replace(/^["']/, '').replace(/["']$/, '');
            // Fast path for literal '*'
            if (p === '*') return true;
            // Use shell-style globbing (*, ?) via existing converter; anchor both ends
            const rx = this.shellPatternToRegex(p, true, true);
            if (rx.test(t)) return true;
        }
        return false;
    }

    async executeCommand(line) {
        // Raw line for arithmetic (( )) detection BEFORE substitution
        const trimmed = line.trim();
        if (/^\(\(.+\)\)$/.test(trimmed)) {
            const inner = trimmed.slice(2, -2).trim();
            this.applyArithmeticSideEffects(inner);
            return;
        }
        // Detect assignment before expansion to avoid false negatives due to spaces from expansion
        if (this.isAssignment(trimmed)) {
            this.executeAssignment(trimmed);
            return;
        }
        const expandedLine = this.expandVariables(line);

        // Special case: echo ... | tee -a FILE
        // Minimal support to cover exercise use without full pipeline semantics
        const teePipeMatch = expandedLine.match(/^\s*echo\s+(.+?)\s*\|\s*tee\s+-a\s+(.+)\s*$/);
        if (teePipeMatch) {
            const echoArg = teePipeMatch[1];
            // Use the first filename after -a (common exercise form)
            const fileToken = teePipeMatch[2].trim().split(/\s+/)[0];
            const content = echoArg; // echo adds a trailing newline by default
            // Append to file
            let f = this.mockFileSystem.get(fileToken);
            if (!f) {
                f = {content: '', size: 0, readable: true, writable: true, executable: false};
                this.mockFileSystem.set(fileToken, f);
            }
            f.content += content + "\n";
            f.size = f.content.length;
            // tee also writes to stdout
            this.output.push(content + "\n");
            this.exitCode = 0;
            return;
        }

        // Special case: grep -o PATTERN FILE | wc -l (top-level, without command substitution)
        // Minimal support to cover the mine counter exercise without full pipeline semantics
        {
            console.log("Executing command:", expandedLine);
            const m = expandedLine.match(/^\s*grep\s+-o\s+(.+?)\s+(.+?)\s*\|\s*wc\s+-l\s*$/);
            if (m) {
                console.log("Executing grep -o PATTERN FILE | wc -l");
                const rawPattern = this.expandVariables(m[1]).replace(/^["']|["']$/g, '');
                const rawFile = this.expandVariables(m[2]).replace(/^["']|["']$/g, '');
                const file = this.mockFileSystem.get(rawFile);
                let count = 0;
                if (file && typeof file.content === 'string') {
                    const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const rx = new RegExp(escapeRegExp(rawPattern), 'g');
                    const lines = file.content.split('\n');
                    for (const lineText of lines) {
                        if (lineText === '') continue;
                        const matches = lineText.match(rx);
                        if (matches) count += matches.length;
                    }
                }
                this.output.push(String(count) + '\n');
                this.exitCode = 0;
                return;
            }
        }

        const parts = this.parseCommandLine(expandedLine);
        if (parts.length === 0) return;
        const command = parts[0];
        const args = parts.slice(1);
        if (this.builtins.has(command)) {
            const result = await this.builtins.get(command)(args);
            if (result && typeof result.exitCode === 'number') {
                this.exitCode = result.exitCode;
            }
        } else {
            // Unknown command: set exit code to 127 like bash
            this.exitCode = 127;
        }
    }

    isAssignment(line) {
        // Treat a line starting with VAR= or VAR+= as an assignment, regardless of spaces in RHS
        return /^[a-zA-Z_][a-zA-Z0-9_]*\+?=/.test(line);
    }

    executeAssignment(line) {
        const equalIndex = line.indexOf('=');
        let namePart = line.substring(0, equalIndex);
        const isAppend = namePart.endsWith('+');
        if (isAppend) namePart = namePart.slice(0, -1);
        const varName = namePart;
        const value = line.substring(equalIndex + 1);

        // If RHS is a single arithmetic expansion $(( ... )), evaluate it directly
        const trimmedVal = value.trim();
        const singleArith = trimmedVal.match(/^\$\(\((.*)\)\)$/);
        if (singleArith && !isAppend) {
            const arithInner = singleArith[1];
            const num = this.evaluateArithmetic(arithInner);
            this.variables.set(varName, String(num));
            return;
        }
        // If RHS is a single command substitution $( ... ) (but not $(( ... ))), evaluate it directly
        const singleCmdSub = trimmedVal.match(/^\$\((?!\()(.*)\)$/);
        if (singleCmdSub && !isAppend) {
            const cmdInner = singleCmdSub[1];
            const subst = this.executeCommandSubstitution(cmdInner);
            this.variables.set(varName, (subst ?? '').toString().replace(/^["']|["']$/g, ''));
            return;
        }

        const expanded = this.expandVariables(value).replace(/^["']|["']$/g, '');
        if (isAppend) {
            const cur = this.variables.get(varName) || '';
            this.variables.set(varName, cur + expanded);
        } else {
            this.variables.set(varName, expanded);
        }
    }

    parseCommandLine(line) {
        // Tokenize respecting quotes and keeping $(...) and $((...)) blocks intact,
        // but strip the quote characters from resulting tokens (shell-like behavior).
        const parts = [];
        let cur = '';
        let i = 0;
        let inQuotes = false;
        let quote = '';
        let cmdSubDepth = 0; // depth for $( ... )
        let arithDepth = 0;  // depth for $(( ... )) tracking pairs of ))

        const peek = (k=0) => (i + k < line.length ? line[i + k] : '');

        while (i < line.length) {
            const ch = line[i];

            // Inside quotes: append content but drop the quote chars themselves
            if (inQuotes) {
                if (ch === quote) {
                    // end quote, do not include the quote char
                    inQuotes = false;
                    quote = '';
                    i++;
                    continue;
                }
                // Handle simple escapes inside double quotes: \" -> ", \\ -> \
                if (quote === '"' && ch === '\\') {
                    const n = peek(1);
                    if (n === '"' || n === '\\' || n === '$' || n === '`') {
                        cur += n; i += 2; continue;
                    }
                    // keep the backslash literally if not a recognized escape
                }
                cur += ch; i++;
                continue;
            }

            // Not in quotes
            if (ch === '"' || ch === "'") {
                inQuotes = true; quote = ch; i++; // do not include the quote char
                continue;
            }

            // Detect arithmetic substitution start $((
            if (ch === '$' && peek(1) === '(' && peek(2) === '(') {
                cur += '$(('; i += 3; arithDepth++;
                // consume until matching )) at depth 0
                while (i < line.length && arithDepth > 0) {
                    const c = line[i]; const n = peek(1);
                    cur += c;
                    if (c === '(' && n === '(') { arithDepth++; cur += n; i += 2; continue; }
                    if (c === ')' && n === ')') { arithDepth--; cur += n; i += 2; continue; }
                    i++;
                }
                continue;
            }

            // Detect command substitution start $(
            if (ch === '$' && peek(1) === '(') {
                cur += '$'; i += 2; cmdSubDepth = 1;
                // consume until matching ) accounting nested parentheses
                while (i < line.length && cmdSubDepth > 0) {
                    const c = line[i];
                    cur += c;
                    if (c === '(') cmdSubDepth++;
                    else if (c === ')') cmdSubDepth--;
                    i++;
                }
                continue;
            }

            // Split on whitespace only when not inside any substitution
            if ((ch === ' ' || ch === '\t' || ch === '\n') && cmdSubDepth === 0 && arithDepth === 0) {
                if (cur.length > 0) parts.push(cur);
                cur = '';
                i++;
                while (i < line.length && /\s/.test(line[i])) i++; // skip consecutive whitespace
                continue;
            }

            // Regular character
            cur += ch;
            i++;
        }
        if (cur.length > 0) parts.push(cur);
        return parts;
    }

    expandVariables(text) {
        if (!text) return text;

        let result = '';
        let i = 0;

        while (i < text.length) {
            const dollarIdx = text.indexOf('$', i);

            if (dollarIdx === -1) {
                // No more '$' found, append the rest of the string and finish.
                result += text.slice(i);
                break;
            }

            // Append the literal text found before the '$'.
            result += text.slice(i, dollarIdx);

            // Move the parser's index past the '$'.
            i = dollarIdx + 1;

            if (i >= text.length) {
                // The string ends with a literal '$'.
                result += '$';
                break;
            }

            const nextChar = text[i];

            if (nextChar === '{') {
                // It's a parameter expansion: ${...}
                i++; // Consume the '{'
                const exprStart = i;
                let braceDepth = 1;

                // Find the matching '}' to handle potential nesting in expressions.
                while (i < text.length && braceDepth > 0) {
                    if (text[i] === '{') braceDepth++;
                    if (text[i] === '}') braceDepth--;
                    if (braceDepth > 0) i++;
                }

                if (braceDepth === 0) {
                    const varExpr = text.slice(exprStart, i);
                    result += this.expandParameter(varExpr);
                    i++; // Consume the final '}'
                } else {
                    // Unmatched brace, treat as literal text.
                    result += '${' + text.slice(exprStart);
                }
            } else if (nextChar === '(') {
                i++; // Consume the '('
                if (i < text.length && text[i] === '(') {
                    // It's an arithmetic expansion: $((...))
                    i++; // Consume the second '('
                    const exprStart = i;
                    let parenDepth = 1; // Track nesting of parentheses

                    // Find the matching '))' with proper nesting support
                    while (i < text.length) {
                        if (i + 1 < text.length && text[i] === ')' && text[i + 1] === ')' && parenDepth === 1) {
                            // Found closing )) at the correct depth
                            break;
                        } else if (text[i] === '(') {
                            parenDepth++;
                        } else if (text[i] === ')') {
                            parenDepth--;
                        }
                        i++;
                    }

                    if (i < text.length) {
                        // We found the closing parentheses
                        const arithExpr = text.slice(exprStart, i);
                        const arithmeticResult = this.evaluateArithmetic(arithExpr);
                        result += arithmeticResult.toString();
                        i += 2; // Skip past the closing ))
                    } else {
                        // Unmatched, treat as literal
                        result += '$((' + text.slice(exprStart);
                    }
                } else {
                    // It's a command substitution: $(...)
                    const cmdStart = i;
                    let depth = 1;
                    // Find the matching ')'
                    while (i < text.length && depth > 0) {
                        if (text[i] === '(') depth++;
                        if (text[i] === ')') depth--;
                        i++;
                    }

                    if (depth === 0) {
                        const cmd = text.slice(cmdStart, i).trim();
                        result += this.executeCommandSubstitution(cmd);
                        i++; // Consume the final ')'
                    } else {
                        result += '$(' + text.slice(cmdStart); // Unmatched
                    }
                }
            } else if (/[a-zA-Z_0-9#@*]/.test(nextChar)) {
                // It's a simple variable expansion: $var
                const varStart = i;
                // Handle special single-character variables ($#, $1, etc.)
                if (/[0-9#@*]/.test(nextChar)) {
                    i++;
                } else {
                    // Handle regular variable names (e.g., $my_var)
                    while (i < text.length && /[a-zA-Z0-9_]/.test(text[i])) {
                        i++;
                    }
                }
                const varName = text.slice(varStart, i);
                result += this.variables.get(varName) || '';
            } else {
                // Not a recognized expansion type, treat '$' as a literal character.
                result += '$';
            }
        }
        return result;
    }

    executeCommandSubstitution(command) {
        if (command.startsWith('seq')) {
            const parts = this.parseCommandLine(command);
            parts.shift();
            // Accept 1,2,3 argument forms; ensure numeric and inclusive
            let start = 1, inc = 1, end = 1;
            const nums = parts.map(p => this.evaluateArithmetic(this.expandVariables(p)));
            if (nums.length === 1) {
                end = nums[0];
            } else if (nums.length === 2) {
                start = nums[0];
                end = nums[1];
            } else if (nums.length >= 3) {
                start = nums[0];
                inc = nums[1] === 0 ? 1 : nums[1];
                end = nums[2];
            }
            // Clamp unreasonable bounds
            if (inc === 0) inc = 1;
            const out = [];
            if (inc > 0) {
                for (let i = start; i <= end; i += inc) out.push(i.toString());
            } else {
                for (let i = start; i >= end; i += inc) out.push(i.toString());
            }
            return out.join(' ');
        }
        // Special case: grep -o PATTERN FILE | wc -l (top-level, without command substitution)
        // Minimal support to cover the mine counter exercise without full pipeline semantics
        {
            const m = command.match(/^\s*grep\s+-o\s+(.+?)\s+(.+?)\s*\|\s*wc\s+-l\s*$/);
            if (m) {
                const rawPattern = this.expandVariables(m[1]).replace(/^["']|["']$/g, '');
                const rawFile = this.expandVariables(m[2]).replace(/^["']|["']$/g, '');
                const file = this.mockFileSystem.get(rawFile);
                let count = 0;
                if (file && typeof file.content === 'string') {
                    const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const rx = new RegExp(escapeRegExp(rawPattern), 'g');
                    const lines = file.content.split('\n');
                    for (const lineText of lines) {
                        if (lineText === '') continue;
                        const matches = lineText.match(rx);
                        if (matches) count += matches.length;
                    }
                }
                return String(count);
            }
        }
        return '';
    }

    removePrefixByPattern(value, pattern, longest) {
        const rx = this.shellPatternToRegex(pattern, true, true); // full-match the prefix part
        if (longest) {
            for (let j = value.length; j >= 0; j--) {
                const pref = value.slice(0, j);
                if (rx.test(pref)) return value.slice(j);
            }
        } else {
            for (let j = 0; j <= value.length; j++) {
                const pref = value.slice(0, j);
                if (rx.test(pref)) return value.slice(j);
            }
        }
        return value;
    }

    removeSuffixByPattern(value, pattern, longest) {
        const rx = this.shellPatternToRegex(pattern, true, true); // full-match the suffix part
        if (longest) {
            for (let i = 0; i <= value.length; i++) {
                const suff = value.slice(i);
                if (rx.test(suff)) return value.slice(0, i);
            }
        } else {
            for (let i = value.length; i >= 0; i--) {
                const suff = value.slice(i);
                if (rx.test(suff)) return value.slice(0, i);
            }
        }
        return value;
    }

    expandParameter(varExpr) {
        if (varExpr.startsWith('#')) {
            const name = varExpr.slice(1);
            if (name === '@' || name === '*') return (this.variables.get('#') || '0');
            const val = this.variables.get(name) || '';
            return val.length.toString();
        }

        // Handle substring extraction: ${var:offset:length}
        const substrMatch = varExpr.match(/^([a-zA-Z_][a-zA-Z0-9_]*)[:]([^:]+)(?::([^:]+))?$/);
        if (substrMatch && !varExpr.includes(':-') && !varExpr.includes(':=') && !varExpr.includes(':?')) {
            const [, varName, offRaw, lenRaw] = substrMatch;
            const value = this.variables.get(varName) || '';

            const expandedOffRaw = this.expandVariables(offRaw.trim());
            const getNumber = (str) => {
                if (/^[+-]?\d+$/.test(str)) return parseInt(str, 10);
                try { if (/^[0-9+\-*/ ()]+$/.test(str)) return parseInt(eval(str), 10); } catch (e) {}
                return parseInt(str, 10) || 0;
            };

            let offset = getNumber(expandedOffRaw);
            if (offset < 0) offset = value.length + offset;
            if (offset < 0) offset = 0;
            if (offset > value.length) return '';

            if (lenRaw !== undefined) {
                const expandedLenRaw = this.expandVariables(lenRaw.trim());
                let length = getNumber(expandedLenRaw);
                if (length < 0) length = value.length - offset + length;
                if (length < 0) return '';
                return value.substr(offset, length);
            }
            return value.substr(offset);
        }

        // --- CORRECTED LOGIC FOR DEFAULT VALUE OPERATORS ---

        // Handle ${VAR:-default} - Use default if unset or empty
        if (varExpr.includes(':-')) {
            const [vn, dv] = varExpr.split(':-', 2);
            const value = this.variables.get(vn);
            if (value === undefined || value === '') {
                return this.expandVariables(dv); // Also expand the default value
            }
            return value;
        }
        // Handle ${VAR:=default} - Assign default if unset or empty
        if (varExpr.includes(':=')) {
            const [vn, dv] = varExpr.split(':=', 2);
            const value = this.variables.get(vn);
            if (value === undefined || value === '') {
                const expandedDv = this.expandVariables(dv); // Expand default value before assigning
                this.variables.set(vn, expandedDv);
                return expandedDv;
            }
            return value;
        }
        // Handle ${VAR:?message} - Error if unset or empty
        if (varExpr.includes(':?')) {
            const [vn, msg] = varExpr.split(':?', 2);
            const value = this.variables.get(vn);
            if (value === undefined || value === '') {
                const expandedMsg = this.expandVariables(msg);
                const finalMsg = `${vn}: ${expandedMsg || 'parameter is unset or null'}`;
                // Mimic shell behavior: write to stderr and throw an exit signal
                this.errorOutput.push(finalMsg + '\n');
                this.exitCode = 1;
                throw new Error('EXIT'); // Signal to stop script execution
            }
            return value;
        }

        // Handle pattern removal operators (existing logic)
        if (/^[a-zA-Z_][a-zA-Z0-9_]*##/.test(varExpr)) {
            const [vn, pat] = varExpr.split('##', 2);
            const val = this.variables.get(vn) || '';
            return this.removePrefixByPattern(val, pat, true);
        }
        if (/^[a-zA-Z_][a-zA-Z0-9_]*#/.test(varExpr)) {
            const [vn, pat] = varExpr.split('#', 2);
            const val = this.variables.get(vn) || '';
            return this.removePrefixByPattern(val, pat, false);
        }
        if (/^[a-zA-Z_][a-zA-Z0-9_]*%%/.test(varExpr)) {
            const [vn, pat] = varExpr.split('%%', 2);
            const val = this.variables.get(vn) || '';
            return this.removeSuffixByPattern(val, pat, true);
        }
        if (/^[a-zA-Z_][a-zA-Z0-9_]*%/.test(varExpr)) {
            const [vn, pat] = varExpr.split('%', 2);
            const val = this.variables.get(vn) || '';
            return this.removeSuffixByPattern(val, pat, false);
        }

        // Handle pattern substitution (existing logic)
        const varNameMatch = varExpr.match(/^([a-zA-Z_][a-zA-Z0-9_]*)/);
        if (varNameMatch) {
            const vn = varNameMatch[1];
            let idx = vn.length;
            if (varExpr[idx] === '/') {
                let global = false;
                if (varExpr[idx + 1] === '/') { global = true; idx += 2; } else { idx += 1; }
                let anchoredPrefix = false, anchoredSuffix = false;
                if (varExpr[idx] === '#') { anchoredPrefix = true; idx += 1; }
                else if (varExpr[idx] === '%') { anchoredSuffix = true; idx += 1; }

                const readUntilSlash = (start) => {
                    let s = ''; let i = start;
                    while (i < varExpr.length) {
                        const ch = varExpr[i];
                        if (ch === '\\') {
                            if (varExpr[i + 1] === '/') { s += '/'; i += 2; continue; }
                            s += '\\'; i += 1; continue;
                        }
                        if (ch === '/') { i++; return { str: s, next: i, found: true }; }
                        s += ch; i++;
                    }
                    return { str: s, next: i, found: false };
                };

                const { str: rawPat, next: afterPat, found } = readUntilSlash(idx);
                if (found) {
                    const { str: rawRepl } = readUntilSlash(afterPat);
                    const patExpanded = this.expandVariables(rawPat);
                    const replExpanded = this.expandVariables(rawRepl);
                    const value = this.variables.get(vn) || '';
                    const makeRx = (p, anchorStart, anchorEnd) => this.shellPatternToRegex(p, anchorStart, anchorEnd);
                    let rx;
                    if (anchoredPrefix) rx = makeRx(patExpanded, true, false);
                    else if (anchoredSuffix) rx = makeRx(patExpanded, false, true);
                    else rx = makeRx(patExpanded, false, false);
                    const flags = global && !anchoredPrefix && !anchoredSuffix ? 'g' : '';
                    const re = new RegExp(rx.source, flags);
                    return value.replace(re, replExpanded);
                }
            }
        }

        // Simple variable expansion
        return this.variables.get(varExpr) || '';
    }

    // Convert shell glob to RegExp
    shellPatternToRegex(pattern, anchorStart = true, anchorEnd = true) {
        // Interpret backslashes as escaping the next character; only unescaped * and ? are wildcards
        let out = '';
        let esc = false;
        for (let i = 0; i < pattern.length; i++) {
            const ch = pattern[i];
            if (esc) {
                // Literal char, escape if regex-special
                if (/[.*+?^${}()|[\]\\]/.test(ch)) out += '\\' + ch; else out += ch;
                esc = false;
                continue;
            }
            if (ch === '\\') { esc = true; continue; }
            if (ch === '*') { out += '.*'; continue; }
            if (ch === '?') { out += '.'; continue; }
            // Escape regex specials
            if (/[.*+?^${}()|[\]\\]/.test(ch)) out += '\\' + ch; else out += ch;
        }
        const src = (anchorStart ? '^' : '') + out + (anchorEnd ? '$' : '');
        return new RegExp(src);
    }

    // Evaluate arithmetic expression(s) with side-effects for (( ... ))
    applyArithmeticSideEffects(expr) {
        let last = 0;
        const parts = expr.split(/[,;]+/).map(p => p.trim()).filter(Boolean);
        for (const part of parts) {
            if (/^[a-zA-Z_][a-zA-Z0-9_]*\+\+$/.test(part)) {
                const v = part.slice(0, -2);
                const cur = parseInt(this.variables.get(v) || '0');
                last = cur + 1;
                this.variables.set(v, last.toString());
                continue;
            }
            if (/^[a-zA-Z_][a-zA-Z0-9_]*--$/.test(part)) {
                const v = part.slice(0, -2);
                const cur = parseInt(this.variables.get(v) || '0');
                last = cur - 1;
                this.variables.set(v, last.toString());
                continue;
            }
            const asg = part.match(/^([a-zA-Z_][a-zA-Z0-9_]*)=(.+)$/);
            if (asg) {
                const [, v, rhs] = asg;
                last = this.evaluateArithmetic(rhs);
                this.variables.set(v, last.toString());
                continue;
            }
            last = this.evaluateArithmetic(part);
        }
        this.exitCode = last !== 0 ? 0 : 1; // bash: non-zero arithmetic result => success
        return last;
    }

    // Evaluate arithmetic expressions used in $((expr)) and inside (( expr )) and for C-style loops
    evaluateArithmetic(expr) {
        if (expr == null) return 0;

        // First step: fully expand variables in the expression
        let expandedExpr = this.expandVariables(expr);
        console.log(`Evaluating arithmetic: original='${expr}', expanded='${expandedExpr}'`);

        let e = String(expandedExpr);

        // Clean the expression of any trailing parentheses that might have been included incorrectly
        e = e.replace(/\)+$/, '');

        // Handle remaining expansions that might be needed after the first expansion
        // Expand ${#var} length forms (these should already be expanded by expandVariables)
        e = e.replace(/\$\{#([a-zA-Z0-9_*@]+)}/g, (m, name) => {
            if (name === '@' || name === '*') return this.variables.get('#') || '0';
            const v = this.variables.get(name) || '';
            return v.length.toString();
        });

        // Expand ${var} forms (these should already be expanded by expandVariables)
        e = e.replace(/\$\{([a-zA-Z0-9_]+)}/g, (m, name) => this.variables.get(name) || '0');

        // Expand $var forms (these should already be expanded by expandVariables)
        e = e.replace(/\$([a-zA-Z_][a-zA-Z0-9_]*|\d+|[#@*])/g, (m, name) => this.variables.get(name) || '0');

        // Replace bare identifiers with their numeric values
        e = e.replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g, (m, name) => {
            // Do not replace known JS keywords (minimal set)
            if (['true', 'false'].includes(name)) return name === 'true' ? '1' : '0';
            const v = this.variables.get(name);
            if (v === undefined) return '0';
            // If value isn't numeric, attempt parseInt, else 0
            if (/^[+-]?\d+$/.test(v.trim())) return v.trim();
            const parsed = parseInt(v, 10);
            return isNaN(parsed) ? '0' : parsed.toString();
        });

        // Make sure parentheses are balanced
        let openCount = (e.match(/\(/g) || []).length;
        let closeCount = (e.match(/\)/g) || []).length;

        // Remove any extra closing parentheses
        if (closeCount > openCount) {
            e = e.replace(/\){2,}$/, ')'.repeat(openCount));
        }

        // Prevent accidental execution of non-numeric tokens
        e = e.replace(/[^0-9+\-*/%()&|<>=!^ \t]/g, '');

        console.log(`Arithmetic expression after processing: '${e}'`);

        // Evaluate the expression
        try {
            // eslint-disable-next-line no-eval
            const val = eval(e);
            console.log(`Arithmetic result: ${val}`);
            if (typeof val === 'boolean') return val ? 1 : 0;
            if (typeof val === 'number' && isFinite(val)) return val; else return 0;
        } catch (error) {
            console.error(`Error evaluating arithmetic expression '${e}':`, error);
            return 0;
        }
    }

    numericCompare(left, right, op) {
        switch (op) {
            case'-eq':
                return left === right;
            case'-ne':
                return left !== right;
            case'-lt':
                return left < right;
            case'-le':
                return left <= right;
            case'-gt':
                return left > right;
            case'-ge':
                return left >= right;
            default:
                return false;
        }
    }

    async expandIterable(expr) {
        const expanded = this.expandVariables(expr);
        // The command substitution needs to be handled here because the `for` loop
        // does not call `executeCommand` directly on the iterable part.
        if (expanded.trim().startsWith('$(')) {
            const cmd = expanded.trim().slice(2, -1);
            return this.executeCommandSubstitution(cmd).split(/\s+/).filter(i => i.trim());
        }
        return expanded.split(/\s+/).filter(i => i.trim());
    }

    async evaluateCondition(condition) {
        const expanded = this.expandVariables(condition).trim();
        if (expanded.startsWith('[ ') && expanded.endsWith(' ]')) return this.evaluateTest(expanded.slice(2, -2));
        if (expanded.startsWith('[[ ') && expanded.endsWith(' ]]')) return this.evaluateTest(expanded.slice(3, -3));
        // Support arithmetic condition: if (( expr )); then
        if (/^\(\(.+\)\)$/.test(expanded)) {
            const inner = expanded.slice(2, -2).trim();
            const val = this.evaluateArithmetic(inner);
            return val !== 0;
        }
        if (expanded === 'true') return true;
        if (expanded === 'false') return false;
        // Fallback: execute the condition line as a command and use its exit code
        await this.executeCommand(expanded);
        return this.exitCode === 0;
    }

    evaluateTest(testExpr) {
        testExpr = testExpr.trim();
        console.log(`Evaluating test: "${testExpr}"`);
        if (testExpr.startsWith('! ')) {
            return !this.evaluateTest(testExpr.slice(2).trim());
        }
        const numericOps = ['-eq', '-ne', '-lt', '-le', '-gt', '-ge'];
        for (const op of numericOps) {
            if (testExpr.includes(` ${op} `)) {
                const [left, right] = testExpr.split(` ${op} `);
                const leftRaw = this.expandVariables(left.trim());
                const rightRaw = this.expandVariables(right.trim());
                const leftNum = parseInt(leftRaw.replace(/["']/g, ''));
                const rightNum = parseInt(rightRaw.replace(/["']/g, ''));
                if (isNaN(leftNum) || isNaN(rightNum)) return false;
                switch (op) {
                    case'-eq':
                        return leftNum === rightNum;
                    case'-ne':
                        return leftNum !== rightNum;
                    case'-lt':
                        return leftNum < rightNum;
                    case'-le':
                        return leftNum <= rightNum;
                    case'-gt':
                        return leftNum > rightNum;
                    case'-ge':
                        return leftNum >= rightNum;
                }
            }
        }
        if (testExpr.includes(' = ')) {
            const [l, r] = testExpr.split(' = ');
            const leftVal = this.expandVariables(l.trim()).replace(/["']/g, '');
            const rightRaw = this.expandVariables(r.trim()).replace(/["']/g, '');
            if (/[*?]/.test(rightRaw)) {
                return this.shellPatternToRegex(rightRaw).test(leftVal);
            }
            return leftVal === rightRaw;
        }
        if (testExpr.includes(' != ')) {
            const [l, r] = testExpr.split(' != ');
            const leftVal = this.expandVariables(l.trim()).replace(/["']/g, '');
            const rightRaw = this.expandVariables(r.trim()).replace(/["']/g, '');
            if (/[*?]/.test(rightRaw)) {
                return !this.shellPatternToRegex(rightRaw).test(leftVal);
            }
            return leftVal !== rightRaw;
        }
        if (testExpr.startsWith('-z ')) {
            const valRaw = this.expandVariables(testExpr.substring(3).trim());
            const val = valRaw.replace(/^["']|["']$/g, '');
            return val === '';
        }
        if (testExpr.startsWith('-n ')) {
            const valRaw = this.expandVariables(testExpr.substring(3).trim());
            const val = valRaw.replace(/^["']|["']$/g, '');
            return val !== '';
        }
        const fileTests = ['-f', '-d', '-r', '-w', '-x', '-e', '-s'];
        for (const t of fileTests) {
            if (testExpr.startsWith(`${t} `)) {
                const filepath = this.expandVariables(testExpr.substring(3).trim()).replace(/["']/g, '');
                const file = this.mockFileSystem.get(filepath);
                if (t === '-e') return !!file;
                if (!file) return false;
                switch (t) {
                    case '-f':
                        return true; // all mock entries are regular files
                    case '-d':
                        return false; // no directories in mock FS
                    case '-s':
                        return (file.size || 0) > 0 || (file.content && file.content.length > 0);
                    case '-r':
                        return !!file.readable;
                    case '-w':
                        return !!file.writable;
                    case '-x':
                        return !!file.executable;
                }
            }
        }
        return false;
    }

    cmdEcho(args) {
        let newline = true;
        let idx = 0;
        if (args[0] === '-n') {
            newline = false;
            idx = 1;
        }
        const content = args.slice(idx).join(' ');
        this.output.push(content);
        if (newline) this.output.push('\n');
        return {exitCode: 0};
    }

    cmdRead(args) {
        let variable = 'REPLY';
        let prompt = '';
        for (let i = 0; i < args.length; i++) {
            if (args[i] === '-p' && i + 1 < args.length) {
                prompt = args[++i].replace(/^(['"])(.*)\1$/, '$2');
            } else if (!args[i].startsWith('-')) {
                variable = args[i];
            }
        }
        if (prompt) this.errorOutput.push(prompt);
        let inputValue = '';
        let success = false;
        if (this.inputIndex < this.inputLines.length) {
            inputValue = this.inputLines[this.inputIndex++];
            success = true;
        }
        this.variables.set(variable, inputValue);
        return {exitCode: success ? 0 : 1};
    }

    cmdSeq(args) {
        let start = 1, inc = 1, end = 1;
        if (args.length === 1) {
            end = parseInt(args[0]) || 1;
        } else if (args.length === 2) {
            start = parseInt(args[0]) || 1;
            end = parseInt(args[1]) || 1;
        } else if (args.length === 3) {
            start = parseInt(args[0]) || 1;
            inc = parseInt(args[1]) || 1;
            end = parseInt(args[2]) || 1;
        }
        const out = [];
        if (inc > 0) {
            for (let i = start; i <= end; i += inc) out.push(i.toString());
        } else {
            for (let i = start; i >= end; i += inc) out.push(i.toString());
        }
        this.output.push(out.join('\n') + (out.length ? '\n' : ''));
        return {exitCode: 0};
    }

    cmdTest(args) {
        if (args[args.length - 1] === ']') args = args.slice(0, -1);
        const expr = args.join(' ');
        const res = this.evaluateTest(expr);
        this.exitCode = res ? 0 : 1;
        return {exitCode: this.exitCode};
    }

    cmdExit(args) {
        this.exitCode = args.length > 0 ? parseInt(args[0]) || 0 : 0;
        throw new Error('EXIT');
    }

    cmdCat(args) {
        for (const fn of args) {
            const f = this.mockFileSystem.get(fn);
            if (f) {
                this.output.push(f.content);
                if (!f.content.endsWith('\n')) this.output.push('\n');
            }
        }
        return {exitCode: 0};
    }

    cmdTee(args) {
        let append = false;
        let idx = 0;
        if (args[0] === '-a') {
            append = true;
            idx = 1;
        }
        const files = args.slice(idx);
        const content = this.output.join('');
        for (const fn of files) {
            let f = this.mockFileSystem.get(fn);
            if (!f) {
                f = {content: '', size: 0, readable: true, writable: true, executable: false};
                this.mockFileSystem.set(fn, f);
            }
            if (append) {
                f.content += content;
            } else {
                f.content = content;
            }
            f.size = f.content.length;
        }
        return {exitCode: 0};
    }

    cmdWc(args) {
        if (args.includes('-l')) {
            let lines = 0;
            const files = args.filter(a => a !== '-l');
            for (const fn of files) {
                const f = this.mockFileSystem.get(fn);
                if (f) {
                    lines += f.content.split('\n').length;
                }
            }
            this.output.push(lines.toString() + '\n');
        }
        return {exitCode: 0};
    }

    cmdGrep(args) {
        const opts = args.filter(a => a.startsWith('-'));
        const rest = args.filter(a => !a.startsWith('-'));
        if (rest.length < 2) return {exitCode: 0};
        const pattern = rest[0];
        const onlyMatch = opts.includes('-o');
        // Escape pattern for literal substring matching
        const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const rx = new RegExp(escapeRegExp(pattern), 'g');
        for (let i = 1; i < rest.length; i++) {
            const f = this.mockFileSystem.get(rest[i]);
            if (!f) continue;
            const lines = f.content.split('\n');
            for (const line of lines) {
                if (!line) { if (!onlyMatch && pattern === '') this.output.push('\n'); continue; }
                if (onlyMatch) {
                    const matches = line.match(rx) || [];
                    for (let k = 0; k < matches.length; k++) this.output.push(matches[k] + '\n');
                } else if (line.includes(pattern)) {
                    this.output.push(line + '\n');
                }
            }
        }
        return {exitCode: 0};
    }
}

class TestRunner {
    constructor() {
        this.bashRunner = new BashRunner();
    }

    async runTests(script, testCases) {
        const results = [];
        for (let i = 0; i < testCases.length; i++) {
            const tc = testCases[i];
            const r = await this.runSingleTest(script, tc, i + 1);
            results.push(r);
        }
        return results;
    }

    async runSingleTest(script, testCase, testNumber) {
        try {
            const input = testCase.input || [];
            const result = await this.bashRunner.executeScript(script, testCase.arguments, input);
            result.output = result.output.replace(/[ \n]+$/, '');
            testCase.expectedOutput = testCase.expectedOutput.replace(/[ \n]+$/, '');
            const passed = result.output === testCase.expectedOutput && result.exitCode === testCase.expectedExitCode;
            return {
                testNumber,
                passed,
                arguments: testCase.arguments,
                expectedOutput: testCase.expectedOutput,
                actualOutput: result.output,
                expectedExitCode: testCase.expectedExitCode,
                actualExitCode: result.exitCode,
                error: result.error || null
            };
        } catch (error) {
            return {
                testNumber,
                passed: false,
                arguments: testCase.arguments,
                expectedOutput: testCase.expectedOutput,
                actualOutput: '',
                expectedExitCode: testCase.expectedExitCode,
                actualExitCode: 1,
                error: error.message
            };
        }
    }
}

if (typeof window !== 'undefined') {
    window.BashRunner = BashRunner;
    window.TestRunner = TestRunner;
} else if (typeof module !== 'undefined' && module.exports) {
    module.exports = {BashRunner, TestRunner};
}

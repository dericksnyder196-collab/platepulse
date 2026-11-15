/* scripts/lib/prompt.js
 * Terminal prompts for the command-line scripts.
 */

const readline = require('readline');

// Asks a question and returns the typed answer.
function ask(question) {
    return new Promise((resolve) => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer);
        });
    });
}

// Like ask(), but nothing is shown while typing. Used for passwords.
function askHidden(question) {
    return new Promise((resolve, reject) => {
        if (!process.stdin.isTTY) {
            // Not an interactive terminal (for example piped input): fall back to a visible prompt.
            ask(question).then(resolve, reject);
            return;
        }

        process.stdout.write(question);
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.setEncoding('utf8');

        let value = '';

        function cleanup() {
            process.stdin.removeListener('data', onData);
            process.stdin.setRawMode(false);
            process.stdin.pause();
        }

        function onData(chunk) {
            for (const char of chunk) {
                if (char === '\u0003') {
                    // Ctrl+C
                    cleanup();
                    process.stdout.write('\n');
                    process.exit(130);
                }
                if (char === '\r' || char === '\n') {
                    cleanup();
                    process.stdout.write('\n');
                    resolve(value);
                    return;
                }
                if (char === '\u007f' || char === '\b') {
                    value = value.slice(0, -1);
                    continue;
                }
                value += char;
            }
        }

        process.stdin.on('data', onData);
    });
}

module.exports = { ask, askHidden };

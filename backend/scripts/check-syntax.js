/**
 * Syntax-checks every JavaScript file under backend/src without executing it.
 * Catches typos/parse errors across the whole tree in one command.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOTS = ['src', 'scripts', 'test']
  .map((name) => path.join(__dirname, '..', name))
  .filter((dir) => fs.existsSync(dir));

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

const files = ROOTS.flatMap(walk);
let failed = 0;

for (const file of files) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (err) {
    failed += 1;
    process.stderr.write(`FAIL ${path.relative(process.cwd(), file)}\n`);
    process.stderr.write(`${err.stderr || err.message}\n`);
  }
}

process.stdout.write(`checked ${files.length} file(s), ${failed} failed\n`);
process.exit(failed ? 1 : 0);

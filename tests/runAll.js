// Top-level ESM-compatible test runner for all test groups
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const groupRunners = [
  join(__dirname, 'core', 'runAll.js'),
  join(__dirname, 'performance', 'runAll.js')
];

async function runGroup(file) {
  return new Promise((resolve, reject) => {
    if (!existsSync(file)) return resolve();
    console.log(`\nRunning ${file}...`);
    const proc = spawn(process.execPath, [file], { stdio: 'inherit' });
    proc.on('exit', code => {
      if (code === 0) resolve();
      else reject(new Error(`Test group failed: ${file}`));
    });
  });
}

(async () => {
  try {
    for (const runner of groupRunners) {
      await runGroup(runner);
    }
    console.log('\nAll test groups passed.');
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
})();

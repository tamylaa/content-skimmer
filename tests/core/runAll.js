// Unified runner for core tests (env, upstream, downstream, search) - ESM compatible
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const testFiles = [
  'check-env.js',
  'check-downstream-results.js',
  'test-search-layer.js'
];

async function runTest(file) {
  return new Promise((resolve, reject) => {
    const filePath = join(__dirname, file);
    if (!existsSync(filePath)) return resolve();
    console.log(`\nRunning ${filePath}...`);
    const proc = spawn(process.execPath, [filePath], { stdio: 'inherit' });
    proc.on('exit', code => {
      if (code === 0) resolve();
      else reject(new Error(`Test failed: ${filePath}`));
    });
  });
}

(async () => {
  try {
    for (const file of testFiles) {
      await runTest(file);
    }
    console.log('\nAll core tests passed.');
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
})();

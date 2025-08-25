// scripts/predeploy-checklist.js
// One-click production deployment checklist for content-skimmer
// Run: node scripts/predeploy-checklist.js

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { loadWranglerEnv } from '../tests/loadWranglerConfig.js';
import 'dotenv/config';

function section(title) {
  console.log(`\n=== ${title} ===`);
}

function checkEnvVars(required) {
  let ok = true;
  for (const key of required) {
    if (!process.env[key]) {
      console.error(`❌ ${key}: MISSING`);
      ok = false;
    } else {
      console.log(`✅ ${key}: PRESENT`);
    }
  }
  return ok;
}

function runScript(scriptPath, label) {
  if (!existsSync(scriptPath)) {
    console.warn(`⚠️  ${label} script not found: ${scriptPath}`);
    return true;
  }
  try {
    console.log(`\n▶️  Running ${label}...`);
    execSync(`node "${scriptPath}"`, { stdio: 'inherit' });
    return true;
  } catch (e) {
    console.error(`❌ ${label} failed.`);
    return false;
  }
}

async function main() {
  section('Loading Config');
  loadWranglerEnv('production');

  section('Checking Required Environment Variables');
  const requiredVars = [
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY',
    'MEILISEARCH_HOST',
    'MEILI_MASTER_KEY',
    'DATA_SERVICE_URL',
    'CONTENT_STORE_SERVICE_URL',
    'DATA_SERVICE_API_KEY',
    'WEBHOOK_SECRET',
    'AUTH_JWT_SECRET',
    'LOG_LEVEL'
  ];
  const envOk = checkEnvVars(requiredVars);

  section('Running Core Tests');
  const coreOk = runScript(path.join('tests', 'core', 'runAll.js'), 'Core Tests');

  section('Running Performance Tests');
  const perfOk = runScript(path.join('tests', 'performance', 'runAll.js'), 'Performance Tests');

  section('Linting and Type Checking');
  let lintOk = true;
  try {
  execSync('npx eslint "src/**/*.ts"', { stdio: 'inherit' });
    execSync('npx tsc --noEmit', { stdio: 'inherit' });
    console.log('✅ Lint and type check passed.');
  } catch (e) {
    console.error('❌ Lint or type check failed.');
    lintOk = false;
  }

  section('Git Status');
  let gitOk = true;
  try {
    const status = execSync('git status --porcelain').toString();
    if (status.trim() === '') {
      console.log('✅ Working directory clean.');
    } else {
      console.warn('⚠️  Uncommitted changes present:');
      console.warn(status);
      gitOk = false;
    }
  } catch (e) {
    console.error('❌ Git status check failed.');
    gitOk = false;
  }

  section('Summary');
  if (envOk && coreOk && perfOk && lintOk && gitOk) {
    console.log('\n✅ All checks passed. Ready for production deployment!');
    process.exit(0);
  } else {
    console.error('\n❌ Pre-deployment checks failed. Fix issues before deploying.');
    process.exit(1);
  }
}

main();

// ESM-compatible helper to load wrangler.toml config vars into process.env for local tests
import fs from 'fs';
import toml from 'toml';

export function loadWranglerEnv(env = 'production') {
  const config = toml.parse(fs.readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf-8'));
  // Merge [vars] and [env.<env>.vars]
  const vars = { ...(config.vars || {}), ...((config[`env.${env}`] && config[`env.${env}`].vars) || {}) };
  for (const [k, v] of Object.entries(vars)) {
    if (!process.env[k]) process.env[k] = v;
  }
}

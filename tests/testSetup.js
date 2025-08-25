// Common test setup: loads wrangler.toml config vars for local test environment
import { loadWranglerEnv } from './loadWranglerConfig.js';
loadWranglerEnv('production'); // Change to 'staging' if needed

// Removes every file the output branch should not hold (images of an older README, stray files),
// so one leftover can never make validation, and with it every later publish, fail.
// Usage: node scripts/prune-output.mjs <dir>
import { readdirSync, rmSync, statSync } from 'node:fs';
import { ruleFor } from './lib/rules.mjs';

const dir = process.argv[2];
if (!dir) throw new Error('Usage: prune-output.mjs <dir>');

for (const file of readdirSync(dir)) {
  const path = `${dir}/${file}`;
  if (statSync(path).isFile() && ruleFor(file)) continue;
  rmSync(path, { recursive: true, force: true });
  console.log(`Removed ${file}`);
}

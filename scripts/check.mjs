import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const root = resolve(import.meta.dirname, '..');
let checked = 0;
let errors = 0;
function check(source, file, module = false) {
  const result = spawnSync(process.execPath, ['--check', ...(module ? ['--input-type=module'] : [])], { input: source, encoding: 'utf8' });
  if (result.status !== 0) { console.error(file, result.stderr); errors++; }
  checked++;
}
async function walk(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    if (['.git', 'dist', 'node_modules', '.codex', '.agents'].includes(item.name)) continue;
    const file = resolve(directory, item.name);
    if (item.isDirectory()) { await walk(file); continue; }
    if (!/\.(js|mjs|html)$/.test(file)) continue;
    const source = await readFile(file, 'utf8');
    if (/\.(js|mjs)$/.test(file)) check(source, file, true);
    else for (const match of source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      if (/\bsrc\s*=/.test(match[1]) || /application\/(ld\+)?json/.test(match[1])) continue;
      check(match[2], file, /type=["']module/.test(match[1]));
    }
  }
}
await walk(root);
console.log(`Syntax lint: ${checked} source blocks checked, ${errors} failures. No TypeScript sources.`);
process.exitCode = errors ? 1 : 0;

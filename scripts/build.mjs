import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'dist');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
const directories = new Set(['site', 'tools', 'dashboards']);
const extensions = /\.(html|css|svg|webmanifest)$/;
for (const entry of await readdir(root, { withFileTypes: true })) {
  if (directories.has(entry.name) || (entry.isFile() && extensions.test(entry.name)) || entry.name === 'service-worker.js' || entry.name === '_headers') {
    await cp(resolve(root, entry.name), resolve(output, entry.name), { recursive: true });
  }
}
console.log('Built static application in dist/. Connected API is a separate service.');

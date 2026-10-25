import { readFile, mkdir, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname, sep } from 'node:path';
const root = import.meta.dirname;
const raw = await readFile(resolve(root, 'signal-noir-source.json'));
if (createHash('sha256').update(raw).digest('hex') !== '3732dee95488be615ed6e288656fc264a4e323a092659c5ed6c06dd385e51548') throw new Error('The source bundle is incomplete or changed. Upload the original signal-noir-source.json.');
const assets = JSON.parse(raw.toString('utf8'));
for (const name of ['index.html', 'site/home.js', 'site/site.css', 'tools/index.html', 'tools/shared/platform.js', 'tools/shared/design-system.css', 'tools/studio/index.html', '_headers']) {
  if (typeof assets[name] !== 'string') throw new Error(`Missing required asset: ${name}`);
}
if (!assets['index.html'].includes('id="hero-title"')) throw new Error('Missing Signal Noir homepage.');
const output = resolve(root, 'dist');
for (const [name, content] of Object.entries(assets)) {
  if (typeof content !== 'string' || name.split('/').some(part => !part || part.startsWith('.')) || !resolve(output, name).startsWith(output + sep)) throw new Error(`Invalid asset: ${name}`);
}
await rm(output, { recursive: true, force: true });
for (const [name, content] of Object.entries(assets)) {
  const target = resolve(output, name);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content);
}
console.log(`Built ${Object.keys(assets).length} verified public assets in dist/.`);

import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';

const dist = resolve('dist');
const base = `${(process.env.PAGES_BASE_PATH ?? '/PaperRun').replace(/\/$/, '')}/`;
const html = readFileSync(join(dist, 'index.html'), 'utf8');
assert.ok(!html.includes('%BASE_URL%'), 'HTML contains an unresolved base URL');
assert.match(html, /<script[^>]+type="module"/);
assert.match(html, /rel="stylesheet"/);

// Check the HTML Vite actually emitted, including the favicon and entry chunks.
for (const [, url] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  assert.ok(url.startsWith(base), `Asset escapes the Pages path ${base}: ${url}`);
  const file = resolve(dist, url.slice(base.length));
  assert.ok(file.startsWith(dist + sep), `Invalid output path: ${url}`);
  assert.ok(statSync(file).isFile(), `Missing HTML asset: ${url}`);
}

function filesUnder(directory, prefix = '') {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const name = join(prefix, entry.name);
    assert.ok(!entry.isSymbolicLink(), `Deployment cannot contain a symlink: ${name}`);
    return entry.isDirectory() ? filesUnder(join(directory, entry.name), name) : [name];
  });
}

const builtFiles = filesUnder(dist);
assert.ok(builtFiles.every(file => !file.endsWith('.map')), 'Source maps are not intended for publication');
const browserCode = builtFiles.filter(file => file.endsWith('.js'))
  .map(file => readFileSync(join(dist, file), 'utf8')).join('\n');
for (const asset of ['pdf.worker.min.mjs', 'cmaps/', 'standard_fonts/', 'wasm/']) {
  assert.ok(browserCode.includes(base + asset), `Browser bundle is missing the Pages URL: ${base + asset}`);
}

// Require exact copies of the worker, font/CMap/WASM assets and all their notices.
const pdfSource = resolve('node_modules/pdfjs-dist');
assert.deepEqual(readFileSync(join(dist, 'pdf.worker.min.mjs')),
  readFileSync(join(pdfSource, 'legacy/build/pdf.worker.min.mjs')));
let pdfAssets = 1;
for (const folder of ['cmaps', 'standard_fonts', 'wasm']) {
  const files = filesUnder(join(pdfSource, folder));
  assert.ok(files.some(file => /^(licen[sc]e|notice|copying|copyright)/i.test(file)), `Missing notices: ${folder}`);
  for (const file of files) {
    assert.deepEqual(readFileSync(join(dist, folder, file)),
      readFileSync(join(pdfSource, folder, file)), `Changed or missing PDF asset: ${folder}/${file}`);
    pdfAssets++;
  }
}
const notices = readFileSync(join(dist, 'THIRD_PARTY_NOTICES.txt'));
assert.deepEqual(readFileSync(join(dist, 'samples/the-tortoise-and-the-hare.pdf')),
  readFileSync('public/samples/the-tortoise-and-the-hare.pdf'), 'Missing or changed built-in story PDF');
assert.ok(browserCode.includes(base + 'samples/the-tortoise-and-the-hare.pdf'), 'Story URL does not use the Pages path');
assert.deepEqual(notices, readFileSync('public/THIRD_PARTY_NOTICES.txt'));
assert.ok(notices.toString().includes(readFileSync('scripts/notices/core-js-3.45.1-LICENSE.txt', 'utf8').trim()),
  'Missing licence for the polyfills bundled into PDF.js legacy');
assert.ok(notices.length > 1000, 'Generated dependency notices are unexpectedly empty');
console.log(`Verified GitHub Pages output at ${base}: HTML assets, runtime PDF URLs, ${pdfAssets} PDF assets, and licence notices.`);

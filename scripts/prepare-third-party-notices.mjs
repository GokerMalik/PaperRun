import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';

const root = process.cwd();
const seen = new Set();
const sections = [];
const index = [];

function locatePackage(name, from = root) {
  let directory = from;
  for (;;) {
    const candidate = join(directory, 'node_modules', name);
    if (existsSync(join(candidate, 'package.json'))) return candidate;
    const parent = dirname(directory);
    if (parent === directory) throw new Error(`Install the required dependency before building: ${name}`);
    directory = parent;
  }
}

function includeNotice(directory, file, label) {
  const text = readFileSync(join(directory, file), 'utf8');
  if (!text.trim()) throw new Error(`Empty licence notice: ${label}/${file}`);
  sections.push(`${'='.repeat(72)}\n${label} — ${file}\n${'='.repeat(72)}\n\n${text.trim()}\n`);
}

function visitPackage(name, from = root, includeDependencies = true) {
  const directory = locatePackage(name, from);
  if (seen.has(directory)) return;
  seen.add(directory);
  const manifest = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'));
  const label = `${manifest.name}@${manifest.version}`;
  const notices = readdirSync(directory, { withFileTypes: true })
    .filter(entry => entry.isFile() && /^(licen[sc]e|notice|copying|copyright)/i.test(entry.name))
    .map(entry => entry.name).sort();
  if (!notices.length) throw new Error(`Review missing licence text before distributing ${label}`);
  index.push(`${label} | ${manifest.license ?? 'See full licence text'} | ${relative(root, directory).replaceAll('\\', '/')}`);
  for (const file of notices) includeNotice(directory, file, label);
  if (includeDependencies) {
    for (const dependency of Object.keys(manifest.dependencies ?? {}).sort()) visitPackage(dependency, directory);
  }
}

// Browser application libraries and their required dependencies. Optional native
// PDF.js canvas support is not sent to browsers and is deliberately not included.
const project = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
for (const name of Object.keys(project.dependencies).sort()) visitPackage(name);
// Generated CSS derives from Tailwind; preserve its notice as well.
visitPackage('tailwindcss');
// Vite injects small preload/runtime helpers into the browser build. Its build
// tool dependencies are not shipped, so include only Vite's own notices here.
visitPackage('vite', root, false);
const pdfDirectory = locatePackage('pdfjs-dist');
// PDF.js bundles core-js into its legacy builds without declaring it as an npm
// dependency. Preserve the matching upstream MIT notice in the deployed site.
const bundledPolyfillVersion = '3.45.1';
for (const bundle of ['pdf.mjs', 'pdf.worker.mjs']) {
  const code = readFileSync(join(pdfDirectory, 'legacy/build', bundle), 'utf8');
  const versions = [...code.matchAll(/core-js\/blob\/v([^/]+)\/LICENSE/g)].map(match => match[1]);
  if (!versions.length || versions.some(version => version !== bundledPolyfillVersion)) {
    throw new Error(`Review the bundled core-js licence after updating PDF.js: ${bundle}`);
  }
}
index.push(`core-js@${bundledPolyfillVersion} | MIT | bundled in PDF.js legacy builds`);
includeNotice(resolve('scripts/notices'), `core-js-${bundledPolyfillVersion}-LICENSE.txt`, `core-js@${bundledPolyfillVersion}`);
for (const folder of ['cmaps', 'standard_fonts', 'wasm']) {
  const assetDirectory = join(pdfDirectory, folder);
  const notices = readdirSync(assetDirectory).filter(file => /^(licen[sc]e|notice|copying|copyright)/i.test(file)).sort();
  if (!notices.length) throw new Error(`Review missing PDF.js asset notices: ${folder}`);
  for (const file of notices) includeNotice(assetDirectory, file, `pdfjs-dist/${folder}`);
}

mkdirSync(resolve('public'), { recursive: true });
writeFileSync(resolve('public/THIRD_PARTY_NOTICES.txt'), [
  'PaperRun — third-party browser dependency notices',
  '',
  'PaperRun original code is licensed under MIT. The following third-party',
  'components retain their own copyright holders and licence terms.',
  'This file covers browser application dependencies and copied PDF assets.',
  'It is not a licence inventory of the development toolchain.',
  '',
  ...index,
  '',
  ...sections,
].join('\n'));
console.log(`Prepared browser licence notices for ${seen.size} installed packages and PDF.js assets.`);

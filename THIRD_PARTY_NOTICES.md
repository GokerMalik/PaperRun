# Third-party software

The root MIT `LICENSE` applies to PaperRun's original code. It does not replace the licences or copyright notices of third-party components.

## Components included in the browser build

| Component | Licence |
| --- | --- |
| React, React DOM, Scheduler | MIT |
| pdf-lib and its required helpers | MIT, Zlib, and 0BSD; see the generated full notices |
| PDF.js | Apache-2.0 |
| core-js polyfills bundled within PDF.js's legacy builds | MIT |
| Lucide icons | ISC, with MIT notices for icons derived from Feather |
| Tailwind-generated styles | MIT |
| Vite's generated browser helpers | MIT; see the installed Vite notices |

PDF.js also distributes CMaps, fonts, and WebAssembly components under their own notices, including BSD-style terms and the SIL Open Font License. These assets are copied without modification, together with their original licence files.

The compatibility build embeds core-js 3.45.1. Its [upstream MIT notice](https://github.com/zloirock/core-js/blob/v3.45.1/LICENSE) is retained in `scripts/notices/core-js-3.45.1-LICENSE.txt` and included in the generated browser notices. This is a licence text, not vendored implementation code. Notice generation checks the embedded version in both PDF.js bundles so upgrades require a matching notice review.

`npm run dev` and `npm run build` generate `public/THIRD_PARTY_NOTICES.txt` from the installed application dependencies and their required dependency trees, Tailwind, Vite's own notices, and PDF.js asset notices. Optional native PDF.js canvas packages are not used or shipped by this browser application. Generation fails when an expected package or asset licence text is missing.

The static build includes this inventory and the licence files within `cmaps/`, `standard_fonts/`, and `wasm/`. Keep them when distributing a build. The inventory is served under the GitHub Pages base path, for example `https://<username>.github.io/PaperRun/THIRD_PARTY_NOTICES.txt`. `npm run check:dist` verifies that these assets and notices reach the deployment output unchanged.

## Source and development dependencies

Third-party implementations are installed through npm, not vendored in this source repository. `package.json` and `package-lock.json` describe those dependencies; `.gitignore` excludes installed packages, generated PDF assets, generated notices, and build output. The previous hosting starter, copied UI components, and vendor stylesheets have been removed.

Serving the compiled website distributes the library code included in it. PaperRun's MIT licence does not relicense those components; their full notices accompany the deployed site. Development tools retain their own licences in their installed packages. The generated notice inventory describes the browser distribution, not an independently distributed development toolchain. Review additions or changes to dependencies for any new attribution or distribution requirements.

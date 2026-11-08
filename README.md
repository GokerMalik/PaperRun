# PaperRun

A mobile-only PDF running game built with React and Vite for **GitHub Pages**. Selected PDFs, extracted text, geometry, and run results stay in browser memory. There is no PDF upload endpoint, analytics, account system, or persistent document storage. Users can explicitly download their results as JSON.

## Publish on GitHub Pages

1. Create your GitHub repository and commit/push this project's source, including `package-lock.json` and `.github/workflows/pages.yml`, to its default branch.
2. In the repository's **Settings → Pages → Build and deployment**, select **GitHub Actions** as the source.
3. In **Actions**, select **Deploy PaperRun to GitHub Pages** and choose **Run workflow** on the default branch. This is useful for the first deployment after enabling Pages. Later pushes to the default branch deploy automatically.

The workflow installs locked dependencies with `npm ci`, runs the game tests, type-checks and builds the site, verifies the generated assets and notices, then deploys only `dist/`. It reads the base path from GitHub Pages, so repository renames and root Pages sites use the correct asset URLs. Deployments from other branches are skipped. No personal access token, external hosting account, database, or manually maintained `gh-pages` branch is needed.

For a repository named `PaperRun`, the usual URL is `https://<username>.github.io/PaperRun/`. GitHub shows the actual URL in the deployment and Pages settings. The repository remains source-only: `node_modules/`, `dist/`, and generated PDF.js assets are intentionally ignored. The workflow generates and packages them when deploying.

See [Vite's GitHub Pages guide](https://vite.dev/guide/static-deploy#github-pages) and [GitHub's workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Example PDFs

**Try a sample** opens the bundled [The Tortoise and the Hare PDF](public/samples/the-tortoise-and-the-hare.pdf). This is an actual six-page illustrated storybook, with real A4 dimensions (1.782 m total), five pages of selectable story text, and a final wordless illustration of the tortoise and hare dancing together. The last page intentionally contributes zero words to the statistics. The story is an original retelling of the traditional Aesop fable, with original AI-generated illustrations created for PaperRun using ChatGPT. No scanned book or downloaded edition is included.

The PDF is intentionally tracked in `public/samples/` and copied into the GitHub Pages build. It is downloaded from the same site only when the sample is selected. Uploaded user PDFs still stay on the device. The runtime no longer creates the example from basic drawing primitives.

## Development

Requires Node.js 22.13+ and npm. The deployment workflow uses Node.js 22.

```sh
npm ci
npm run dev
```

The local development URL is `http://localhost:5173/PaperRun/`. Both development and local production previews use `/PaperRun/` to exercise the same nested paths as the project site. Asset preparation and licence generation run automatically before development and production builds.

Open the site on a phone or tablet with multitouch support. Choose a PDF or select **Try a sample**, then swipe down in either lane, alternating fingers. The paper stays in its normal reading direction while the course advances and the view scrolls upward. Desktop browsers show “Please use a mobile device” in place of the upload controls. Running accepts touch input only; mouse, keyboard, and wheel movement cannot advance the course. For a phone on the same network, use `npm run dev -- --host=0.0.0.0` and visit `http://<computer-LAN-IP>:5173/PaperRun/`; the phone's own localhost does not point to your computer.

For desktop testing only, append `?desktop-test=1` to the URL, for example `https://<username>.github.io/PaperRun/?desktop-test=1`. This deliberately bypasses the mobile-device gate so the PDF validation, loading, rendering, and dashboard can be tested with a mouse. It does not change the touch-only swipe handling; use a touch-capable browser or test the run engine separately for gesture input.

## Measurement and validation

- Every page must contain a valid MediaBox, directly or through PDF page-tree inheritance. No viewer fallback dimensions are accepted.
- UserUnit uses the PDF-standard default of 1 when omitted (1/72 inch); explicit invalid units are rejected. Rotation must be a multiple of 90 degrees.
- Course length is the sum of rotated full MediaBox heights. Mixed sizes and valid reversed rectangle coordinates are supported. CropBox is expanded to MediaBox only in a temporary in-memory rendering copy, so the display matches the full sheet.
- Gesture displacement uses CSS pixels at the nominal 96 px/in conversion. It does not depend on device-pixel ratio, frame rate, or event frequency. Exact physical finger travel differs across screens; physical calibration is not implemented.
- No inertia, negative travel, or overlapping-finger double-counting. Each completed stroke must alternate sides. All time from Start to the finish counts, including idle time, explicit pauses, background time, and screen lock. Pausing stops input only.
- Speed is measured paper distance divided by total elapsed time, in km/h. Live speed uses an approximately 0.7-second window. Per-page split times resolve at the input event crossing a page boundary.

Device detection combines browser mobile identity with multitouch support, including iPadOS desktop mode. Screen width alone never enables play. Browser identity can be spoofed; this is a compatibility gate, not a security boundary. Elapsed time uses wall-clock timestamps to include device sleep; changing the system clock can affect results. JSON exports use `totalTimeSeconds`.

## Limits

30 MB / 300 pages. Encrypted PDFs are rejected. Word count is based on extracted text with Intl.Segmenter; scans are not OCR'd, and extraction may have layout/language limitations. Heading/section splits are deferred; page splits are available. No leaderboard or persistent history. The original input PDF is never modified on disk.

## Verification

```sh
npm test
npm run build
npm run check:dist
npm run preview
```

Preview the production build at `http://localhost:4173/PaperRun/`. The build includes TypeScript checking. `check:dist` validates the emitted HTML's asset paths, PDF worker/font/CMap/WASM URLs, exact copies of the PDF assets and their licence files, and the generated third-party notice file. When testing another Pages path locally, set `PAGES_BASE_PATH` to that path for build, verification, and preview; Actions supplies it automatically.

Core tests cover missing/inherited/invalid sizes, rotation, UserUnit, CropBox, event-frequency independence, alternating fingers, continuous timing through pauses and phone sleep, finish clamping, live-speed decay, and mobile/desktop device detection. PDF.js assets are served from the same site rather than an external CDN.

PDF geometry follows ISO 32000-1:2008, sections 7.7.3.3 and 14.11.2: https://opensource.adobe.com/dc-acrobat-sdk-docs/pdfstandards/PDF32000_2008.pdf

## Acknowledgements

PaperRun was built with assistance from **ChatGPT by OpenAI**, using Codex for implementation, visual design, testing, and iteration. The project concept, requirements, and creative direction came from the project author.

PDF parsing and rendering use the open-source **pdf-lib** and **PDF.js** libraries. Interface icons come from **Lucide**.

## Licensing

PaperRun's original code is [MIT licensed](LICENSE). Third-party components retain their own licences. See [Third-party software](THIRD_PARTY_NOTICES.md) for notices and distribution requirements. Browser dependency notices are generated during development and production builds and served as `THIRD_PARTY_NOTICES.txt` beneath the site's Pages path.

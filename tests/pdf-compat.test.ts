import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { MessageChannel, Worker as NodeWorker } from 'node:worker_threads';
import { loadPdfRenderer } from '../src/lib/pdf.ts';
import { validatePaper } from '../src/lib/paper.ts';
import { removeRecentFeatures } from './fixtures/older-runtime.ts';

test('sample opens and extracts text with recent APIs absent in both page and worker', { timeout: 30_000 }, async () => {
  const bytes = await readFile(new URL('../public/samples/the-tortoise-and-the-hare.pdf', import.meta.url));
  const geometry = await validatePaper(bytes);
  removeRecentFeatures();
  assert.equal(typeof Promise.withResolvers, 'undefined');

  const pdfjs = await loadPdfRenderer('/PaperRun/pdf.worker.min.mjs');
  assert.equal(typeof Promise.withResolvers, 'function');
  assert.equal(typeof Promise.try, 'function');
  assert.equal(pdfjs.GlobalWorkerOptions.workerSrc, `/PaperRun/pdf.worker.min.mjs?build=${pdfjs.version}-legacy`);

  // The legacy import also supplies Node's DOMMatrix. With that unrelated
  // browser API available, reproduce the old build's exact missing method.
  const modern = await import('pdfjs-dist');
  const resolverDescriptor = Object.getOwnPropertyDescriptor(Promise, 'withResolvers')!;
  Reflect.deleteProperty(Promise, 'withResolvers');
  try {
    assert.throws(() => modern.getDocument({ data: geometry.renderBytes.slice() }), /withResolvers/);
  } finally {
    Object.defineProperty(Promise, 'withResolvers', resolverDescriptor);
  }

  const channel = new MessageChannel();
  const worker = new NodeWorker(new URL('./fixtures/pdf-worker-compat.ts', import.meta.url), {
    workerData: { port: channel.port2 }, transferList: [channel.port2],
  });
  let pdfWorker: InstanceType<typeof pdfjs.PDFWorker> | undefined;
  let loadingTask: ReturnType<typeof pdfjs.getDocument> | undefined;
  try {
    const [ready] = await once(worker, 'message');
    assert.equal(ready, 'compatibility-worker-ready');
    channel.port1.start();
    // @ts-expect-error PDF.js accepts a message port at runtime but declares port as null.
    pdfWorker = new pdfjs.PDFWorker({ port: channel.port1 });
    loadingTask = pdfjs.getDocument({
      data: geometry.renderBytes.slice(), worker: pdfWorker, isEvalSupported: false, stopAtErrors: true,
      standardFontDataUrl: fileURLToPath(new URL('../node_modules/pdfjs-dist/standard_fonts/', import.meta.url)).replaceAll('\\', '/'),
    });
    const document = await loadingTask.promise;
    assert.equal(document.numPages, geometry.pages.length);
    assert.equal(document.numPages, 6);
    for (let n = 1; n <= document.numPages; n++) {
      const page = await document.getPage(n);
      const content = await page.getTextContent();
      const text = content.items.map(item => 'str' in item ? item.str : '').join(' ');
      if (n < 6) assert.ok(text.trim().length > 100, `Story text missing on page ${n}`);
      else assert.equal(text.trim(), '', 'Closing illustration is intentionally wordless');
      assert.ok(Math.abs(page.getViewport({ scale: 1 }).height * 25.4 / 72 - 297) < 0.001);
      page.cleanup();
    }
  } finally {
    await loadingTask?.destroy();
    pdfWorker?.destroy();
    await worker.terminate();
    channel.port1.close();
  }
});

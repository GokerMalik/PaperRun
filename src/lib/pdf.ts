/** Use PDF.js's own compatibility build in both the page and its worker. */
export async function loadPdfRenderer(workerUrl: string) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  // A distinct cache key also avoids reusing the previously deployed modern worker.
  pdfjs.GlobalWorkerOptions.workerSrc = `${workerUrl}?build=${pdfjs.version}-legacy`;
  return pdfjs;
}

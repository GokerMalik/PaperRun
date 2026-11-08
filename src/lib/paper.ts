import { PDFDocument, PDFArray, PDFDict, PDFName, PDFNumber } from 'pdf-lib';

export const MM_PER_UNIT = 25.4 / 72;
export type PageSize = { index: number; widthMm: number; heightMm: number; startMm: number; box: number[]; unit: number; rotation: number };
export type PaperGeometry = { pages: PageSize[]; totalMm: number; renderBytes: Uint8Array };

function inherited(dict: PDFDict, name: string): unknown {
  const seen = new Set<PDFDict>();
  let node: PDFDict | undefined = dict;
  while (node) {
    if (seen.has(node)) throw new Error('Circular page inheritance.');
    seen.add(node);
    const value = node.get(PDFName.of(name));
    if (value !== undefined) return node.context.lookup(value);
    const parent: unknown = node.context.lookup(node.get(PDFName.of('Parent')));
    if (parent !== undefined && !(parent instanceof PDFDict)) throw new Error('Invalid page parent.');
    node = parent as PDFDict | undefined;
  }
}

/** Inspect raw dictionaries: never use a viewer's repaired or default page size. */
export async function validatePaper(bytes: Uint8Array): Promise<PaperGeometry> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false, throwOnInvalidObject: true });
  const leaves = doc.getPages();
  if (!leaves.length) throw new Error('This PDF has no pages.');
  if (leaves.length > 300) throw new Error('Please choose a PDF with 300 pages or fewer for this version.');
  const pages: PageSize[] = [];
  const problems: string[] = [];
  let totalMm = 0;
  leaves.forEach((page, index) => {
    try {
      const box = inherited(page.node, 'MediaBox');
      if (!(box instanceof PDFArray) || box.size() !== 4) throw new Error('missing or invalid physical page size (MediaBox)');
      const coords = box.asArray().map(v => {
        const n = doc.context.lookup(v);
        if (!(n instanceof PDFNumber) || !Number.isFinite(n.asNumber())) throw new Error('invalid page dimensions');
        return n.asNumber();
      });
      const rawUnit = page.node.get(PDFName.of('UserUnit'));
      const unitObject = rawUnit === undefined ? undefined : doc.context.lookup(rawUnit);
      if (rawUnit !== undefined && !(unitObject instanceof PDFNumber)) throw new Error('invalid physical unit (UserUnit)');
      const unit = unitObject instanceof PDFNumber ? unitObject.asNumber() : 1;
      if (!Number.isFinite(unit) || unit <= 0 || unit > 75000) throw new Error('invalid physical unit (UserUnit)');
      const rotate = inherited(page.node, 'Rotate');
      if (rotate !== undefined && !(rotate instanceof PDFNumber)) throw new Error('invalid page rotation');
      const rotation = rotate instanceof PDFNumber ? rotate.asNumber() : 0;
      if (!Number.isFinite(rotation) || rotation % 90 !== 0) throw new Error('invalid page rotation');
      // PDF rectangles may specify either pair of diagonally opposite corners.
      const x = Math.min(coords[0], coords[2]), y = Math.min(coords[1], coords[3]);
      const w = Math.abs(coords[2] - coords[0]), h = Math.abs(coords[3] - coords[1]);
      let widthMm = w * unit * MM_PER_UNIT, heightMm = h * unit * MM_PER_UNIT;
      if (rotation % 180 !== 0) [widthMm, heightMm] = [heightMm, widthMm];
      if (![widthMm, heightMm].every(v => Number.isFinite(v) && v > 0)) throw new Error('zero or invalid physical page size');
      pages.push({ index, widthMm, heightMm, startMm: totalMm, box: [x, y, x + w, y + h], unit, rotation });
      totalMm += heightMm;
      // Render the entire physical sheet, including margins outside CropBox.
      // This changes only an in-memory rendering copy of the user's document.
      page.setMediaBox(x, y, w, h);
      page.setCropBox(x, y, w, h);
    } catch (error) { problems.push(`Page ${index + 1}: ${error instanceof Error ? error.message : 'unreadable dimensions'}.`); }
  });
  if (problems.length) throw new Error(`This PDF cannot be used. ${problems.slice(0, 5).join(' ')}${problems.length > 5 ? ` And ${problems.length - 5} more pages.` : ''} No replacement sizes were assigned.`);
  if (!Number.isFinite(totalMm)) throw new Error('The total physical length is invalid.');
  return { pages, totalMm, renderBytes: await doc.save({ useObjectStreams: false }) };
}

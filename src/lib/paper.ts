import { PDFDocument, PDFArray, PDFDict, PDFName, PDFNumber, StandardFonts, rgb } from 'pdf-lib';

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

export async function demoPaper(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.TimesRoman);
  const bold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const sans = await doc.embedFont(StandardFonts.Helvetica);
  const sections = [
    ['01', 'The art of moving forward', 'A tiny field guide to finding your stride'],
    ['02', 'One step, then another', 'Small movements. Surprisingly good momentum.'],
    ['03', 'The finish is a beginning', 'Every paper deserves a victory lap.'],
  ];
  const paragraphs = [
    'Progress rarely arrives in one dramatic leap. More often, it is a',
    'collection of small movements: a sentence read, an idea explored,',
    'a foot placed just ahead of the other. This is a paper about those',
    'small beginnings, and the curious places they can take us.',
    '',
    'Consider the humble page. A sheet of A4 paper is 297 millimetres',
    'tall. Three sheets laid end to end form a course just under a metre.',
    'It is a modest distance, but every millimetre is real. There are no',
    'shortcuts here: only you, your fingertips, and the paper ahead.',
    '',
    'Find a comfortable rhythm. Slide one finger, lift, and let the other',
    'take its turn. Speed is interesting, but rhythm is what makes the',
    'journey enjoyable. Pause when you need to. Begin again when',
    'you are ready. The next page will still be waiting for you.',
  ];
  for (const [number, title, sub] of sections) {
    const page = doc.addPage([210 / MM_PER_UNIT, 297 / MM_PER_UNIT]);
    page.drawText('P A P E R R U N   /   F I E L D   N O T E S', { x: 52, y: 780, size: 9, font: sans, color: rgb(.42,.37,.55) });
    page.drawText(number, { x: 52, y: 685, size: 58, font: bold, color: rgb(.43,.29,.75) });
    page.drawText(title, { x: 52, y: 635, size: 27, font: bold });
    page.drawText(sub, { x: 52, y: 609, size: 12, font: regular });
    let y = 555;
    for (const line of [...paragraphs, '', ...paragraphs.slice(0, 4)]) {
      page.drawText(line, { x: 52, y, size: 13, font: regular, color: rgb(.2,.2,.23) }); y -= 19;
    }
    page.drawText(`PAPER RUN  /  ${number}                                              210 x 297 mm`, { x: 52, y: 45, size: 9, font: sans });
  }
  return doc.save();
}

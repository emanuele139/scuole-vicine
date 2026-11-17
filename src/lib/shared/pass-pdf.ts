import { PDFDocument, PDFName, PDFString, rgb, type PDFFont } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { spaceQRGeometry, roundedRectPath, QR_INK, QR_PDF_BACKGROUND } from './qr';
import { parseSpaceURL } from './protocol';

type PassAssets = { display: Uint8Array; body: Uint8Array };
const colors = { paper: '#F7F5ED', ink: '#29271F', iris: '#B8AAF5', lawn: '#D4E88B', orange: '#F56A47', sun: '#F7CB54' };
const color = (hex: string) => rgb(...[1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number]);

/** The secret stays in memory: no PDF endpoint, external QR service or analytics. */
export async function createSpacePassPDF(url: string, assets: PassAssets): Promise<Uint8Array> {
  const origin = new URL(url).origin;
  if (!await parseSpaceURL(url, origin)) throw new Error('Il link dello spazio non è valido.');
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle('Il tuo spazio · Scuole Vicine');
  pdf.setAuthor('Scuole Vicine'); pdf.setSubject('Il pass personale per ritrovare le tue scuole');
  pdf.setLanguage('it-IT');
  const display = await pdf.embedFont(assets.display, { subset: true });
  const body = await pdf.embedFont(assets.body, { subset: true });
  const page = pdf.addPage([595.28, 841.89]);
  const rect = (x: number, y: number, width: number, height: number, fill: string) => page.drawRectangle({ x, y, width, height, color: color(fill) });
  const text = (value: string, x: number, y: number, size = 11, font = body, fill = colors.ink) => page.drawText(value, { x, y, size, font, color: color(fill) });
  const lines = (value: string, x: number, y: number, maxWidth: number, size = 11, font: PDFFont = body, leading = size * 1.5) => {
    let line = '', cursor = y;
    for (const word of value.split(' ')) {
      if (line && font.widthOfTextAtSize(`${line} ${word}`, size) > maxWidth) { text(line, x, cursor, size, font); cursor -= leading; line = word; }
      else line = line ? `${line} ${word}` : word;
    }
    if (line) text(line, x, cursor, size, font);
    return cursor;
  };
  const annotation = (target: string, bounds: number[]) => {
    const ref = pdf.context.register(pdf.context.obj({ Type: 'Annot', Subtype: 'Link', Rect: bounds, Border: [0, 0, 0], A: { Type: 'Action', S: 'URI', URI: PDFString.of(target) } }));
    page.node.addAnnot(ref);
  };
  rect(0, 0, 595.28, 841.89, colors.paper);
  // The site's typographic SV mark, orange dot and two-line wordmark.
  rect(51, 754, 26, 48, colors.ink); rect(40, 765, 48, 26, colors.ink);
  for (const x of [51, 77]) for (const y of [765, 791]) page.drawCircle({ x, y, size: 11, color: color(colors.ink) });
  text('s', 47, 771, 32, display, colors.paper); text('v', 62, 765, 32, display, colors.paper);
  page.drawCircle({ x: 78, y: 790, size: 4.5, color: color(colors.orange) });
  text('scuole', 99, 782, 22, display); text('vicine.', 99, 760, 22, display);
  text('IL TUO PASS PERSONALE', 372, 780, 9);
  text('Da conservare con cura.', 372, 763, 10);
  text('PICCOLI PASSI. GRANDI SCELTE.', 40, 716, 9);
  text('Le tue scelte.', 40, 661, 49, display);
  rect(38, 596, 341, 50, colors.sun);
  text('Sempre vicine.', 40, 608, 49, display);
  lines('Scuole Vicine è la guida gratuita e indipendente per scegliere nidi e scuole dell’infanzia a Milano. Cerca, confronta e prepara le visite, con informazioni, fonti e domande utili.', 40, 565, 475, 11.5);

  page.drawSvgPath(roundedRectPath(0, 0, 515, 212, 12), { x: 40, y: 497, color: color(colors.ink) });
  page.drawSvgPath(roundedRectPath(0, 0, 515, 212, 12), { x: 37, y: 500, color: color(QR_PDF_BACKGROUND) });
  text('IL TUO SPAZIO, SENZA ACCOUNT', 57, 473, 9);
  text('Un posto per', 57, 439, 25, display);
  text('le tue scuole.', 57, 412, 25, display);
  lines('Ritrova la selezione, gli appunti e le visite da organizzare.', 57, 385, 235, 11);
  text('01', 57, 333, 15, display); text('Inquadra il QR con la fotocamera.', 85, 335, 10);
  text('02', 57, 309, 15, display); text('Controlla l’anteprima e apri lo spazio.', 85, 311, 10);
  // Arch character from the illustration vocabulary, away from the QR data.
  page.drawCircle({ x: 306, y: 471, size: 16, color: color(colors.iris) });
  rect(290, 454, 32, 17, colors.iris);
  for (const x of [301, 312]) { page.drawEllipse({ x, y: 471, xScale: 3, yScale: 4, color: rgb(1, 1, 1) }); page.drawCircle({ x: x + 1, y: 470, size: 1.5, color: color(colors.ink) }); }

  const { extent, dataPath, outerPath, gapPath, centerPath } = spaceQRGeometry(url);
  const qrSize = 166, unit = qrSize / extent, qx = 364, qy = 321;
  // Same geometry as the website, directly on Prato: no white inset or frame.
  for (const [path, fill] of [[dataPath + outerPath, QR_INK], [gapPath, QR_PDF_BACKGROUND], [centerPath, QR_INK]]) {
    page.drawSvgPath(path, { x: qx, y: qy + qrSize, scale: unit, color: color(fill) });
  }
  // Asterisk and ribbon from /design, strictly outside the protected QR square.
  page.drawSvgPath('m119 20 14 63 55-33-33 55 65 15-65 15 33 55-55-33-14 63-14-63-55 33 33-55-63-15 63-15-33-55 55 33 14-63Z', { x: 532, y: 500, scale: .08, color: color(colors.sun) });
  page.drawCircle({ x: 541.52, y: 490.4, size: 1.92, color: color(QR_PDF_BACKGROUND) });
  page.drawSvgPath('M7 0C-5 1-1 15 9 15S22 27 12 30H2', { x: 339, y: 420, borderColor: color(colors.orange), borderWidth: 2 });
  annotation(url, [qx, qy, qx + qrSize, qy + qrSize]);
  text('Inquadra oppure tocca il QR.', qx + 9, 304, 9);

  text('PREFERISCI IL LINK?', 40, 252, 9);
  text('Apri il tuo spazio personale', 40, 228, 18, display);
  page.drawLine({ start: { x: 40, y: 224 }, end: { x: 260, y: 224 }, thickness: .8, color: color(colors.ink) });
  annotation(url, [40, 220, 300, 246]);
  // Print every character, wrapping without spaces: paper remains recoverable.
  let remaining = url, y = 204;
  while (remaining) {
    let length = remaining.length;
    while (length > 1 && body.widthOfTextAtSize(remaining.slice(0, length), 9) > 510) length--;
    text(remaining.slice(0, length), 40, y, 9); remaining = remaining.slice(length); y -= 14;
  }
  annotation(url, [40, y, 555, 215]);
  rect(40, 79, 515, 79, '#E9E4D6');
  text('Questo pass è una chiave. Custodiscilo.', 53, 137, 13, display);
  lines('Chi ha il PDF, il link o il QR può leggere, modificare ed eliminare lo spazio. Condividilo solo con persone fidate. Il PDF non contiene gli appunti e non è una copia di backup.', 53, 119, 485, 10, body, 14);
  text('Lo spazio scade dopo 365 giorni dalla creazione o dall’ultima modifica salvata.', 40, 64, 9);
  text('Aprirlo non rinnova la durata.', 40, 51, 9);
  const publicAddress = new URL(origin).host;
  text(publicAddress, 40, 23, 9, display);
  annotation(origin, [40, 19, 250, 35]);
  text('Cerca. Capisci. Scegli.', 449, 23, 9);
  // Do not put personal URLs in metadata, attachments, filenames or bookmarks.
  pdf.catalog.set(PDFName.of('PageMode'), PDFName.of('UseNone'));
  return pdf.save();
}

export async function downloadSpacePass(url: string, isCurrent: () => boolean = () => true): Promise<void> {
  const load = async (path: string) => {
    const response = await fetch(path, { credentials: 'same-origin', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(12_000) });
    if (!response.ok) throw new Error('Impossibile caricare i caratteri del pass.');
    return new Uint8Array(await response.arrayBuffer());
  };
  const [display, body] = await Promise.all([load('/fonts/font-2.ttf'), load('/fonts/font-4.ttf')]);
  const data = await createSpacePassPDF(url, { display, body });
  if (!isCurrent()) throw new Error('Lo spazio aperto è cambiato. Scarica di nuovo il pass.');
  const blob = new Blob([new Uint8Array(data)], { type: 'application/pdf' });
  const objectURL = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = objectURL; a.download = 'scuole-vicine-il-tuo-spazio.pdf'; a.rel = 'noreferrer';
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(objectURL), 60_000);
}

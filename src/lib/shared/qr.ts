import QRCode from 'qrcode';

export const QR_INK = '#29271F';
export const QR_PASS_BACKGROUND = '#D8CFF8';
export const QR_PDF_BACKGROUND = '#D4E88B';

/** Shared SVG/PDF geometry. Coordinates follow SVG's downward Y axis. */
export function roundedRectPath(x: number, y: number, width: number, height: number, radius: number): string {
  const r = Math.min(radius, width / 2, height / 2);
  return `M${x + r} ${y}H${x + width - r}Q${x + width} ${y} ${x + width} ${y + r}V${y + height - r}Q${x + width} ${y + height} ${x + width - r} ${y + height}H${x + r}Q${x} ${y + height} ${x} ${y + height - r}V${y + r}Q${x} ${y} ${x + r} ${y}Z`;
}

/** Four clear modules on every side, unmodified data, restrained corner radii.
 * Decorative artwork belongs outside this complete protected square. */
export function spaceQRGeometry(value: string) {
  const { modules } = QRCode.create(value, { errorCorrectionLevel: 'M' });
  const size = modules.size, margin = 4, extent = size + margin * 2;
  const finders = [[0, 0], [size - 7, 0], [0, size - 7]];
  const dark = (x: number, y: number) => x >= 0 && y >= 0 && x < size && y < size && !!modules.get(y, x);
  let dataPath = '';
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (!modules.get(y, x) || finders.some(([fx, fy]) => x >= fx && x < fx + 7 && y >= fy && y < fy + 7)) continue;
    // Round exposed corners; preserve solid joins between neighbouring cells.
    const a = x + margin, b = y + margin;
    const left = dark(x - 1, y), right = dark(x + 1, y), up = dark(x, y - 1), down = dark(x, y + 1);
    const tl = !left && !up ? .22 : 0, tr = !right && !up ? .22 : 0;
    const br = !right && !down ? .22 : 0, bl = !left && !down ? .22 : 0;
    dataPath += `M${a + tl} ${b}H${a + 1 - tr}Q${a + 1} ${b} ${a + 1} ${b + tr}V${b + 1 - br}Q${a + 1} ${b + 1} ${a + 1 - br} ${b + 1}H${a + bl}Q${a} ${b + 1} ${a} ${b + 1 - bl}V${b + tl}Q${a} ${b} ${a + tl} ${b}Z`;
  }
  const finderPath = (inset: number, width: number, radius: number) => finders.map(([x, y]) => roundedRectPath(x + margin + inset, y + margin + inset, width, width, radius)).join('');
  return { extent, margin, dataPath, outerPath: finderPath(0, 7, 1.35), gapPath: finderPath(1, 5, .8), centerPath: finderPath(2, 3, .65) };
}

/** Local vector rendering, with the exact background of its containing box. */
export function spaceQrSVG(value: string, background = QR_PASS_BACKGROUND): string {
  if (!/^#[0-9a-f]{6}$/i.test(background)) throw new Error('Colore del QR non valido.');
  const { extent, dataPath, outerPath, gapPath, centerPath } = spaceQRGeometry(value);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${extent} ${extent}" role="img" aria-label="QR per riaprire il tuo spazio personale" focusable="false"><rect width="${extent}" height="${extent}" fill="${background}"/><path d="${dataPath}${outerPath}" fill="${QR_INK}"/><path d="${gapPath}" fill="${background}"/><path d="${centerPath}" fill="${QR_INK}"/></svg>`;
}

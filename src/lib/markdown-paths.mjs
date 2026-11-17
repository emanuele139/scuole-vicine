/** Only public editorial pages get alternate Markdown; school profiles stay HTML. */
export function markdownPath(path) {
  if (path === '/') return '/index.md';
  if (/^\/(?:guide(?:\/[a-z0-9-]+)?|metodo|progetto|privacy|iscrizioni|agenda|nidi|scuole-infanzia|municipi\/[1-9])\/$/.test(path)) return path.slice(0, -1) + '.md';
  return null;
}
export function htmlPath(path) {
  if (path === '/index.md') return '/';
  if (!path.endsWith('.md')) return null;
  const candidate = path.slice(0, -3) + '/';
  return markdownPath(candidate) === path ? candidate : null;
}

import { parse } from 'ultrahtml';
import { querySelectorAll } from 'ultrahtml/selector';

/** Find executable inline scripts that the production script-src policy would block. */
export function blockedInlineScripts(html) {
  return querySelectorAll(parse(html), 'script').filter(script => {
    if (script.attributes.src) return false;
    const type = (script.attributes.type || '').trim().toLowerCase();
    if (['application/json', 'application/ld+json'].includes(type)) return false;
    return script.children.some(child => (child.value || '').trim());
  });
}

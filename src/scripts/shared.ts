import './report';
import { ready, sharedInfo } from '../lib/shared/controller';
import { loadFamily, toggleSaved, toggleCompare, removeSavedSchool, restoreSavedSchool, isFamilyStorageAvailable } from '../lib/family';

let toastTimeout: ReturnType<typeof setTimeout>;
type ToastAction = { label: string; run: () => void };
export function notify(message: string, action?: ToastAction) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  clearTimeout(toastTimeout);
  toast.replaceChildren();
  const text = document.createElement('span'); text.textContent = message; toast.append(text);
  toast.classList.toggle('has-action', !!action);
  toast.hidden = false;
  if (action) {
    const undo = document.createElement('button'); undo.type = 'button'; undo.className = 'toast-action'; undo.textContent = action.label;
    undo.addEventListener('click', () => { toast.hidden = true; action.run(); });
    const close = document.createElement('button'); close.type = 'button'; close.className = 'toast-close'; close.textContent = '×'; close.setAttribute('aria-label', 'Chiudi messaggio');
    close.addEventListener('click', () => { toast.hidden = true; toast.replaceChildren(); });
    toast.append(undo, close);
  } else toastTimeout = setTimeout(() => { toast.hidden = true; }, 4200);
}
export function removeFromSelection(id: string, keyboard = false, fromFamily = false) {
  const context = sharedInfo().client?.credentials.id || 'local';
  const removed = removeSavedSchool(id);
  if (!removed) return;
  const warning = isFamilyStorageAvailable() ? '' : ' La modifica resta solo in questa pagina.';
  notify('Scuola rimossa dalla selezione. Gli appunti sono conservati.' + warning, {
    label: 'Annulla',
    run: () => {
      if ((sharedInfo().client?.credentials.id || 'local') !== context) {
        notify('La selezione attiva è cambiata. Torna allo spazio precedente per ripristinare la scuola.'); return;
      }
      restoreSavedSchool(removed);
      notify('Scuola ripristinata nella selezione.');
      if (keyboard) requestAnimationFrame(() => {
        const selector = fromFamily ? `[data-family-remove="${CSS.escape(removed.id)}"]` : `[data-save-school="${CSS.escape(removed.id)}"]`;
        const button = [...document.querySelectorAll<HTMLElement>(selector)].find(el => el.getClientRects().length);
        button?.focus({ preventScroll: true });
      });
    },
  });
  if (keyboard) requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('#toast .toast-action')?.focus({ preventScroll: true }));
}
function updateControls() {
  const state = loadFamily();
  document.querySelectorAll<HTMLElement>('[data-saved-count]').forEach(el => el.textContent = String(state.saved.length));
  document.querySelectorAll<HTMLElement>('[data-compare-count]').forEach(el => { el.textContent = String(state.compare.length); el.hidden = !state.compare.length; });
  document.querySelectorAll<HTMLButtonElement>('[data-save-school]').forEach(button => {
    const saved = state.saved.includes(button.dataset.saveSchool!);
    button.setAttribute('aria-pressed', String(saved));
    button.classList.toggle('is-saved', saved);
    const label = button.querySelector('[data-save-label]');
    if (label) label.textContent = saved ? 'Salvata' : 'Salva';
  });
  document.querySelectorAll<HTMLButtonElement>('[data-compare-school]').forEach(button => {
    const selected = state.compare.includes(button.dataset.compareSchool!);
    button.setAttribute('aria-pressed', String(selected));
    button.classList.toggle('is-selected', selected);
    const label = button.querySelector('[data-compare-label]');
    if (label) label.textContent = selected ? 'Nel confronto' : 'Confronta';
  });
}
document.addEventListener('click', event => {
  const target = event.target as Element;
  const save = target.closest<HTMLButtonElement>('[data-save-school]');
  if (save) {
    if (loadFamily().saved.includes(save.dataset.saveSchool!)) removeFromSelection(save.dataset.saveSchool!, event.detail === 0);
    else { toggleSaved(save.dataset.saveSchool!); notify('Scuola salvata in “Le tue scuole”.'); }
    updateControls(); return;
  }
  const compare = target.closest<HTMLButtonElement>('[data-compare-school]');
  if (compare) { toggleCompare(compare.dataset.compareSchool!); updateControls(); }
});
window.addEventListener('family:change', (event: Event) => {
  updateControls();
  const detail = (event as CustomEvent).detail;
  if (detail?.persisted === false) notify('Il browser non consente di salvare le modifiche. Esporta una copia dalla pagina Le tue scuole prima di chiudere.');
});
window.addEventListener('family:notice', (event: Event) => {
  const detail = (event as CustomEvent).detail;
  notify(typeof detail === 'string' ? detail : detail?.message || 'Puoi confrontare al massimo tre scuole.');
});
window.addEventListener('storage', updateControls);
window.addEventListener('catalog:render', updateControls);
updateControls();

void ready.then(updateControls);

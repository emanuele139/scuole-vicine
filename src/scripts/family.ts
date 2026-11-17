import { getSchool, schoolHref } from '../lib/catalog-client';
import { removeFromSelection } from './shared';
import {
  FAMILY_STATUSES, isSharedFamily, loadFamily, saveFamily, toggleCompare, updateSchool,
  exportFamily, parseFamilyImport, mergeFamilyImport, selectionLink, isFamilyStorageAvailable,
  type FamilyState, type FamilyEntry, type FamilyImportPreview, type FamilyStatus,
} from '../lib/family';

const page = document.querySelector<HTMLElement>('[data-family-page]');
if (page) {
  const $ = <T extends HTMLElement>(selector: string) => page.querySelector<T>(selector)!;
  const list = $<HTMLDivElement>('[data-family-list]');
  const dialog = $<HTMLDialogElement>('[data-family-import-dialog]');
  const feedback = $<HTMLParagraphElement>('[data-family-feedback]');
  const fileInput = $<HTMLInputElement>('[data-family-file]');
  let filter = 'tutte';
  let preview: FamilyImportPreview | null = null;
  let incoming: string[] = [];
  const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

  function message(text: string, error = false) {
    feedback.textContent = text;
    feedback.style.color = error ? '#a14432' : '';
  }

  function render() {
    const state = loadFamily();
    const ids = state.saved.filter(id => getSchool(id));
    page!.classList.toggle('is-empty',ids.length===0);
    $('[data-family-empty]').hidden = ids.length > 0;
    $('[data-family-workspace]').hidden = ids.length === 0;
    $('[data-family-count]').textContent = String(ids.length);
    $('[data-family-compare-count]').textContent = `${state.compare.length} di 3 selezionate`;
    $('[data-family-storage-warning]').hidden = isFamilyStorageAvailable();
    // Saving an appunto must not replace the focused field or move its caret.
    if (document.activeElement instanceof HTMLTextAreaElement && list.contains(document.activeElement)) return;
    const opened = new Set([...list.querySelectorAll<HTMLDetailsElement>('details[open]')].map(el => el.dataset.familyNoteSchool));
    const shown = ids.filter(id => {
      const status = state.entries[id]?.status || 'da-valutare';
      return filter === 'tutte' || (filter === 'visitate' ? status === 'visitata' : status !== 'visitata' && status !== 'esclusa');
    });
    list.innerHTML = shown.length ? shown.map(id => card(id, state, opened.has(id))).join('') : '<p class="family-filter-empty">Non ci sono scuole in questo gruppo della selezione.</p>';
  }

  function card(id: string, state: FamilyState, open: boolean) {
    const school = getSchool(id)!;
    const managementLabel = school.educationStage === 'nursery' && school.management === 'Comunale' && school.accessMode.toLowerCase().includes('appalto') ? 'Comunale · in appalto' : school.management;
    const entry = state.entries[id];
    const hasNotes = !!(entry?.note || entry?.questions || entry?.parentA || entry?.parentB);
    const field = (key: keyof Omit<FamilyEntry, 'status'>, label: string, placeholder: string, max: number, rows = 3) => `<label>${label}<textarea data-family-field="${key}" data-family-school="${esc(id)}" rows="${rows}" maxlength="${max}" placeholder="${placeholder}">${esc(entry?.[key] || '')}</textarea></label>`;
    return `<article class="family-school-card">
      <div class="family-card-main"><div class="family-card-top"><div><p class="family-card-meta">${esc(school.serviceType)} · ${esc(school.ageRange)} · ${esc(managementLabel)} · ${esc(school.zone)}</p><h3><a href="${esc(schoolHref(school))}">${esc(school.name)}</a></h3><p class="family-card-address">${esc(school.address)}</p></div><button type="button" class="family-remove" data-family-remove="${esc(id)}" aria-label="Togli ${esc(school.name)} dalla selezione" title="Togli dalla selezione">×</button></div>
      <div class="family-card-controls"><label class="family-status-label">Stato <select data-family-status="${esc(id)}" aria-label="Stato ${esc(school.name)}">${Object.entries(FAMILY_STATUSES).map(([key, label]) => `<option value="${key}" ${key === (entry?.status || 'da-valutare') ? 'selected' : ''}>${label}</option>`).join('')}</select></label><label class="family-compare-check"><input type="checkbox" data-family-compare="${esc(id)}" ${state.compare.includes(id) ? 'checked' : ''} /> Confronta</label></div></div>
      <details class="family-card-notes" data-family-note-school="${esc(id)}" ${open ? 'open' : ''}><summary>Appunti e priorità ${hasNotes ? '<span class="family-note-indicator">Appunti presenti</span>' : ''}</summary><div class="family-notes-fields">
        ${field('note', 'Dopo la visita', 'Che cosa hai osservato? Quale impressione ti ha lasciato la scuola?', 10000)}
        ${field('questions', 'Domande ancora aperte', 'Quali domande vuoi fare su riposo, orari, ambientamento e costi?', 10000)}
        <div class="family-parents">${field('parentA', 'Il punto di vista di A <span class="family-field-hint">Facoltativo</span>', 'Cosa mi convince, cosa vorrei capire.', 1000)}${field('parentB', 'Il punto di vista di B <span class="family-field-hint">Facoltativo</span>', 'Cosa mi convince, cosa vorrei capire.', 1000)}</div>
      </div></details></article>`;
  }

  function importSelection() {
    const raw = new URL(window.location.href).searchParams.get('scuole');
    if (!raw) return;
    incoming = [...new Set(raw.slice(0, 20000).split(',').flatMap(id => getSchool(id) ? [getSchool(id)!.id] : []))].slice(0, 500);
    if (!incoming.length) { message('Il link non contiene scuole presenti nel catalogo.', true); return; }
    $('[data-family-received]').hidden = false;
    $('[data-family-received-names]').textContent = incoming.slice(0, 6).map(id => getSchool(id)!.name).join(' · ') + (incoming.length > 6 ? ` · e altre ${incoming.length - 6}` : '');
  }

  page.addEventListener('click', async event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const button = target.closest<HTMLElement>('button');
    if (!button) return;
    if (button.hasAttribute('data-family-filter')) {
      filter = button.dataset.familyFilter!;
      page.querySelectorAll<HTMLButtonElement>('[data-family-filter]').forEach(el => {
        const active = el === button;
        el.classList.toggle('active', active);
        el.setAttribute('aria-pressed', String(active));
      });
      render();
    } else if (button.dataset.familyRemove) {
      const id = button.dataset.familyRemove;
      const hasNotes = !!loadFamily().entries[id];
      removeFromSelection(id, event.detail === 0, true);
      message(hasNotes ? 'Scuola tolta dalla selezione. Gli appunti sono conservati: li ritrovi salvando di nuovo la scuola.' : 'Scuola tolta dalla selezione.');
    } else if (button.hasAttribute('data-family-export')) {
      const blob = new Blob([exportFamily()], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `scuole-vicine-famiglia-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      message('Copia esportata. Il file contiene i tuoi appunti in un formato leggibile: conservalo con cura e condividilo solo con chi scegli.');
    } else if (button.hasAttribute('data-family-import')) {
      fileInput.value = '';
      fileInput.click();
    } else if (button.hasAttribute('data-family-cancel-import')) {
      dialog.close();
      preview = null;
    } else if (button.hasAttribute('data-family-confirm-import') && preview) {
      try {
        mergeFamilyImport(preview);
        dialog.close();
        preview = null;
        message(isSharedFamily() ? 'Copia aggiunta allo spazio condiviso. Sincronizzazione in corso.' : 'Copia aggiunta su questo dispositivo.');
      } catch (error) {
        dialog.close();
        message(error instanceof Error ? error.message : 'Non siamo riusciti a importare questa copia. Controlla il file scelto e riprova.', true);
      }
    } else if (button.hasAttribute('data-family-accept-selection')) {
      const state = loadFamily();
      state.saved = [...new Set([...state.saved, ...incoming])];
      saveFamily(state);
      $('[data-family-received]').hidden = true;
      history.replaceState(null, '', window.location.pathname);
      message(`${incoming.length} ${incoming.length === 1 ? 'scuola aggiunta' : 'scuole aggiunte'} alla selezione su questo dispositivo.`);
    } else if (button.hasAttribute('data-family-share')) {
      const url = selectionLink();
      try {
        await navigator.clipboard.writeText(url);
        message('Link copiato: contiene soltanto le scuole della selezione. Gli appunti restano privati; le modifiche successive non si sincronizzano.');
      } catch {
        message('Copia questo link. Contiene solo le scuole della selezione, senza appunti o sincronizzazione.');
        const input = document.createElement('input');
        input.type = 'url';
        input.readOnly = true;
        input.value = url;
        input.setAttribute('aria-label', 'Link della selezione da copiare');
        input.style.cssText = 'display:block;width:100%;padding:10px;margin-top:10px;font-size:12px;border:1px solid var(--line);background:var(--surface);color:var(--ink)';
        feedback.append(input);
        input.focus();
        input.select();
      }
    }
  });

  page.addEventListener('input', event => {
    const field = event.target;
    if (!(field instanceof HTMLTextAreaElement) || !field.dataset.familyField || !field.dataset.familySchool) return;
    updateSchool(field.dataset.familySchool, { [field.dataset.familyField]: field.value });
  });

  page.addEventListener('change', event => {
    const field = event.target;
    if (field instanceof HTMLSelectElement && field.dataset.familyStatus) {
      updateSchool(field.dataset.familyStatus, { status: field.value as FamilyStatus });
    } else if (field instanceof HTMLInputElement && field.dataset.familyCompare) {
      toggleCompare(field.dataset.familyCompare);
      // Restore the checkbox if the three-school limit rejected this choice.
      field.checked = loadFamily().compare.includes(field.dataset.familyCompare);
    }
  });

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    preview = null;
    try {
      if (file.size > 1_000_000) throw new Error('Il file è troppo grande. Il limite è 1 MB.');
      preview = parseFamilyImport(await file.text());
      $('[data-family-import-summary]').textContent = `${preview.schoolCount} ${preview.schoolCount === 1 ? 'scuola' : 'scuole'}, ${preview.noteCount} ${preview.noteCount === 1 ? 'scheda con appunti' : 'schede con appunti'}${preview.exportedAt ? `. Copia del ${new Date(preview.exportedAt).toLocaleDateString('it-IT')}` : ''}.${preview.ignoredCount ? ` ${preview.ignoredCount} riferimenti a scuole non presenti nel catalogo non verranno importati.` : ''}`;
      const ids = [...new Set([...preview.state.saved, ...preview.state.compare, ...Object.keys(preview.state.entries)])];
      $('[data-family-import-schools]').innerHTML = ids.map(id => `<li>${esc(getSchool(id)!.name)}</li>`).join('');
      dialog.showModal();
    } catch (error) {
      message(error instanceof Error ? error.message : 'Non è possibile leggere questo file.', true);
    }
  });

  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('cancel', () => { preview = null; });
  window.addEventListener('family:change', render);
  window.addEventListener('family:notice', event => {
    const detail = (event as CustomEvent<{ message: string }>).detail;
    if (detail?.message) message(detail.message, true);
  });
  list.addEventListener('focusout', () => setTimeout(render, 0));
  importSelection();
  render();
}

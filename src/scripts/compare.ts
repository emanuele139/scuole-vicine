import { catalogText } from '../lib/catalog-copy';
import { loadFamily, saveFamily } from '../lib/family';
import type { SchoolResearch } from '../lib/catalog';

interface ComparedSchool { educationStage: 'nursery' | 'preschool'; serviceType: string; ageRange: string; accessMode: string; operator: string | null; id: string; name: string; address: string; zone: string; municipality: number | null; management: string; recognition: string; hours: string | null; cost: string | null; services: string[]; openDay: string | null; description: string; catalogYear: string; detailYear?: string | null; enriched: boolean; verifiedAt?: string | null; research?: SchoolResearch; warnings: string[]; href: string }
const dataNode = document.getElementById('comparison-data');
if (dataNode) {
  const schools: ComparedSchool[] = JSON.parse(dataNode.textContent || '[]');
  const byId = new Map(schools.map(school => [school.id, school]));
  const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
  const managementLabel = (school: ComparedSchool) => school.educationStage === 'nursery' && school.management === 'Comunale' && school.accessMode.toLowerCase().includes('appalto') ? 'Comunale · in appalto' : school.management;
  const validIds = (ids: string[]) => [...new Set(ids)].filter(id => byId.has(id)).slice(0, 3);
  const query = new URLSearchParams(location.search).get('ids');
  let lastStoredCompare = loadFamily().compare.join(',');
  let ids = validIds(query === null ? loadFamily().compare : query.split(','));
  const selection = document.getElementById('compare-selection')!;
  const board = document.getElementById('compare-board')!;
  const count = document.getElementById('compare-count')!;
  const context = document.getElementById('compare-context')!;
  const input = document.getElementById('compare-search') as HTMLInputElement;
  const results = document.getElementById('compare-search-results')!;
  const message = document.getElementById('compare-message')!;
  const share = document.getElementById('share-comparison') as HTMLButtonElement;
  const print = document.getElementById('print-comparison') as HTMLButtonElement;
  const differences = document.getElementById('compare-differences') as HTMLInputElement;
  const criteriaCount = document.getElementById('compare-criteria-count')!;
  document.getElementById('compare-start')!.addEventListener('click',()=>{input.scrollIntoView({block:'center',behavior:'instant'});input.focus({preventScroll:true});});
  const normalized = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('it');
  const researchFields: Record<string, keyof SchoolResearch['fieldEvidence']> = {Orari:'hours',Costi:'cost','Servizi e spazi':'services','Open day e visite':'openDay'};
  const statusLabels = {verified:'Dati della sede','operator-rule':'Indicazioni comuni del gestore','prior-research':'Informazioni da una ricerca precedente','not-published':'Non pubblicato','not-found':'Non trovato nelle fonti consultate',blocked:'Fonte non consultabile','needs-confirmation':'Da confermare'};
  function evidenceNote(school: ComparedSchool, label: string, hasText: boolean) {
    const field = researchFields[label];
    const evidence = field && school.research?.fieldEvidence[field];
    if (evidence) return `${escape(statusLabels[evidence.status])}${evidence.year ? ` · ${escape(evidence.year)}` : ''}${evidence.sourceUrls[0] ? ` · <a href="${escape(school.href)}#fonti">Fonti della scheda</a>` : ''}`;
    if (school.research) return `Ricerca del ${escape(school.research.checkedAt.split('-').reverse().join('/'))}. Puoi consultare gli anni di riferimento e le fonti nella scheda.`;
    return hasText ? `Dati identificativi ${escape(school.catalogYear)}${school.detailYear ? ` · approfondimenti ${escape(school.detailYear)}` : ''}` : 'Non abbiamo questo dato. La scuola può confermare se il servizio è disponibile.';
  }

  function syncUrl() { const url = new URL(location.href); if (ids.length) url.searchParams.set('ids', ids.join(',')); else url.searchParams.delete('ids'); history.replaceState(null, '', url); }
  function persist() { const state = loadFamily(); state.compare = ids; saveFamily(state); }
  function render() {
    const selected = ids.map(id => byId.get(id)!);
    const empty=selected.length===0;
    document.querySelector('.comparison-page')!.classList.toggle('is-empty',empty);
    document.getElementById('compare-empty')!.hidden=!empty;
    document.querySelectorAll<HTMLElement>('.compare-toolbar,.compare-filter-row,.compare-closing').forEach(el=>{el.hidden=empty;});
    selection.hidden=board.hidden=empty;
    selection.dataset.count = String(selected.length);
    document.querySelector('.comparison-page')?.setAttribute('style', `--compare-columns:${Math.max(1, ids.length)};--selection-columns:${Math.min(3, ids.length+1)}`);
    count.textContent = `${ids.length} di 3 scuole`;
    context.textContent = new Set(selected.map(s => s.educationStage)).size > 1 ? 'Stai confrontando servizi per fasce d’età diverse. Prima di valutare rette e orari, controlla il tipo di servizio e l’età richiesta per accedere.' : ids.length === 3 ? 'Hai selezionato tre scuole. Per aggiungerne un’altra, rimuovine una dal confronto.' : 'Aggiungi le scuole che vuoi conoscere meglio.';
    share.disabled = print.disabled = !ids.length;
    differences.disabled = ids.length < 2;
    if (ids.length < 2) differences.checked = false;
    selection.innerHTML = selected.map(school => `<article class="compare-selected-card"><span class="badge">${escape(managementLabel(school))}</span><button class="compare-remove" data-remove-compare="${escape(school.id)}" aria-label="Rimuovi ${escape(school.name)} dal confronto">×</button><h2><a href="${escape(school.href)}">${escape(school.name)}</a></h2><p>${escape(school.serviceType)} · ${escape(school.ageRange)}</p><p>${escape(school.address)}</p><p>${escape(school.zone)}${school.municipality && school.zone !== `Municipio ${school.municipality}` ? ` · Municipio ${school.municipality}` : ''}</p></article>`).join('') + (ids.length && ids.length < 3 ? '<div class="compare-slot">C’è posto per un’altra scuola</div>' : '');
    if (empty) { criteriaCount.textContent = ''; board.innerHTML = ''; return; }
    const criteria: [string, (school: ComparedSchool) => string | null | undefined][] = [
      ['Servizio ed età', school => [school.serviceType, school.ageRange].join(' · ')],
      ['Accesso', school => school.accessMode],
      ['Gestore', school => school.operator || school.management],
      ['Gestione e riconoscimento', school => [managementLabel(school), school.recognition].filter(Boolean).join(' · ')],
      ['Orari', school => school.hours], ['Servizi e spazi', school => school.services?.join(' · ')], ['Costi', school => school.cost], ['Open day e visite', school => school.openDay],
      ['Progetto e vita della scuola', school => school.description], ['Attenzioni sulla sede', school => school.warnings.length ? school.warnings.join(' ') : null],
    ];
    const visibleCriteria = differences.checked ? criteria.filter(([, value]) => new Set(selected.map(school => normalized(value(school) || '').trim())).size > 1) : criteria;
    criteriaCount.textContent = `${visibleCriteria.length} di ${criteria.length} criteri`;
    board.innerHTML = visibleCriteria.map(([label, value]) => `<section class="criterion-section"><h2 class="criterion-title">${escape(label)}</h2><div class="criterion-grid">${selected.map(school => { const text = value(school); const displayText = label === 'Servizi e spazi' ? school.services.map(service => catalogText(service)).join(' · ') : label === 'Attenzioni sulla sede' ? school.warnings.map(warning => catalogText(warning)).join(' ') : label === 'Gestione e riconoscimento' ? [managementLabel(school), catalogText(school.recognition)].filter(Boolean).join(' · ') : ['Accesso', 'Orari', 'Costi', 'Open day e visite', 'Progetto e vita della scuola'].includes(label) ? catalogText(text) : text; const unknown = label === 'Attenzioni sulla sede' ? 'Non abbiamo registrato segnalazioni sulla sede. Prima della visita, chiedi comunque alla scuola quale ingresso usare.' : 'Non abbiamo ancora questa informazione. Puoi chiederla alla scuola.'; return `<div class="criterion-value"><span class="criterion-school-name">${escape(school.name)}</span><p${text ? '' : ' class="unknown"'}>${escape(displayText || unknown)}</p><small>${evidenceNote(school,label,Boolean(text))}</small></div>`; }).join('')}</div></section>`).join('') || '<div class="compare-empty"><h2>I dati disponibili coincidono.</h2><p>Disattiva il filtro per leggere tutti i criteri, gli anni e le fonti. I dati mancanti restano informazioni da verificare con le scuole.</p></div>';
  }
  function renderSearch() {
    const term = normalized(input.value.trim());
    if (term.length < 2) { results.innerHTML = ''; return; }
    const found = schools.filter(school => !ids.includes(school.id) && normalized(`${school.name} ${school.address} ${school.zone}`).includes(term)).slice(0, 7);
    results.innerHTML = found.length ? found.map(school => `<button class="compare-result" data-add-compare="${escape(school.id)}"><span>${escape(school.name)}<small>${escape(school.serviceType)} · ${escape(school.ageRange)} · ${escape(school.address)} · ${escape(managementLabel(school))}</small></span><span aria-hidden="true">+</span></button>`).join('') : '<p>Non abbiamo trovato scuole con questo nome o indirizzo. Prova con un altro nome o un’altra via.</p>';
  }
  input.addEventListener('input', renderSearch);
  differences.addEventListener('change', render);
  document.addEventListener('click', event => {
    const target = event.target as HTMLElement;
    const add = target.closest<HTMLElement>('[data-add-compare]');
    const remove = target.closest<HTMLElement>('[data-remove-compare]');
    if (add) {
      if (ids.length >= 3) { message.textContent = 'Puoi confrontare fino a tre scuole. Per aggiungerne un’altra, rimuovine una.'; return; }
      ids = validIds([...ids, add.dataset.addCompare!]); input.value = ''; results.innerHTML = ''; message.textContent = ''; persist(); syncUrl(); render(); input.focus();
    }
    if (remove) { ids = ids.filter(id => id !== remove.dataset.removeCompare); persist(); syncUrl(); render(); renderSearch(); input.focus(); }
  });
  window.addEventListener('family:change', () => { const next = loadFamily().compare; if (next.join(',') === lastStoredCompare) return; lastStoredCompare = next.join(','); ids = validIds(next); syncUrl(); render(); renderSearch(); });
  share.addEventListener('click', async () => { syncUrl(); try { await navigator.clipboard.writeText(location.href); message.textContent = 'Link copiato. Condivide solo le scuole del confronto, senza appunti o dati personali.'; } catch { message.textContent = 'Puoi copiare il link dalla barra degli indirizzi. Contiene solo le scuole del confronto, senza appunti.'; } });
  print.addEventListener('click', () => window.print());
  if (query !== null && query.split(',').filter(Boolean).length > ids.length) message.textContent = 'Il confronto mostra fino a tre scuole presenti nel catalogo attuale.';
  render();
}

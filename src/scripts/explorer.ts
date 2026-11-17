import { installBasemap } from './basemap';
import { readSearchSession, writeSearchSession, tabSearchStorage, type SearchSession } from '../lib/search-session';
import { schools, schoolHref } from '../lib/catalog-client';
import { loadFamily } from '../lib/family';
import { distanceKm, radiusKm, formatDistance, findAddress, cachedAddressSuggestions } from '../lib/proximity';
import type { AddressMatch } from '../lib/proximity';
import { parseCivicAddress, matchesCivicAddress } from '../lib/civic-address';
import type { ClientSchool as School } from '../lib/catalog-client';

const $ = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const query = $<HTMLInputElement>('#query');
const municipality = $<HTMLSelectElement>('#municipality');
const management = $<HTMLSelectElement>('#management');
const nurseryService = $<HTMLSelectElement>('#nursery-service');
const sort = $<HTMLSelectElement>('#sort');
const radius = $<HTMLSelectElement>('#radius');
const status = $('#address-status');
const choices = $('#address-choices');
const submit = $<HTMLButtonElement>('#search-submit');
let searchMode: 'address' | 'name' = 'address';
let educationStage: '' | 'nursery' | 'preschool' = '';
let origin: AddressMatch | null = null;
let request: AbortController | null = null;
let searchGeneration = 0;
let selectedAddress: AddressMatch | null = null;
let suggestions: AddressMatch[] = [];
let activeSuggestion = -1;
let suggestionTimer: ReturnType<typeof setTimeout>;
const distances = new Map<string, number>();
let originLayer: any = null;
const normal = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('it');
const lookup = new Map(schools.map(s => [s.id, normal([s.name,...s.aliases,s.code || ''].join(' '))]));
let onlySaved = false;
let shown = 12;
let filtered: School[] = [];
let map: any = null;
let leaflet: any = null;
let markersLayer: any = null;
let mapStartup: Promise<void> | null = null;
let selectedSchoolId: string | null = null;
const params = new URLSearchParams(location.search);
const previous = readSearchSession(tabSearchStorage());
const backNavigation = performance.getEntriesByType('navigation').some(entry=>(entry as PerformanceNavigationTiming).type==='back_forward');
const resume = previous && (location.hash==='#riprendi'||(backNavigation&&previous.url===location.pathname+location.search)) ? previous : null;
let pendingMapView = resume?.mapView || null;
let filterRevision = 0;
// Keep personal addresses out of URLs; only the requested, expiring suggestion cache stores them locally.
query.value = params.get('q') || '';
searchMode = query.value || params.get('tipo') === 'nome' ? 'name' : 'address';
radius.value = String(radiusKm(params.get('raggio') || '2'));
municipality.value = params.get('municipio') || '';
management.value = params.get('gestione') || '';
educationStage = params.get('fascia') === 'nursery' ? 'nursery' : params.get('fascia') === 'preschool' ? 'preschool' : '';
nurseryService.value = educationStage === 'nursery' && [...nurseryService.options].some(option => option.value === params.get('servizio')) ? params.get('servizio')! : '';
sort.value = params.get('ordine') === 'details' ? 'details' : 'name';
onlySaved = params.get('salvate') === '1';
if (resume) {
  query.value=resume.query; searchMode=resume.mode; educationStage=resume.stage;
  radius.value=resume.radius; municipality.value=resume.municipality; management.value=resume.management;
  nurseryService.value=resume.stage==='nursery'?resume.service:''; sort.value=resume.sort; onlySaved=resume.onlySaved;
  origin=resume.origin; selectedAddress=resume.origin; selectedSchoolId=resume.selectedId;
  if(origin){
    for(const school of schools)if(school.lat!==null&&school.lng!==null)distances.set(school.id,distanceKm(origin,{lat:school.lat,lng:school.lng}));
    sort.querySelector<HTMLOptionElement>('[value="distance"]')!.disabled=false;
    status.textContent=`Ricerca ripresa da ${origin.label}. Distanze in linea d’aria.`;
  }
  $('#explorer').classList.toggle('map-mode',resume.view==='map');
}
const wrappers = new Map([...document.querySelectorAll<HTMLElement>('.school-result')].map(el=>[el.dataset.schoolId!,el]));
function filterSchools(refit=true) {
  filterRevision++;
  if(refit)pendingMapView=null;
  const words = searchMode === 'name' ? normal(query.value.trim()).split(/\s+/).filter(Boolean) : [];
  const saved = loadFamily().saved;
  filtered = schools.filter(s => (!educationStage || s.educationStage === educationStage) && (educationStage !== 'nursery' || !nurseryService.value || s.serviceType === nurseryService.value) && (!municipality.value || (municipality.value === 'unknown' ? s.municipality === null : s.municipality === Number(municipality.value))) && (!management.value || s.management === management.value) && (!onlySaved || saved.includes(s.id)) && words.every(word => lookup.get(s.id)!.includes(word)) && (!origin || (distances.has(s.id) && distances.get(s.id)! <= radiusKm(radius.value))));
  filtered.sort((a,b) => (sort.value === 'distance' && origin ? distances.get(a.id)!-distances.get(b.id)! : sort.value === 'details' ? Number(b.enriched)-Number(a.enriched) : 0) || a.name.localeCompare(b.name,'it'));
  shown = 12;
  if(selectedSchoolId && !filtered.some(s=>s.id===selectedSchoolId))clearMapSelection();
  const summary = $('#proximity-summary');
  summary.hidden = !origin;
  summary.textContent = origin ? `Entro ${radius.value} km da ${origin.label}. Distanze in linea d’aria.${origin.houseNumber ? ' Le distanze partono dal numero civico selezionato.' : ' Le distanze partono dalla via, senza un numero civico preciso.'} ${schools.filter(s=>(!educationStage || s.educationStage===educationStage) && (s.lat===null || s.lng===null)).length} sedi${educationStage ? ' della fascia selezionata' : ''} non hanno coordinate e non sono incluse nella ricerca per vicinanza.` : '';
  renderList();
  $('#result-count').textContent = String(filtered.length);
  $('#result-noun').textContent = filtered.length === 1 ? 'sede' : 'sedi';
  $('[data-compact-count]').textContent=`${filtered.length} ${filtered.length===1?'sede':'sedi'}`;
  $('#filters-show-results').textContent=`Mostra ${filtered.length} ${filtered.length===1?'sede':'sedi'}`;
  $('#nursery-age-note').hidden = educationStage !== 'nursery';
  $('#nursery-service-field').hidden = educationStage !== 'nursery';
  nurseryService.disabled = educationStage !== 'nursery';
  document.querySelectorAll<HTMLElement>('[data-education-stage]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.educationStage === educationStage)));
  $('#saved-only').setAttribute('aria-pressed',String(onlySaved));
  $('#reset-filters').hidden = !educationStage && !query.value && !municipality.value && !management.value && !onlySaved && sort.value === 'name' && radius.value === '2';
  document.querySelectorAll<HTMLElement>('[data-municipality]').forEach(button => { const selected = button.dataset.municipality === municipality.value; button.classList.toggle('active',selected); button.setAttribute('aria-pressed',String(selected)); });
  document.querySelectorAll<HTMLElement>('[data-hero-management]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.heroManagement === management.value)));
  document.querySelectorAll<SVGElement>('[data-terrain-type]').forEach(cell => { cell.style.opacity = !management.value || cell.dataset.terrainType === management.value ? '1' : '.25'; });
  const url = new URL(location.href);
  for (const key of ['lat','lng','indirizzo']) url.searchParams.delete(key);
  for (const [key,value] of Object.entries({fascia:educationStage,servizio:educationStage==='nursery'?nurseryService.value:'',q:searchMode==='name'?query.value:'',tipo:searchMode==='name'?'nome':'',raggio:radius.value==='2'?'':radius.value,municipio:municipality.value,gestione:management.value,salvate:onlySaved?'1':'',ordine:sort.value==='details'?'details':''})) value ? url.searchParams.set(key,value) : url.searchParams.delete(key);
  history.replaceState(null,'',url);
  renderActiveFilters();
  renderMarkers();
  if (refit) fitMap();
  queueCompactBar();
}
function renderList() {
  for (const el of wrappers.values()) el.hidden = true;
  const grid = $('#school-grid');
  filtered.slice(0,shown).forEach(s => { const el = wrappers.get(s.id)!; el.hidden = false;
    const template=el.querySelector<HTMLTemplateElement>('template[data-card-template]');if(template)template.replaceWith(template.content);
    el.querySelector('.school-card')?.classList.toggle('is-map-selected',s.id===selectedSchoolId);
    el.querySelector('[data-locate-school]')?.setAttribute('aria-pressed',String(s.id===selectedSchoolId));
    const distance = el.querySelector<HTMLElement>('[data-school-distance]')!;
    distance.hidden = !origin;
    distance.textContent = origin ? `${formatDistance(distances.get(s.id)!)} in linea d’aria` : '';
    grid.append(el); });
  $('#no-results').hidden = filtered.length !== 0;
  $('#load-more').hidden = shown >= filtered.length;
  $('#shown-count').textContent = filtered.length ? `${Math.min(shown,filtered.length)} di ${filtered.length} sedi` : '';
  window.dispatchEvent(new Event('catalog:render'));
}
function cancelSearch() {
  clearTimeout(suggestionTimer);
  searchGeneration++;
  request?.abort(); request=null;
  submit.disabled=false;
  $('#school-search').setAttribute('aria-busy','false');
  closeSuggestions();
  if(status.textContent?.startsWith('Cerco'))status.textContent='';
}
function closeSuggestions() {
  suggestions=[];activeSuggestion=-1;choices.hidden=true;choices.replaceChildren();
  query.setAttribute('aria-expanded','false');query.removeAttribute('aria-activedescendant');
}
function chooseAddress(match: AddressMatch) {
  const civic=parseCivicAddress(query.value);
  if(civic && !matchesCivicAddress(match,civic))return;
  cancelSearch();selectedAddress=match;query.value=match.label;
  status.textContent=`Indirizzo selezionato${match.houseNumber ? ' completo' : ' senza numero civico'}: premi Cerca per trovare le scuole vicine.`;
  status.dataset.error='false';query.removeAttribute('aria-invalid');query.focus();
}
function showSuggestions(matches: AddressMatch[]) {
  closeSuggestions();suggestions=matches;
  matches.forEach((match,index)=>{
    const option=document.createElement('div');option.id=`address-option-${index}`;
    option.setAttribute('role','option');option.setAttribute('aria-selected','false');option.textContent=match.label;
    option.addEventListener('pointerdown',event=>event.preventDefault());
    option.addEventListener('click',()=>chooseAddress(match));choices.append(option);
  });
  choices.hidden=!matches.length;query.setAttribute('aria-expanded',String(matches.length>0));
}
async function autocomplete() {
  const generation=searchGeneration;
  request=new AbortController();const controller=request;
  const timeout=setTimeout(()=>controller.abort('timeout'),15000);
  if(!suggestions.length)status.textContent='Cerco suggerimenti…';status.dataset.error='false';
  try {
    const matches=await findAddress(query.value,controller.signal);
    if(generation!==searchGeneration)return;
    if(activeSuggestion < 0 && (matches.length || !suggestions.length))showSuggestions(matches);
    status.textContent=suggestions.length?`${suggestions.length} suggerimenti. Seleziona un indirizzo, poi premi Cerca.`:parseCivicAddress(query.value)?'Non abbiamo trovato questo numero civico. Controlla via e numero. Se preferisci cercare dalla via, puoi togliere il numero civico.':'Non abbiamo trovato suggerimenti a Milano. Controlla come è scritto il nome della via e riprova.';
  } catch {
    if(generation!==searchGeneration)return;
    status.textContent=suggestions.length?'Mostriamo gli indirizzi già cercati su questo dispositivo. Selezionane uno, poi premi Cerca.':'I suggerimenti non sono disponibili. Puoi riprovare premendo Cerca.';
  } finally { clearTimeout(timeout); }
}
query.addEventListener('keydown',event=>{
  if(searchMode!=='address')return;
  if(event.key==='Escape'){cancelSearch();return;}
  if(!suggestions.length)return;
  if(event.key==='ArrowDown'||event.key==='ArrowUp'){
    event.preventDefault();activeSuggestion=(activeSuggestion+(event.key==='ArrowDown'?1:activeSuggestion<0?0:-1)+suggestions.length)%suggestions.length;
    [...choices.children].forEach((option,index)=>option.setAttribute('aria-selected',String(index===activeSuggestion)));
    query.setAttribute('aria-activedescendant',`address-option-${activeSuggestion}`);
    choices.children[activeSuggestion].scrollIntoView({block:'nearest'});
  } else if(event.key==='Enter' && activeSuggestion>=0){event.preventDefault();chooseAddress(suggestions[activeSuggestion]);}
});
document.addEventListener('pointerdown',event=>{if(!query.closest('.search-field')!.contains(event.target as Node))cancelSearch();});
query.addEventListener('blur',()=>cancelSearch());
function clearOrigin() {
  origin=null; distances.clear();
  sort.querySelector<HTMLOptionElement>('[value="distance"]')!.disabled=true;
  if(sort.value==='distance')sort.value='name';
}
function updateMode() {
  document.querySelectorAll<HTMLElement>('[data-search-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.searchMode===searchMode)));
  const addressMode=searchMode==='address';
  query.placeholder=addressMode?'Via e numero civico, Milano':'Nome del nido o della scuola';
  query.setAttribute('aria-label',query.placeholder);
  query.closest('.search-field')!.querySelector('label[for="query"]')!.textContent=query.placeholder;
  query.setAttribute('role',addressMode?'combobox':'searchbox');
  query.setAttribute('aria-autocomplete',addressMode?'list':'none');
  $('.radius-field').hidden=!addressMode;
  $('#geocoder-credit').hidden=!addressMode;
}
function resetFilters() { cancelSearch();selectedAddress=null;clearOrigin();query.value='';educationStage='';nurseryService.value='';municipality.value='';management.value='';radius.value='2';sort.value='name';onlySaved=false;status.textContent='';query.removeAttribute('aria-invalid');filterSchools(); }
function useAddress(match: AddressMatch) {
  const civic=parseCivicAddress(query.value);
  if(civic && !matchesCivicAddress(match,civic)){status.textContent='Seleziona il numero civico esatto prima di cercare le scuole.';status.dataset.error='true';return;}
  origin=match;distances.clear();
  for(const school of schools)if(school.lat!==null&&school.lng!==null)distances.set(school.id,distanceKm(match,{lat:school.lat,lng:school.lng}));
  sort.querySelector<HTMLOptionElement>('[value="distance"]')!.disabled=false;
  sort.value='distance';
  closeSuggestions();
  status.textContent=`Indirizzo trovato: ${match.label}${match.houseNumber ? ' · Distanze dal civico selezionato.' : ' · Distanze dalla via senza numero civico.'}`;
  status.dataset.error='false';query.removeAttribute('aria-invalid');
  filterSchools();
  $('#catalogo').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
}
async function search() {
  cancelSearch();
  status.dataset.error='false';query.removeAttribute('aria-invalid');
  if(searchMode==='name' || !query.value.trim()) {
    if(!query.value.trim())clearOrigin();
    status.textContent='';filterSchools();
    $('#catalogo').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});return;
  }
  if(selectedAddress){useAddress(selectedAddress);return;}
  if(query.value.trim().length<3){status.textContent='Inserisci una via e, se disponibile, il numero civico.';query.setAttribute('aria-invalid','true');return;}
  const generation=searchGeneration;
  request=new AbortController();
  const controller=request;
  const timeout=setTimeout(()=>controller.abort('timeout'),15000);
  submit.disabled=true;$('#school-search').setAttribute('aria-busy','true');status.textContent='Cerco l’indirizzo…';
  try {
    const matches=await findAddress(query.value,controller.signal);
    if(generation!==searchGeneration)return;
    if(!matches.length){status.textContent=parseCivicAddress(query.value)?'Non abbiamo trovato questo numero civico e non possiamo calcolare le distanze da quel punto. Controlla via e numero e riprova.':'Non abbiamo trovato questo indirizzo nel Comune di Milano. Controlla come è scritto il nome della via e riprova.';status.dataset.error='true';query.setAttribute('aria-invalid','true');return;}
    if(matches.length===1){useAddress(matches[0]);return;}
    status.textContent='Scegli l’indirizzo da cui calcolare le distanze:';
    showSuggestions(matches);query.focus();
  } catch(error) {
    if(generation!==searchGeneration)return;
    status.textContent=controller.signal.aborted?'La ricerca dell’indirizzo sta richiedendo più tempo del previsto. Riprova tra poco.':error instanceof Error && error.message.startsWith('Il servizio')?error.message:'Non siamo riusciti a cercare l’indirizzo. Controlla la connessione e riprova.';
    status.dataset.error='true';
  } finally {
    clearTimeout(timeout);
    if(generation===searchGeneration){submit.disabled=false;$('#school-search').setAttribute('aria-busy','false');}
  }
}
let searchTimer: ReturnType<typeof setTimeout>;
query.addEventListener('input',()=>{
  const hadOrigin=Boolean(origin);
  cancelSearch();selectedAddress=null;clearTimeout(searchTimer);clearOrigin();query.removeAttribute('aria-invalid');status.dataset.error='false';
  status.textContent=searchMode==='address'&&query.value.trim().length<3?'Scrivi almeno 3 caratteri per i suggerimenti.':'';
  if(searchMode==='name')searchTimer=setTimeout(()=>filterSchools(),160);
  else if(hadOrigin)filterSchools();
  if(searchMode==='address'&&query.value.trim().length>=3){
    const cached=cachedAddressSuggestions(query.value);
    if(cached.matches.length){showSuggestions(cached.matches);status.textContent=`${cached.matches.length} suggerimenti. Seleziona un indirizzo, poi premi Cerca.`;}
    if(!cached.exact || !cached.fresh)suggestionTimer=setTimeout(()=>void autocomplete(),150);
    else if(!cached.matches.length)status.textContent=parseCivicAddress(query.value)?'Non abbiamo trovato questo numero civico. Controlla via e numero. Se preferisci cercare dalla via, puoi togliere il numero civico.':'Non abbiamo trovato suggerimenti a Milano. Controlla come è scritto il nome della via e riprova.';
  }
});
document.querySelectorAll<HTMLElement>('[data-search-mode]').forEach(button=>button.addEventListener('click',()=>{
  if(searchMode===button.dataset.searchMode)return;
  cancelSearch();selectedAddress=null;clearTimeout(searchTimer);clearOrigin();query.value='';status.textContent='';query.removeAttribute('aria-invalid');searchMode=button.dataset.searchMode as 'address'|'name';updateMode();filterSchools();query.focus();
}));
document.querySelectorAll<HTMLElement>('[data-education-stage]').forEach(button => button.addEventListener('click', () => {
  const nextStage = button.dataset.educationStage as typeof educationStage;
  if (nextStage !== educationStage) nurseryService.value = '';
  educationStage = nextStage;
  filterSchools();
}));
[municipality,management,nurseryService,sort,radius].forEach(el=>el.addEventListener('change',()=>filterSchools()));
$('#school-search').addEventListener('submit',event=>{event.preventDefault();clearTimeout(searchTimer);void search();});
document.querySelectorAll<HTMLElement>('[data-hero-management]').forEach(button => button.addEventListener('click', () => {
  management.value = management.value === button.dataset.heroManagement ? '' : button.dataset.heroManagement!;
  filterSchools();
}));
$('#reset-filters').addEventListener('click',resetFilters);
$('#empty-reset').addEventListener('click',resetFilters);
$('#saved-only').addEventListener('click',()=>{onlySaved=!onlySaved;filterSchools();});
document.querySelectorAll<HTMLElement>('[data-municipality]').forEach(button=>button.addEventListener('click',()=>{municipality.value=button.dataset.municipality!;filterSchools();}));
$('#load-more').addEventListener('click',()=>{shown+=12;renderList();});
function dock() { const count=loadFamily().compare.length;$('#compare-dock').hidden=!count;$('#dock-count').textContent=String(count); }
window.addEventListener('family:change',()=>{dock();if(onlySaved)filterSchools(false);});
window.addEventListener('storage',()=>{dock();if(onlySaved)filterSchools(false);});
function setViewControls(view:'list'|'map'){
  document.querySelectorAll<HTMLElement>('[data-results-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.resultsView===view)));
}
function scrollToResults(){
  const top=$('#explorer').getBoundingClientRect().top+window.scrollY-headerHeight()-76;
  window.scrollTo({top:Math.max(0,top),behavior:'instant'});queueCompactBar();
}
function showView(view:'list'|'map',compact=false){
  $('#explorer').classList.toggle('map-mode',view==='map');setViewControls(view);
  if(compact)requestAnimationFrame(scrollToResults);
  if(view==='map')void initMap().then(()=>{if(map){map.invalidateSize();fitMap();}});
}
document.querySelectorAll<HTMLButtonElement>('[data-results-view]').forEach(button=>button.addEventListener('click',()=>showView(button.dataset.resultsView as 'list'|'map',!!button.closest('#mobile-results-bar'))));
const filtersDialog=$<HTMLDialogElement>('#filters-dialog');
let filterOpener:HTMLElement|null=null, revisionAtOpen=0;
let movedFilters:{node:HTMLElement;anchor:Comment}[]=[];
function moveFilter(node:HTMLElement,host:HTMLElement){
  const anchor=document.createComment('filter-position');node.before(anchor);host.append(node);movedFilters.push({node,anchor});
}
function openFilters(opener:HTMLElement){
  if(filtersDialog.open)return;
  cancelSearch();filterOpener=opener;revisionAtOpen=filterRevision;
  moveFilter($('.stage-filter'),$('#filters-stage-host'));
  moveFilter($('#search-extra-filters'),$('#filters-fields-host'));
  moveFilter($('#nursery-service-field'),$('#filters-service-host'));
  moveFilter($('#sort').closest('label')!,$('#filters-fields-host'));
  moveFilter($('#saved-only'),$('#filters-saved-host'));
  $('#filters-query-context').textContent=origin?`Vicino a ${origin.label}`:searchMode==='name'&&query.value?`Nome: ${query.value}`:searchMode==='address'?'Tutta Milano. Il raggio si applica dopo la ricerca di un indirizzo.':'Tutta Milano · scegli i filtri che contano per te.';
  filtersDialog.returnValue='';filtersDialog.showModal();
  $('#filter-toggle').setAttribute('aria-expanded','true');$('#compact-filter-toggle').setAttribute('aria-expanded','true');
}
filtersDialog.addEventListener('close',()=>{
  movedFilters.forEach(({node,anchor})=>anchor.replaceWith(node));movedFilters=[];
  $('#filter-toggle').setAttribute('aria-expanded','false');$('#compact-filter-toggle').setAttribute('aria-expanded','false');
  requestAnimationFrame(()=>{
    if(filtersDialog.returnValue==='query'){window.scrollTo({top:Math.max(0,$('#ricerca').getBoundingClientRect().top+window.scrollY-headerHeight()-12),behavior:'instant'});query.focus({preventScroll:true});}
    else if(filtersDialog.returnValue==='results'||filterRevision!==revisionAtOpen){scrollToResults();$('#results-title').focus({preventScroll:true});}
    else filterOpener?.focus({preventScroll:true});
    queueCompactBar();
  });
});
$('#filter-toggle').addEventListener('click',()=>openFilters($('#filter-toggle')));
$('#compact-filter-toggle').addEventListener('click',()=>openFilters($('#compact-filter-toggle')));
$('#filters-close').addEventListener('click',()=>filtersDialog.close());
$('#filters-show-results').addEventListener('click',()=>filtersDialog.close('results'));
$('#filters-edit-query').addEventListener('click',()=>filtersDialog.close('query'));
$('#filters-reset').addEventListener('click',resetFilters);
filtersDialog.addEventListener('click',event=>{if(event.target===filtersDialog){const r=filtersDialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)filtersDialog.close();}});
const compactBar=$('#mobile-results-bar');
let compactQueued=false;
function headerHeight(){return document.querySelector('.site-header')!.getBoundingClientRect().height;}
function queueCompactBar(){
  if(compactQueued)return;compactQueued=true;
  requestAnimationFrame(()=>{compactQueued=false;const header=headerHeight();document.documentElement.style.setProperty('--site-header-height',`${header}px`);
    const end=$('#explorer').getBoundingClientRect().bottom, heading=$('.explorer-heading').getBoundingClientRect().bottom;
    compactBar.hidden=window.innerWidth>=1024||heading>header+64||end<header+160;
  });
}
window.addEventListener('scroll',queueCompactBar,{passive:true});window.addEventListener('resize',queueCompactBar);
new ResizeObserver(queueCompactBar).observe(document.querySelector('.site-header')!);
window.addEventListener('pageshow',queueCompactBar);
function renderActiveFilters(){
  const filters:[string,string][]=[];
  if(educationStage)filters.push(['stage',educationStage==='nursery'?'Servizi 0–3':'Infanzia 3–6']);
  if(nurseryService.value)filters.push(['service',nurseryService.value]);
  if(municipality.value)filters.push(['municipality',municipality.value==='unknown'?'Municipio da verificare':`Municipio ${municipality.value}`]);
  if(management.value)filters.push(['management',management.value]);
  if(origin)filters.push(['origin',`Entro ${radius.value} km`]);
  if(searchMode==='name'&&query.value.trim())filters.push(['query',query.value.trim()]);
  if(onlySaved)filters.push(['saved','Solo salvate']);
  const host=$('#active-filters');host.replaceChildren();
  filters.forEach(([key,label])=>{const button=document.createElement('button');button.type='button';button.dataset.clearFilter=key;button.textContent=label+' ×';button.setAttribute('aria-label',`Rimuovi filtro: ${label}`);host.append(button);});
  const count=filters.filter(([key])=>key!=='query').length;
  $('#filter-toggle-count').textContent=String(count);$('#filter-toggle-count').hidden=!count;
  $('[data-compact-filter-count]').textContent=String(count);$('[data-compact-filter-count]').hidden=!count;
}
$('#active-filters').addEventListener('click',event=>{
  const button=(event.target as Element).closest<HTMLElement>('[data-clear-filter]');if(!button)return;
  switch(button.dataset.clearFilter){
    case 'stage':educationStage='';nurseryService.value='';break;
    case 'service':nurseryService.value='';break;
    case 'municipality':municipality.value='';break;
    case 'management':management.value='';break;
    case 'saved':onlySaved=false;break;
    case 'query':query.value='';break;
    case 'origin':clearOrigin();selectedAddress=null;query.value='';status.textContent='';break;
  }
  filterSchools();
});
function clearMapSelection(){
  selectedSchoolId=null;$('#map-selection').classList.remove('is-active');
  $('#map-selected-name').textContent='Scegli una scuola';
  $('#map-selected-address').textContent='Seleziona un punto sulla mappa o usa “Sulla mappa” da una scheda.';
  $('#map-selected-link').hidden=true;document.getElementById('map-cluster-options')?.remove();
}
async function selectSchool(id:string,fromMap=false){
  const school=filtered.find(s=>s.id===id);if(!school||school.lat===null||school.lng===null)return;
  selectedSchoolId=id;$('#map-selection').classList.add('is-active');
  const index=filtered.findIndex(s=>s.id===id);
  if(index>=shown){shown=Math.ceil((index+1)/12)*12;renderList();}
  document.querySelectorAll<HTMLElement>('.school-card').forEach(card=>{const selected=card.dataset.schoolId===id;card.classList.toggle('is-map-selected',selected);card.querySelector('[data-locate-school]')?.setAttribute('aria-pressed',String(selected));});
  document.getElementById('map-cluster-options')?.remove();
  $('#map-selected-name').textContent=school.name;$('#map-selected-address').textContent=`${school.address} · ${school.serviceType} · ${school.ageRange}`;
  const link=$<HTMLAnchorElement>('#map-selected-link');link.href=schoolHref(school);link.hidden=false;
  if(!fromMap&&window.innerWidth<1024){$('#explorer').classList.add('map-mode');setViewControls('map');}
  await initMap();
  if(map){map.invalidateSize();map.setView([school.lat,school.lng],Math.max(map.getZoom(),16),{animate:false});renderMarkers();}
  if(!fromMap&&window.innerWidth<1024)scrollToResults();
  $('#map-selected-name').focus({preventScroll:true});
}
document.addEventListener('click',event=>{const button=(event.target as Element).closest<HTMLElement>('[data-locate-school]');if(button)void selectSchool(button.dataset.locateSchool!);});
function showClusterSchools(group:School[]){
  document.getElementById('map-cluster-options')?.remove();$('#map-selected-link').hidden=true;
  $('#map-selection').classList.add('is-active');$('#map-selected-name').textContent=`${group.length} servizi in questo punto`;
  $('#map-selected-address').textContent='Scegli la sede e la fascia d’età che ti interessano.';
  const list=document.createElement('div');list.id='map-cluster-options';
  group.forEach(s=>{const button=document.createElement('button');button.type='button';button.textContent=`${s.name} · ${s.serviceType} · ${s.ageRange}`;button.addEventListener('click',()=>void selectSchool(s.id,true));list.append(button);});$('#map-selection').append(list);
}
function initMap():Promise<void>{
  if(mapStartup)return mapStartup;
  mapStartup=(async()=>{
    try{leaflet=await import('leaflet');}catch{ $('#school-map').textContent='La mappa non è disponibile. Le sedi restano consultabili nell’elenco.';return; }
    const L=leaflet;
    map=L.map('school-map',{scrollWheelZoom:false,zoomControl:false}).setView([45.4642,9.19],11);
    L.control.zoom({position:'bottomright',zoomInTitle:'Ingrandisci',zoomOutTitle:'Riduci'}).addTo(map);
    installBasemap(L,map,message=>{const status=$('#basemap-status');status.textContent=message;status.hidden=!message;});
    markersLayer=L.layerGroup().addTo(map);originLayer=L.layerGroup().addTo(map);
    map.on('zoomend',()=>renderMarkers());
    new ResizeObserver(()=>{map.invalidateSize();renderMarkers();}).observe($('#school-map'));
    renderMarkers();
    if(pendingMapView){map.setView([pendingMapView.lat,pendingMapView.lng],pendingMapView.zoom,{animate:false});pendingMapView=null;}else fitMap();
  })();return mapStartup;
}
function renderMarkers(){
  if(!map||!markersLayer)return;
  const L=leaflet;markersLayer.clearLayers();originLayer.clearLayers();
  if(origin){L.circle([origin.lat,origin.lng],{radius:radiusKm(radius.value)*1000,color:'#A64D32',weight:1.5,fillOpacity:.06,interactive:false}).addTo(originLayer);L.circleMarker([origin.lat,origin.lng],{radius:7,color:'#FFFDF5',weight:3,fillColor:'#A64D32',fillOpacity:1}).addTo(originLayer).bindTooltip('Indirizzo cercato');}
  const points=filtered.filter(s=>s.lat!==null&&s.lng!==null),missing=filtered.length-points.length;
  $('#map-note').textContent=missing?`${missing} ${missing===1?'sede senza coordinate resta':'sedi senza coordinate restano'} nell’elenco.`:'Tutte le sedi filtrate hanno coordinate disponibili.';
  const buckets=new Map<string,School[]>(),zoom=map.getZoom();
  for(const s of points){const p=map.project([s.lat,s.lng],zoom);const key=zoom<16?`${Math.floor(p.x/48)}-${Math.floor(p.y/48)}`:`${s.lat!.toFixed(5)}:${s.lng!.toFixed(5)}`;const group=buckets.get(key)||[];group.push(s);buckets.set(key,group);}
  const colors:Record<string,string>={Comunale:'#32775B',Statale:'#6551A0',Privata:'#A64D32',Parentale:'#A65078'};
  for(const group of buckets.values()){
    const lat=group.reduce((n,s)=>n+s.lat!,0)/group.length,lng=group.reduce((n,s)=>n+s.lng!,0)/group.length;
    if(group.length>1){
      const selected=group.some(s=>s.id===selectedSchoolId);
      const marker=L.marker([lat,lng],{icon:L.divIcon({html:`<span class="school-cluster${selected?' is-selected':''}">${group.length}</span>`,className:'custom-school-marker',iconSize:[44,44],iconAnchor:[22,22]}),title:`${group.length} sedi: ingrandisci`}).addTo(markersLayer);
      marker.getElement()?.setAttribute('aria-label',`${group.length} sedi: ${selected?'contiene la scuola selezionata':'ingrandisci'}`);marker.getElement()?.setAttribute('aria-pressed',String(selected));
      marker.on('click',()=>{if(zoom>=17)showClusterSchools(group);else map.fitBounds(group.map(s=>[s.lat,s.lng]),{padding:[45,45],maxZoom:17,animate:false});});
    }else{
      const school=group[0],selected=school.id===selectedSchoolId;
      const marker=L.marker([school.lat,school.lng],{icon:L.divIcon({html:`<span class="school-map-pin${selected?' is-selected':''}" style="--pin:${colors[school.management]||'#68655B'}"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8"><path d="${selected?'m5 12 4 4L19 6':'m3 10 9-6 9 6v10H3ZM9 20v-6h6v6'}"/></svg></span>`,className:'custom-school-marker',iconSize:[44,44],iconAnchor:[22,33]}),title:school.name,zIndexOffset:selected?1000:0}).addTo(markersLayer);
      marker.getElement()?.setAttribute('aria-label',`${school.name}, ${school.ageRange}`);marker.getElement()?.setAttribute('aria-pressed',String(selected));marker.on('click',()=>void selectSchool(school.id,true));
    }
  }
}
function fitMap(){
  if(!map||!$('#school-map').clientWidth||!$('#school-map').offsetParent)return;
  const points=filtered.filter(s=>s.lat!==null&&s.lng!==null).map(s=>[s.lat,s.lng]);
  if(origin)map.fitBounds(leaflet.latLng(origin.lat,origin.lng).toBounds(radiusKm(radius.value)*2000),{padding:[28,28],maxZoom:15,animate:false});
  else if(points.length)map.fitBounds(points,{padding:[38,38],maxZoom:15,animate:false});
}
$('#fit-map').addEventListener('click',fitMap);
window.matchMedia('(min-width:1024px)').addEventListener('change',()=>{if(filtersDialog.open)filtersDialog.close();if(map){map.invalidateSize();fitMap();}});
updateMode();filterSchools(false);dock();
setViewControls(resume?.view || 'list');
if(resume){
  shown=Math.max(12,Math.min(resume.shown,Math.ceil(filtered.length/12)*12));renderList();
  resume.expandedFacts.forEach(id=>document.querySelector<HTMLDetailsElement>(`[data-card-fact="${CSS.escape(id)}"]`)?.setAttribute('open',''));
  const selected=filtered.find(s=>s.id===selectedSchoolId);
  if(selected){$('#map-selection').classList.add('is-active');$('#map-selected-name').textContent=selected.name;$('#map-selected-address').textContent=`${selected.address} · ${selected.serviceType} · ${selected.ageRange}`;const link=$<HTMLAnchorElement>('#map-selected-link');link.href=schoolHref(selected);link.hidden=false;}
  if(location.hash==='#riprendi')history.replaceState(null,'',location.pathname+location.search);
  let interacted=false;
  ['wheel','pointerdown','keydown','touchstart'].forEach(type=>window.addEventListener(type,()=>{interacted=true;},{once:true,passive:true}));
  const restore=()=>{if(!interacted){window.scrollTo({top:resume.scrollY,behavior:'instant'});queueCompactBar();}};
  requestAnimationFrame(()=>requestAnimationFrame(restore));
  void document.fonts.ready.then(restore);
}
document.addEventListener('click',event=>{
  const anchor=(event.target as Element).closest<HTMLAnchorElement>('a[href]');if(!anchor)return;
  const url=new URL(anchor.href,location.href);if(url.origin!==location.origin||!url.pathname.startsWith('/scuole/'))return;
  const center=map?.getCenter();
  const snapshot:SearchSession={version:1,savedAt:Date.now(),url:location.pathname+location.search,openedPath:url.pathname,
    mode:searchMode,query:query.value,stage:educationStage,radius:radius.value,municipality:municipality.value,management:management.value,service:nurseryService.value,sort:sort.value as SearchSession['sort'],onlySaved,origin,
    expandedFacts:[...document.querySelectorAll<HTMLDetailsElement>('[data-card-fact][open]')].map(el=>el.dataset.cardFact!),view:$('#explorer').classList.contains('map-mode')?'map':'list',shown,count:filtered.length,selectedId:selectedSchoolId,scrollY:window.scrollY,mapView:center?{lat:center.lat,lng:center.lng,zoom:map.getZoom()}:null};
  writeSearchSession(tabSearchStorage(),snapshot);
});
new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting))void initMap();},{rootMargin:'200px'}).observe($('#school-map'));

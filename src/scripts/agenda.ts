import { schools } from '../lib/catalog-client';
import { collectAgendaEvents, filterAgendaEvents, type AgendaFilters } from '../lib/agenda-events';
import { loadFamily } from '../lib/family';
import { downloadCalendar } from '../lib/calendar';
import { notify } from './shared';
const events=collectAgendaEvents(schools);
let onlySaved=false;
const past=document.querySelector<HTMLInputElement>('#past-events')!;
const month=document.querySelector<HTMLSelectElement>('#event-month')!;
const municipality=document.querySelector<HTMLSelectElement>('#event-municipality')!;
const stage=document.querySelector<HTMLSelectElement>('#event-stage')!;
let current=events;
function render(){const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome'}).format(new Date());const saved=loadFamily().saved;current=filterAgendaEvents(events,{today,stage:stage.value as AgendaFilters['stage'],includePast:past.checked,month:month.value,municipality:Number(municipality.value)||undefined,saved:onlySaved?saved:undefined});const ids=new Set(current.map(e=>e.id));document.querySelectorAll<HTMLElement>('[data-event-id]').forEach(el=>el.hidden=!ids.has(el.dataset.eventId!));document.querySelectorAll<HTMLElement>('[data-event-month]').forEach(el=>el.hidden=!current.some(e=>e.date.startsWith(el.dataset.eventMonth!)));document.querySelector('#agenda-results-count')!.textContent=`${current.length} ${current.length===1?'incontro':'incontri'}${onlySaved?' nelle tue scuole':''}`;document.querySelector<HTMLElement>('#no-events')!.hidden=!!current.length;document.querySelector<HTMLButtonElement>('#export-events')!.disabled=!current.length;document.querySelector('#all-events')!.setAttribute('aria-pressed',String(!onlySaved));document.querySelector('#saved-events')!.setAttribute('aria-pressed',String(onlySaved));}
document.querySelector('#all-events')!.addEventListener('click',()=>{onlySaved=false;render();});
document.querySelector('#saved-events')!.addEventListener('click',()=>{onlySaved=true;render();});
[past,month,municipality,stage].forEach(input=>input.addEventListener('change',render));
document.querySelector('#export-events')!.addEventListener('click',()=>{if(current.length){downloadCalendar(current);notify(`Calendario preparato: ${current.length} ${current.length===1?'appuntamento':'appuntamenti'}.`);}});
document.querySelectorAll<HTMLElement>('[data-download-event]').forEach(button=>button.addEventListener('click',()=>{const event=events.find(e=>e.id===button.dataset.downloadEvent);if(event){downloadCalendar([event]);notify('Appuntamento preparato per il calendario.');}else notify('Non abbiamo trovato questo appuntamento. Ricarica la pagina e riprova.');}));
window.addEventListener('family:change',render);window.addEventListener('storage',render);render();

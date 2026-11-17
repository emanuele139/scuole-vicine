import { guideTopics } from '../lib/guide-topics';
const topic = document.querySelector<HTMLSelectElement>('#guide-topic')!;
const buttons = [...document.querySelectorAll<HTMLButtonElement>('button[data-guide-stage]')];
const params = new URLSearchParams(location.search);
let stage = ['nursery','preschool'].includes(params.get('eta') || '') ? params.get('eta')! : location.hash==='#guide-nidi' ? 'nursery' : location.hash==='#guide-infanzia' ? 'preschool' : '';
topic.value = guideTopics.some(item=>item.id===params.get('tema')) ? params.get('tema')! : '';
function render(changed = false) {
  const matches=(el:HTMLElement)=> (!stage||el.dataset.guideAge===stage) && (!topic.value||el.dataset.guideTopics?.split(' ').includes(topic.value));
  let guides=0,questions=0;
  document.querySelectorAll<HTMLElement>('[data-guide-card]').forEach(card=>{card.hidden=!matches(card);if(!card.hidden)guides++;});
  document.querySelectorAll<HTMLElement>('[data-topic-question]').forEach(question=>{question.hidden=!matches(question);if(!question.hidden)questions++;});
  document.querySelectorAll<HTMLElement>('.guide-stage-section').forEach(section=>section.hidden=!section.querySelector('[data-guide-card]:not([hidden])'));
  buttons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.guideStage===stage)));
  document.querySelector<HTMLElement>('#topic-questions')!.hidden=!topic.value||!questions;
  document.querySelector('#topic-questions-title')!.textContent=topic.value ? `Risposte su ${guideTopics.find(item=>item.id===topic.value)!.label.toLocaleLowerCase('it')}` : '';
  document.querySelector('#guide-filter-count')!.textContent=topic.value ? `${questions} ${questions===1?'risposta':'risposte'} · ${guides} ${guides===1?'guida':'guide'} da approfondire` : `${guides} ${guides===1?'guida':'guide'}${stage==='nursery'?' per i servizi 0–3':stage==='preschool'?' per l’infanzia 3–6':''}`;
  document.querySelector<HTMLElement>('#guide-empty')!.hidden=!!guides;
  const url=new URL(location.href);
  stage ? url.searchParams.set('eta',stage) : url.searchParams.delete('eta');
  topic.value ? url.searchParams.set('tema',topic.value) : url.searchParams.delete('tema');
  if(changed)url.hash='';
  history.replaceState(null,'',url);
}
buttons.forEach(button=>button.addEventListener('click',()=>{stage=button.dataset.guideStage!;render(true);}));
topic.addEventListener('change',()=>render(true));
document.querySelector('#guide-reset')!.addEventListener('click',()=>{stage='';topic.value='';render(true);});
render();

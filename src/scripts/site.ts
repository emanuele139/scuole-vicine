import { readSearchSession, tabSearchStorage } from '../lib/search-session';
// Shared presentation behavior; the family model owns all persisted state.
document.querySelectorAll<HTMLElement>('.character').forEach(character=>{
  character.addEventListener('pointerenter',()=>character.classList.add('is-greeting'),{once:true});
});
const indexLinks=[...document.querySelectorAll<HTMLAnchorElement>('.school-section-nav a[href^="#"]')];
if(indexLinks.length){
  const observer=new IntersectionObserver(entries=>{
    const active=entries.find(entry=>entry.isIntersecting);if(!active)return;
    indexLinks.forEach(link=>{const selected=link.hash===`#${active.target.id}`;link.classList.toggle('active',selected);if(selected)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');});
  },{rootMargin:'-20% 0px -60% 0px'});
  indexLinks.forEach(link=>{const section=document.getElementById(link.hash.slice(1));if(section)observer.observe(section);});
}

// A single short response in the editorial illustration; no continuous motion.
document.querySelectorAll<SVGElement>('.learning-world').forEach(scene=>{
  scene.addEventListener('pointerenter',()=>scene.classList.add('is-awake'),{once:true});
});

const returnLink = document.querySelector<HTMLAnchorElement>('[data-search-return]');
if (returnLink) {
  const previous = readSearchSession(tabSearchStorage());
  if (previous && previous.openedPath === location.pathname) {
    returnLink.href = `${previous.url}#riprendi`;
    returnLink.querySelector('[data-return-label]')!.textContent = 'Torna ai risultati';
    returnLink.setAttribute('aria-label', 'Torna alla ricerca, con filtri e posizione precedenti');
  }
}

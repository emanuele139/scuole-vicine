export type ResourceState={phase:'idle'|'loading'|'error'|'info';title?:string;detail?:string;retry?:boolean;};
export function resourceFeedback(host:HTMLElement){
  const title=host.querySelector<HTMLElement>('[data-resource-title]')!;
  const detail=host.querySelector<HTMLElement>('[data-resource-detail]')!;
  const retry=host.querySelector<HTMLButtonElement>('[data-resource-retry]')!;
  // Keep keyboard focus on the retry while preventing another pending attempt.
  retry.addEventListener('click',event=>{if(host.dataset.phase==='loading'){event.preventDefault();event.stopImmediatePropagation();}});
  return {host,retry,show(state:ResourceState){
    host.hidden=state.phase==='idle';host.dataset.phase=state.phase;
    title.textContent=state.title||'';detail.textContent=state.detail||'';detail.hidden=!state.detail;
    retry.hidden=!state.retry;retry.disabled=false;retry.setAttribute('aria-disabled',String(state.phase==='loading'));
    retry.firstChild!.textContent=state.phase==='loading'?'Riprovo… ':'Riprova ';
  }};
}

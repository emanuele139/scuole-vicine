export const guideTopics = [
  {id:'scelta',label:'Come scegliere'},
  {id:'costi',label:'Costi e bonus'},
  {id:'iscrizioni',label:'Iscrizioni e graduatorie'},
  {id:'ambientamento',label:'Ambientamento e giornata'},
  {id:'visite',label:'Visite e open day'},
] as const;
export type GuideTopic = typeof guideTopics[number]['id'];
export function questionTopics(slug:string,id:string): GuideTopic[] {
  if (slug==='costi-e-isee'||slug==='costi-bonus-nido') return ['costi'];
  if (slug==='iscrizioni-e-graduatorie') return ['iscrizioni'];
  if (slug==='iscrizioni-visite-nido') {
    if (id==='visite03') return ['visite'];
    if (id==='ambientamento03'||id==='orari03') return ['ambientamento'];
    return ['iscrizioni'];
  }
  if (slug==='open-day-e-visite') return id==='ambientamento'||id==='orari' ? ['ambientamento'] : ['visite'];
  return ['scelta'];
}
export function topicsForGuide(guide:{slug:string;questions:{id:string}[]}): GuideTopic[] {
  return [...new Set(guide.questions.flatMap(q=>questionTopics(guide.slug,q.id)))];
}

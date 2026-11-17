import { seo } from '../../seo.config.mjs';
import { project } from '../data/project';
import { schools, schoolHref, type School } from './catalog';
import guideData from '../data/guides.json';
import { catalogText } from './catalog-copy';
import { territorialAccess } from './access';
export { seo };
export type Crumb = { name: string; path: string };
export type SeoPage = { path: string; title: string; description: string; kind?: string; crumbs?: Crumb[]; school?: School; guide?: typeof guideData.guides[number]; members?: School[] };
export const absolute = (path: string) => new URL(path, seo.site).href;
const home = { name: project.name, path: '/' };
export const stageCollections = [
  { path: '/nidi/', stage: 'nursery', title: 'Nidi e servizi 0–3 a Milano e dintorni', description: 'Nidi, micronidi, nidi famiglia, centri prima infanzia e sezioni primavera a Milano e dintorni: indirizzi, gestione, orari, rette e fonti da verificare.' },
  { path: '/scuole-infanzia/', stage: 'preschool', title: 'Scuole dell’infanzia a Milano e dintorni · 3–6 anni', description: 'Scuole dell’infanzia comunali, statali, private e parentali a Milano e dintorni: confronta indirizzi, orari, costi e visite con le fonti e l’anno di riferimento.' },
] as const;
const basePages: SeoPage[] = [
  { path: '/comuni/', title: 'Nidi e infanzia nei 23 comuni confinanti con Milano', description: 'Accesso per non residenti, priorità, tariffe e agevolazioni: confronta le regole dei comuni confinanti, con le sedi censite nella ricerca e nella mappa.', kind: 'CollectionPage' },
  { path: '/privacy/', title: 'Informativa privacy e cookie', description: 'Dati di navigazione, statistiche Umami, mappe, spazio famiglia e segnalazioni: finalità, conservazione, diritti e preferenze privacy.' },
  { path: '/', title: 'Nidi e scuole dell’infanzia a Milano e dintorni', description: 'Cerca nidi e scuole dell’infanzia a Milano e nei 23 comuni confinanti per indirizzo, nome, Comune e Municipio. Confronta orari, costi e open day, con fonti e informazioni da confermare.', kind: 'CollectionPage' },
  { path: '/guide/', title: 'Guide alla scelta di nidi e scuole a Milano', description: 'Risposte su nidi 0–3 e infanzia 3–6 a Milano: differenze tra servizi, costi, ISEE, iscrizioni e visite. Fonti e periodi di riferimento per ogni guida.', kind: 'CollectionPage' },
  { path: '/agenda/', title: 'Open day di nidi e scuole dell’infanzia a Milano', description: 'Consulta gli open day documentati dei nidi e delle scuole dell’infanzia di Milano: date, sedi, fonti e prenotazioni. Raccolta parziale con eventi anche passati.', kind: 'CollectionPage' },
  { path: '/iscrizioni/', title: 'Iscrizioni a nidi e scuole dell’infanzia a Milano', description: 'Come orientarsi tra iscrizioni comunali, statali e private a Milano: età, documenti, visite e costi. Distingui le regole 2026/27 da quelle da confermare.' },
  { path: '/metodo/', title: 'Catalogo scuole di Milano: metodo, dati e fonti', description: 'Come Scuole Vicine confronta i cataloghi di Comune, MIM e Regione Lombardia: copertura di nidi e infanzia, verifiche, anni di riferimento e dati mancanti.' },
  { path: '/progetto/', title: 'Il progetto Scuole Vicine e il suo autore', description: 'Scuole Vicine è un progetto indipendente e gratuito di Emanuele Cardinali per orientarsi tra nidi e scuole dell’infanzia a Milano. Fonti, limiti e contributi.', kind: 'AboutPage' },
];
function schoolQualifier(s: School) {
  const homonyms = schools.filter(other => other.name.toLocaleLowerCase('it') === s.name.toLocaleLowerCase('it') && other.educationStage === s.educationStage);
  if (homonyms.length < 2) return '';
  const sameAddress = homonyms.filter(other => other.address === s.address).length > 1;
  return ` · ${s.address}${sameAddress && s.sourceIds.cudes ? ` · CUDES ${s.sourceIds.cudes}` : ''}`;
}
export const schoolTitle = (s: School) => `${s.name}${schoolQualifier(s)} · ${s.serviceType} a ${s.comune}${s.status === 'historical' ? ' · Scheda storica' : ''}`;
export const schoolDescription = (s: School) => s.status === 'historical'
  ? `${s.name}, ${s.address}, ${s.comune}: scheda storica con chiusura documentata. Consulta le fonti; un’eventuale riapertura non è confermata.`
  : `${s.name}${schoolQualifier(s).includes('CUDES') ? `, CUDES ${s.sourceIds.cudes}` : ''}, ${s.address}, ${s.comune}${s.municipality ? `, Municipio ${s.municipality}` : ''}. ${s.serviceType}, ${s.ageRange}. Orari, costi, visite, fonti e dati da confermare.`;
export const collectionPages: SeoPage[] = [
  ...stageCollections.map(c => ({ ...c, kind: 'CollectionPage', members: schools.filter(s => s.educationStage === c.stage) })),
  ...Array.from({ length: 9 }, (_, i) => {
    const n = i + 1;
    return { path: `/municipi/${n}/`, title: `Nidi e scuole dell’infanzia nel Municipio ${n} di Milano`, description: `Consulta i servizi 0–3 e le scuole 3–6 del Municipio ${n} di Milano presenti nel catalogo: indirizzi, tipologie, gestione e collegamenti alle schede con fonti.`, kind: 'CollectionPage', members: schools.filter(s => s.municipality === n) };
  }),
];
export const pages: SeoPage[] = [
  ...basePages, ...collectionPages,
  ...territorialAccess.municipalities.map(municipality => ({ path: `/comuni/${municipality.slug}/`, title: `${municipality.name}: accesso a nidi e infanzia fuori comune`, description: `Regole per non residenti a ${municipality.name}: nidi comunali, infanzia comunale e statale, priorità, costi e agevolazioni con fonti e anno.`, crumbs: [home, { name: 'Comuni confinanti', path: '/comuni/' }, { name: municipality.name, path: `/comuni/${municipality.slug}/` }] })),
  ...guideData.guides.map(guide => ({ path: `/guide/${guide.slug}/`, title: `${guide.title} · Milano`, description: guide.intro, kind: 'Article', guide, crumbs: [home, { name: 'Guide alla scelta', path: '/guide/' }, { name: guide.title, path: `/guide/${guide.slug}/` }] })),
  ...schools.map(school => {
    const parent = school.comuneSlug !== 'milano' ? {title: school.comune, path: `/comuni/${school.comuneSlug}/`} : stageCollections.find(c => c.stage === school.educationStage)!;
    return { path: schoolHref(school), title: schoolTitle(school), description: schoolDescription(school), school, crumbs: [home, { name: parent.title, path: parent.path }, { name: school.name, path: schoolHref(school) }] };
  }),
];
export const pageMap = new Map(pages.map(p => [p.path, p]));
export const breadcrumbs = (page: SeoPage): Crumb[] => page.crumbs ?? (page.path === '/' ? [] : [home, { name: page.title, path: page.path }]);
export const safeJson = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
export function structuredData(page: SeoPage) {
  const url = absolute(page.path), authorId = absolute('/progetto/#autore'), websiteId = absolute('/#website');
  const crumbs = breadcrumbs(page);
  const school = page.school;
  const graph: Record<string, unknown>[] = [
    { '@type': 'Person', '@id': authorId, name: project.author, url: project.authorUrl || absolute('/progetto/#autore'), ...(project.authorUrl ? { sameAs: [project.authorUrl] } : {}) },
    { '@type': 'WebSite', '@id': websiteId, url: absolute('/'), name: project.name, description: project.tagline, inLanguage: 'it-IT', publisher: { '@id': authorId }, about: { '@type': 'City', name: 'Milano' } },
    { '@type': page.kind === 'Article' ? 'WebPage' : page.kind || 'WebPage', '@id': `${url}#webpage`, url, name: page.title, description: page.description, inLanguage: 'it-IT', isPartOf: { '@id': websiteId }, author: { '@id': authorId }, ...(crumbs.length ? { breadcrumb: { '@id': `${url}#breadcrumb` } } : {}), ...(school ? { mainEntity: { '@id': `${url}#school` } } : page.guide ? { mainEntity: { '@id': `${url}#article` } } : {}) },
  ];
  if (crumbs.length) graph.push({ '@type': 'BreadcrumbList', '@id': `${url}#breadcrumb`, itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: absolute(c.path) })) });
  if (school) {
    // The directory page is not the school's official website. Unknown / historical
    // locations, network tariffs and opening hours are deliberately not asserted here.
    graph.push({ '@type': school.educationStage === 'preschool' ? 'Preschool' : 'EducationalOrganization', '@id': `${url}#school`, name: school.name, description: school.status === 'historical' ? schoolDescription(school) : catalogText(school.description), mainEntityOfPage: { '@id': `${url}#webpage` }, ...(school.code || school.sourceIds.cudes ? { identifier: school.code || { '@type': 'PropertyValue', propertyID: 'CUDES', value: school.sourceIds.cudes } } : {}), ...(school.status === 'active' ? { address: { '@type': 'PostalAddress', streetAddress: school.address, addressLocality: school.comune, addressCountry: 'IT' } } : {}) });
    graph[2].citation = [...new Set(school.sources.map(s => s.url))];
  }
  if (page.guide) {
    const citations = [...new Set(page.guide.questions.flatMap(q => q.refs))].map(key => guideData.sources[key as keyof typeof guideData.sources].url);
    graph.push({ '@type': 'Article', '@id': `${url}#article`, headline: page.guide.title, description: page.description, inLanguage: 'it-IT', author: { '@id': authorId }, publisher: { '@id': authorId }, mainEntityOfPage: { '@id': `${url}#webpage` }, citation: citations, about: { '@type': 'Thing', name: page.guide.stage === 'nursery' ? 'Nidi e servizi 0–3 a Milano' : 'Scuola dell’infanzia 3–6 a Milano' } });
  }
  const members = page.members ?? (page.path === '/guide/' ? guideData.guides.map(g => ({ name: g.title, path: `/guide/${g.slug}/` })) : undefined);
  if (members) {
    graph[2].mainEntity = { '@id': `${url}#elenco` };
    graph.push({ '@type': 'ItemList', '@id': `${url}#elenco`, numberOfItems: members.length, itemListElement: members.map((member, i) => ({ '@type': 'ListItem', position: i + 1, name: member.name, url: absolute('slug' in member ? schoolHref(member) : member.path) })) });
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}

import type { School, SchoolSource, FieldEvidence } from './catalog';
import territorialData from '../data/territorial-access.json';
import neighborData from '../data/neighbor-schools.json';
import milanData from '../data/milan-access.json';

export type AccessEvidence = { status: string; scope?: string; sourceUrls?: string[]; year?: string | null };
export type MilanAccess = {
  id: string; municipalityName: string; stage: 'nursery' | 'preschool'; management: string;
  status: string; evidenceScope: 'network' | 'school' | 'unknown'; year: string; verifiedAt: string | null; reviewedAt?: string;
  eligibility: string | { residents: string; nonResidents: string; summary: string };
  priority: string; costs: string; benefits: string; application: string; questions: string[];
  sources: (SchoolSource & { accessStatus?: string })[]; fieldEvidence?: Record<string, AccessEvidence>;
  websiteWarning?: string; suspendedWebsiteHosts?: string[];
};
export type TerritorialService = {
  stage: 'nursery' | 'preschool'; management: string; status: string; year: string;
  eligibility: string; priority: string; costs: string; benefits: string; application: string;
  notes: string[]; sources: SchoolSource[];
  tariffExamples?: { label: string; amount: number | string; unit: string; conditions: string; year: string }[];
};
export type TerritorialMunicipality = { slug: string; name: string; services: TerritorialService[] };
export type TerritorialData = { checkedAt: string; municipalities: TerritorialMunicipality[] };
// Administrative overlays keep stable catalog and family identities unchanged.
export const territorialAccess = territorialData as unknown as TerritorialData;
export const milanAccessRecords = milanData.records as unknown as MilanAccess[];
const byId = new Map(milanAccessRecords.map(record => [record.id, record]));
export function getSchoolAccess(id: string): MilanAccess | undefined {
  const milan = byId.get(id);
  if (milan) return milan;
  const school = (neighborData as School[]).find(s => s.id === id);
  // Municipal conditions apply to public routes, never to private seats by proximity.
  if (!school || !['Comunale', 'Statale'].includes(school.management)) return undefined;
  const municipality = territorialAccess.municipalities.find(m => m.slug === school.comuneSlug);
  const service = municipality?.services.find(s => s.stage === school.educationStage && s.management === school.management);
  if (!service) return undefined;
  const fieldEvidence = Object.fromEntries(['eligibility','priority','costs','benefits'].map(key => [key, {
    status: service.status === 'not-found' ? 'not-found' : 'network-rule',
    scope: 'municipality', sourceUrls: service.sources.map(s => s.url), year: service.year,
  }]));
  return { ...service, id, municipalityName: school.comune, evidenceScope: 'network',
    verifiedAt: null, reviewedAt: territorialAccess.checkedAt, questions: service.notes, fieldEvidence };
}
export const eligibilityText = (record: MilanAccess) => typeof record.eligibility === 'string' ? record.eligibility : record.eligibility.summary;
export function schoolCost(school: School): {value:string|null; evidence:FieldEvidence|undefined; alternative?:string} {
  const record = getSchoolAccess(school.id);
  const field = record?.fieldEvidence?.costs;
  if (school.management==='Privata' && school.cost && field?.status==='network-rule') {
    return {value:`Iscrizione privata: ${school.cost}`,evidence:school.research?.fieldEvidence.cost,alternative:record!.costs};
  }
  if (record?.costs && field && ['network-rule','verified','needs-confirmation','prior-research'].includes(field.status)) {
    return {value:record.costs,evidence:{status:field.status==='network-rule'?(school.comuneSlug && school.comuneSlug !== 'milano' ? 'municipal-rule' : 'operator-rule'):field.status as FieldEvidence['status'],sourceUrls:field.sourceUrls || [],year:field.year || null}};
  }
  return {value:school.cost,evidence:school.research?.fieldEvidence.cost};
}
export function schoolWebsiteAllowed(school: School, url:string|null|undefined): boolean {
  if (!url) return false;
  try { const parsed=new URL(url); return ['http:','https:'].includes(parsed.protocol) && !getSchoolAccess(school.id)?.suspendedWebsiteHosts?.includes(parsed.hostname.replace(/^www\./,'')); }
  catch { return false; }
}
export const serviceKey = (service: Pick<TerritorialService, 'stage' | 'management'>) => service.stage === 'nursery' ? 'nidi' : service.management === 'Statale' ? 'infanzia-statale' : 'infanzia-comunale';
export const serviceLabel = (service: Pick<TerritorialService, 'stage' | 'management'>) => service.stage === 'nursery' ? 'Nidi comunali' : service.management === 'Statale' ? 'Infanzia statale' : 'Infanzia comunale';
export const accessStatusLabel = (status: string) => status === 'verified' ? 'Regole documentate' : status === 'partial' ? 'Verifica parziale' : 'Da verificare';
export function accessCardCopy(school: School) {
  const record = getSchoolAccess(school.id);
  if (!record || record.evidenceScope === 'unknown') return 'Requisiti da chiedere alla scuola';
  if (school.management === 'Comunale') return 'Residenza e requisiti del bando comunale';
  if (school.management === 'Statale') return 'Domanda alla scuola; priorità dell’istituto';
  return 'Condizioni della sede da verificare';
}

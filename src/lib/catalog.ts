import schoolData from '../data/schools.json';
import nurseryData from '../data/nurseries.json';
import reportData from '../data/reconciliation-report.json';

export type Management = 'Comunale' | 'Statale' | 'Privata' | 'Parentale' | 'Da verificare';
export type SchoolStatus = 'active' | 'needs-review' | 'historical';
export type SchoolSource = {
  label: string;
  url: string;
  year?: string;
  checkedAt?: string;
  publicPublicationEvidence?: { pageUrl: string; linkText: string; rationale: string };
};
export type SchoolEvent = {
  id: string;
  date: string;
  time: string;
  source: string;
  booking?: string;
  location?: string;
};
export type FieldEvidence = {
  status: 'verified' | 'operator-rule' | 'not-published' | 'not-found' | 'blocked' | 'needs-confirmation' | 'prior-research';
  sourceUrls: string[];
  year: string | null;
};
export type SchoolResearch = {
  checkedAt: string;
  group: string;
  fieldEvidence: Record<'hours' | 'cost' | 'services' | 'openDay', FieldEvidence>;
  attemptCount: number;
  schoolSpecific: boolean;
};
export type School = {
  educationStage: 'nursery' | 'preschool';
  serviceType: string;
  ageRange: string;
  accessMode: string;
  operator: string | null;
  id: string;
  name: string;
  slug: string;
  address: string;
  zone: string;
  municipality: number | null;
  management: Management;
  recognition: string;
  lat: number | null;
  lng: number | null;
  legacyId: string | null;
  code: string | null;
  url: string | null;
  phone: string | null;
  email: string | null;
  description: string;
  hours: string | null;
  cost: string | null;
  services?: string[];
  officialPage?: string | null;
  research?: SchoolResearch;
  openDay: string | null;
  events: SchoolEvent[];
  sources: SchoolSource[];
  catalogYear: string;
  detailYear: string | null;
  status: SchoolStatus;
  verifiedAt: string | null;
  enriched: boolean;
  warnings: string[];
  sourceIds: { municipal?: string; mim?: string; cudes?: string };
  aliases: string[];
  locationYear: string | null;
  geographyYear?: string | null;
  dataStatus: { identity: string; details: string; location: string };
};
export type ReconciliationSummary = {
  municipalInput: number;
  curatedInput: number;
  mimMilanoInfanzia: number;
  mimMatchedToMunicipal: number;
  municipalWithoutMimMatch: number;
  addedFromMim: number;
  additionalCurated: number;
  total: number;
  enriched: number;
  geolocated: number;
  needsReview: number;
  addressConflicts: number;
  unresolvedMim: number;
  events: number;
};
export type ReconciliationReport = typeof reportData & { summary: ReconciliationSummary };

// Keep the 3–6 reconciliation pipeline and stable family IDs separate from 0–3 sources.
export const preschools = schoolData.map(school => ({
  ...school,
  educationStage: 'preschool' as const,
  serviceType: 'Scuola dell’infanzia',
  ageRange: '3–6 anni',
  accessMode: school.management === 'Comunale' ? 'Iscrizione comunale' : 'Iscrizione presso la scuola; verificare le modalità',
  operator: null,
})) as School[];
export const nurseries = nurseryData as School[];
export const schools: School[] = [...preschools, ...nurseries];
export const report: ReconciliationReport = reportData;
export const municipalities = [...new Set(schools.flatMap(s => s.municipality === null ? [] : [s.municipality]))].sort((a, b) => a - b);
export const zones = [...new Set(schools.map(s => s.zone).filter(z => z !== 'Zona da verificare'))].sort((a, b) => a.localeCompare(b, 'it'));
export const managements: Management[] = ['Comunale', 'Statale', 'Privata', 'Parentale'];
export const catalogStats = {
  total: schools.length,
  nurseries: nurseries.length,
  preschools: preschools.length,
  municipalities: municipalities.length,
  enriched: schools.filter(s => s.enriched).length,
  geolocated: schools.filter(s => s.lat !== null && s.lng !== null).length,
  needsReview: schools.filter(s => s.status === 'needs-review').length,
  reviewed: schools.filter(s => s.research).length,
};

/** Accept canonical ID, generated slug, preserved legacy ID or MIM code. */
export function getSchool(id: string): School | undefined {
  return schools.find(s => s.id === id || s.slug === id || s.legacyId === id || s.code === id);
}

export function schoolHref(school: School): string {
  return `/scuole/${school.slug}/`;
}

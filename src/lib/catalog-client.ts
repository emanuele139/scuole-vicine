// Browser interactions need identities, locations and events, not the research archive.
import data from '../data/catalog-client.json';
import nurseryData from '../data/nurseries-client.json';
import neighborData from '../data/neighbor-schools-client.json';
import type { School } from './catalog';

export type ClientSchool = Pick<School,
  'comune' | 'comuneSlug' | 'id' | 'name' | 'slug' | 'address' | 'zone' | 'municipality' | 'management' |
  'recognition' | 'lat' | 'lng' | 'legacyId' | 'code' | 'aliases' | 'enriched' | 'events' |
  'educationStage' | 'serviceType' | 'ageRange' | 'accessMode' | 'operator'
>;
export const schools: ClientSchool[] = [
  ...data.map(school => ({
    ...school,
    comune: 'Milano',
    comuneSlug: 'milano',
    educationStage: 'preschool' as const,
    serviceType: 'Scuola dell’infanzia',
    ageRange: '3–6 anni',
    accessMode: school.management === 'Comunale' ? 'Iscrizione comunale' : 'Iscrizione presso la scuola; verificare le modalità',
    operator: null,
  })) as ClientSchool[],
  ...nurseryData.map(school => ({...school, comune: 'Milano', comuneSlug: 'milano'})) as ClientSchool[],
  ...neighborData as ClientSchool[],
];
export function getSchool(id: string): ClientSchool | undefined {
  return schools.find(s => s.id === id || s.slug === id || s.legacyId === id || s.code === id);
}
export function schoolHref(school: Pick<ClientSchool, 'slug'>): string {
  return `/scuole/${school.slug}/`;
}

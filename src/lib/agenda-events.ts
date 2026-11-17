import type { School, SchoolEvent } from './catalog';

type EventSchool = Pick<School, 'id' | 'name' | 'slug' | 'address' | 'municipality' | 'management' | 'educationStage' | 'events'>;
export type AgendaEvent<S extends EventSchool> = SchoolEvent & { school: S; schools: S[] };
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('it').replace(/[^a-z0-9]/g, '');

/** One visit can cover both nursery and preschool at the same campus.
 * Merge only an identical date, time, source and declared location. Keep all
 * service associations so saving either service still finds/exports the visit.
 */
export function collectAgendaEvents<S extends EventSchool>(schools: S[]): AgendaEvent<S>[] {
  const groups = new Map<string, AgendaEvent<S>>();
  for (const school of schools) for (const event of school.events) {
    const key = [event.date, event.time, event.source.replace(/#.*$/, ''), normalize(event.location || school.address)].join('|');
    const previous = groups.get(key);
    if (!previous) {
      groups.set(key, { ...event, school: { ...school }, schools: [school] });
      continue;
    }
    if (!previous.schools.some(item => item.id === school.id)) previous.schools.push(school);
    previous.school.name = previous.schools.map(item => item.name).join(' / ');
    previous.booking = [...new Set([previous.booking, event.booking].filter(Boolean))].join(' · ') || undefined;
  }
  return [...groups.values()].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}

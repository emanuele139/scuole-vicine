import type { School, SchoolEvent } from './catalog';

type EventSchool = Pick<School, 'id' | 'name' | 'slug' | 'address' | 'municipality' | 'management' | 'educationStage' | 'events'>;
export type AgendaEvent<S extends EventSchool> = SchoolEvent & { school: S; schools: S[] };
export type AgendaFilters = {
  today: string;
  stage?: '' | 'nursery' | 'preschool';
  includePast?: boolean;
  month?: string;
  municipality?: number;
  saved?: readonly string[];
};

/** Keep a shared visit once when any associated service covers the selected age. */
export function filterAgendaEvents<S extends EventSchool>(events: AgendaEvent<S>[], filters: AgendaFilters): AgendaEvent<S>[] {
  return events.filter(event =>
    (filters.includePast || event.date >= filters.today) &&
    (!filters.stage || event.schools.some(school => school.educationStage === filters.stage)) &&
    (!filters.month || event.date.startsWith(filters.month)) &&
    (!filters.municipality || event.schools.some(school => school.municipality === filters.municipality)) &&
    (!filters.saved || event.schools.some(school => filters.saved!.includes(school.id)))
  );
}
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

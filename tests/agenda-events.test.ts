import test from 'node:test';
import assert from 'node:assert/strict';
import { collectAgendaEvents, filterAgendaEvents } from '../src/lib/agenda-events.ts';
import { makeCalendar } from '../src/lib/calendar.ts';

const service = (id: string, stage: 'nursery' | 'preschool', location = 'Via Milano 15, Milano', source = 'https://campus.example.it/open-day') => ({
  id, name: id, slug: id, address: 'Via Milano 15', municipality: 1, management: 'Privata' as const, educationStage: stage,
  events: [{ id: id + '-visit', date: '2026-12-10', time: '12:00–14:00', location, source }],
});
test('a shared nursery/preschool visit keeps both associations and exports only once', () => {
  const events = collectAgendaEvents([service('infanzia', 'preschool'), service('nido', 'nursery')]);
  assert.equal(events.length, 1);
  assert.deepEqual(events[0].schools.map(s => s.id), ['infanzia', 'nido']);
  assert.equal(events[0].id, 'infanzia-visit');
  assert.equal(events.filter(e => e.schools.some(s => s.id === 'nido')).length, 1);
  const calendar = makeCalendar(events, new Date('2026-11-16T12:00:00Z'));
  assert.equal((calendar.match(/BEGIN:VEVENT/g) || []).length, 1);
  assert.match(calendar, /infanzia \/ nido/);
});
test('simultaneous visits at different sites or with different sources stay distinct', () => {
  assert.equal(collectAgendaEvents([service('a', 'nursery'), service('b', 'nursery', 'Via Roma 2, Milano')]).length, 2);
  assert.equal(collectAgendaEvents([service('a', 'nursery'), service('b', 'nursery', undefined, 'https://other.example.it/open-day')]).length, 2);
});
test('age filters include shared visits once and exclude the other age in both list and calendar', () => {
  const events=collectAgendaEvents([
    service('shared-preschool','preschool'),service('shared-nursery','nursery'),
    service('nursery-only','nursery','Via Esempio 2'),service('preschool-only','preschool','Via Esempio 3'),
  ]);
  for(const stage of ['nursery','preschool'] as const){
    const filtered=filterAgendaEvents(events,{today:'2026-11-17',stage});
    assert.equal(filtered.length,2);
    assert.ok(filtered.every(event=>event.schools.some(school=>school.educationStage===stage)));
    const calendar=makeCalendar(filtered);
    assert.equal((calendar.match(/BEGIN:VEVENT/g)||[]).length,2);
    assert.ok(!calendar.includes(stage==='nursery'?'preschool-only':'nursery-only'));
  }
  assert.equal(filterAgendaEvents(events,{today:'2026-11-17'}).length,3);
});
test('age combines with month, municipality, saved visits and past-event filters', () => {
  const events=collectAgendaEvents([service('preschool','preschool'),service('nursery','nursery')]);
  const filters={today:'2026-11-17',stage:'nursery' as const,month:'2026-12',municipality:1,saved:['nursery']};
  assert.equal(filterAgendaEvents(events,filters).length,1);
  for(const extra of [{stage:'preschool' as const,saved:[]},{month:'2027-01'},{municipality:2},{today:'2027-01-01'}])assert.equal(filterAgendaEvents(events,{...filters,...extra}).length,0);
  assert.equal(filterAgendaEvents(events,{...filters,today:'2027-01-01',includePast:true}).length,1);
});

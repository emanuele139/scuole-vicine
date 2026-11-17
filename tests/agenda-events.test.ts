import test from 'node:test';
import assert from 'node:assert/strict';
import { collectAgendaEvents } from '../src/lib/agenda-events.ts';
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

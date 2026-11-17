import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeCalendar, toUTC } from '../src/lib/calendar.ts';

test('calendar uses the Rome offset for winter and summer dates', () => {
  assert.equal(toUTC('2026-11-23','17:00'),'20261123T160000Z');
  assert.equal(toUTC('2027-05-23','17:00'),'20270523T150000Z');
});
test('calendar escapes notes, folds UTF-8 lines and exports stable event identity', () => {
  const school={name:'Scuola à '.repeat(20),address:'Via Milano, 3'} as any;
  const text=makeCalendar([{id:'mi-test-2026-11-23',date:'2026-11-23',time:'17:00–18:00',source:'https://example.com/evento',booking:'Prenotazione; sì\nSolo adulti',school}],new Date('2026-11-16T15:00:00Z'));
  assert.match(text,/DTSTART:20261123T160000Z/);
  assert.match(text,/DTEND:20261123T170000Z/);
  assert.match(text,/UID:mi-test-2026-11-23@scuole-milano/);
  assert.match(text,/Prenotazione\\; sì\\nSolo adulti/);
  assert.ok(text.split('\r\n').every(line=>new TextEncoder().encode(line).length<=75));
});

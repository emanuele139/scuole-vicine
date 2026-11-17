import type { School, SchoolEvent } from './catalog';
type CalendarEvent = SchoolEvent & { school: Pick<School, 'name' | 'address'> };
const escapeICS = (value: string) => value.replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
export function toUTC(date:string,time:string) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^\d{2}:\d{2}$/.test(time))throw new Error('Data o ora non valida');
  const initial=new Date(`${date}T${time}:00Z`);
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Europe/Rome',timeZoneName:'shortOffset'}).formatToParts(initial);
  const zone=parts.find(p=>p.type==='timeZoneName')?.value||'GMT+1';
  const offset=zone.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  const minutes=offset?(offset[1]==='-'?-1:1)*(Number(offset[2])*60+Number(offset[3]||0)):0;
  return new Date(initial.getTime()-minutes*60000).toISOString().replace(/[-:]/g,'').replace('.000','');
}
export function makeCalendar(events:CalendarEvent[],now=new Date()) {
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Scuole Vicine//Open day//IT','CALSCALE:GREGORIAN','METHOD:PUBLISH'];
  for(const event of events){const times=event.time.match(/\d{1,2}:\d{2}/g);if(!times?.length)continue;const start=times[0].padStart(5,'0');lines.push('BEGIN:VEVENT',`UID:${event.id}@scuole-milano`,`DTSTAMP:${now.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'')}`,`DTSTART:${toUTC(event.date,start)}`);if(times[1])lines.push(`DTEND:${toUTC(event.date,times[1].padStart(5,'0'))}`);lines.push(`SUMMARY:${escapeICS('Open day · '+event.school.name)}`,`LOCATION:${escapeICS(event.location||event.school.address+', Milano')}`,`DESCRIPTION:${escapeICS((event.booking||'Consulta l’avviso ufficiale per sapere come partecipare.')+'\nFonte: '+event.source)}`,`URL:${event.source}`,'END:VEVENT');}
  lines.push('END:VCALENDAR');
  const encoder=new TextEncoder();
  const fold=(line:string)=>{let output='',part='',length=0;for(const char of line){const bytes=encoder.encode(char).length;if(length+bytes>75){output+=part+'\r\n';part=' ';length=1;}part+=char;length+=bytes;}return output+part;};
  return lines.map(fold).join('\r\n')+'\r\n';
}
export function downloadCalendar(events:CalendarEvent[]) {
  const url=URL.createObjectURL(new Blob([makeCalendar(events)],{type:'text/calendar;charset=utf-8'}));
  const anchor=document.createElement('a');anchor.href=url;anchor.download='open-day-scuole-vicine.ics';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

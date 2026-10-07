import type { Meeting } from '../../../shared/contracts';

const stamp = (iso: string) => iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const esc = (s: string) => s.replace(/[\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');

/** Calendar file with every meeting of the group (times in UTC, the phone shows them in local time). No class link inside: entry is only through the app. */
export function downloadIcs(name: string, title: string, note: string, meetings: Pick<Meeting, 'id' | 'start' | 'end'>[]) {
  const now = stamp(new Date().toISOString());
  const events = meetings.map((m) => [
    'BEGIN:VEVENT', `UID:${m.id}@hazluno`, `DTSTAMP:${now}`, `DTSTART:${stamp(m.start)}`, `DTEND:${stamp(m.end)}`,
    `SUMMARY:${esc(title)}`, `DESCRIPTION:${esc(note)}`, 'END:VEVENT',
  ].join('\r\n'));
  const body = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Hazluno//ES', 'CALSCALE:GREGORIAN', ...events, 'END:VCALENDAR'].join('\r\n');
  const url = URL.createObjectURL(new Blob([body], { type: 'text/calendar;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = `${name}.ics`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

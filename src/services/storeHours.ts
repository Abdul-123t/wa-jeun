import type { PublicVendorBusiness } from './api';

const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
type HoursEntry = { open: string; close: string; closed: boolean };

function validHours(value: unknown): value is Record<string, HoursEntry> {
  if (!value || typeof value !== 'object') return false;
  return dayNames.every(day => {
    const entry = (value as Record<string, HoursEntry>)[day];
    return Boolean(entry && typeof entry.closed === 'boolean' && (entry.closed ||
      (/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(entry.open) && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(entry.close) && entry.open < entry.close)));
  });
}

function getLagosClock(date: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Lagos', weekday: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return { day: values.weekday.toLocaleLowerCase(), time: `${values.hour}:${values.minute}` };
}

export function getPublicStoreAvailability(vendor: Pick<PublicVendorBusiness, 'accepting_orders' | 'opening_hours'>, now = new Date()) {
  if (!vendor.accepting_orders) return { open: false, label: 'Temporarily not accepting orders' };
  if (!validHours(vendor.opening_hours)) return { open: false, label: 'Opening hours unavailable' };

  const { day, time } = getLagosClock(now);
  const todayIndex = dayNames.indexOf(day);
  const todayHours = vendor.opening_hours[day];
  if (!todayHours.closed && time >= todayHours.open && time < todayHours.close) {
    return { open: true, label: `Open now · closes ${todayHours.close}` };
  }

  for (let offset = 0; offset < 7; offset += 1) {
    const nextDay = dayNames[(todayIndex + offset) % 7];
    const hours = vendor.opening_hours[nextDay];
    if (!hours.closed && (offset > 0 || time < hours.open)) {
      const dayLabel = offset === 0 ? 'today' : offset === 1 ? 'tomorrow' : nextDay;
      return { open: false, label: `Closed now · opens ${dayLabel} at ${hours.open}` };
    }
  }
  return { open: false, label: 'Closed today · check weekly hours' };
}


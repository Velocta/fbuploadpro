/**
 * Global Timezone Registry & Formatting Helpers
 *
 * Provides a structured collection of world timezones grouped by geographical region,
 * complete with city names, countries, and dynamic UTC offsets.
 */

export interface TimezoneEntry {
  iana: string;
  city: string;
  country: string;
  region: 'Americas' | 'Europe' | 'Asia' | 'Pacific' | 'Africa' | 'Global';
  label: string;
}

type RawTzTuple = readonly [
  iana: string,
  city: string,
  country: string,
  region: TimezoneEntry['region'],
  label: string,
];

const RAW_TIMEZONES: readonly RawTzTuple[] = [
  ['UTC', 'Coordinated Universal Time', 'Universal', 'Global', 'UTC (Universal Coordinated Time)'],
  ['America/New_York', 'New York', 'United States', 'Americas', 'New York (US Eastern)'],
  ['America/Chicago', 'Chicago', 'United States', 'Americas', 'Chicago (US Central)'],
  ['America/Denver', 'Denver', 'United States', 'Americas', 'Denver (US Mountain)'],
  ['America/Los_Angeles', 'Los Angeles', 'United States', 'Americas', 'Los Angeles (US Pacific)'],
  ['America/Anchorage', 'Anchorage', 'United States', 'Americas', 'Anchorage (Alaska)'],
  ['Pacific/Honolulu', 'Honolulu', 'United States', 'Americas', 'Honolulu (Hawaii)'],
  ['America/Toronto', 'Toronto', 'Canada', 'Americas', 'Toronto (Eastern Canada)'],
  ['America/Vancouver', 'Vancouver', 'Canada', 'Americas', 'Vancouver (Pacific Canada)'],
  ['America/Mexico_City', 'Mexico City', 'Mexico', 'Americas', 'Mexico City (Central Mexico)'],
  ['America/Bogota', 'Bogota', 'Colombia', 'Americas', 'Bogota (Colombia, Peru, Ecuador)'],
  ['America/Sao_Paulo', 'Sao Paulo', 'Brazil', 'Americas', 'Sao Paulo (Brazil Standard)'],
  ['America/Buenos_Aires', 'Buenos Aires', 'Argentina', 'Americas', 'Buenos Aires (Argentina)'],
  ['America/Santiago', 'Santiago', 'Chile', 'Americas', 'Santiago (Chile)'],
  ['Europe/London', 'London', 'United Kingdom', 'Europe', 'London (GMT / British Summer Time)'],
  ['Europe/Dublin', 'Dublin', 'Ireland', 'Europe', 'Dublin (Irish Standard Time)'],
  ['Europe/Paris', 'Paris', 'France', 'Europe', 'Paris (Central European Time)'],
  ['Europe/Berlin', 'Berlin', 'Germany', 'Europe', 'Berlin (Germany)'],
  ['Europe/Madrid', 'Madrid', 'Spain', 'Europe', 'Madrid (Spain)'],
  ['Europe/Rome', 'Rome', 'Italy', 'Europe', 'Rome (Italy)'],
  ['Europe/Amsterdam', 'Amsterdam', 'Netherlands', 'Europe', 'Amsterdam (Netherlands)'],
  ['Europe/Stockholm', 'Stockholm', 'Sweden', 'Europe', 'Stockholm (Sweden, Norway)'],
  ['Europe/Athens', 'Athens', 'Greece', 'Europe', 'Athens (Eastern European Time)'],
  ['Europe/Istanbul', 'Istanbul', 'Turkey', 'Europe', 'Istanbul (Turkey Time)'],
  ['Europe/Warsaw', 'Warsaw', 'Poland', 'Europe', 'Warsaw (Poland)'],
  ['Europe/Bucharest', 'Bucharest', 'Romania', 'Europe', 'Bucharest (Romania)'],
  ['Europe/Kiev', 'Kyiv', 'Ukraine', 'Europe', 'Kyiv (Ukraine)'],
  ['Asia/Karachi', 'Karachi / Islamabad', 'Pakistan', 'Asia', 'Karachi / Islamabad (Pakistan Standard Time)'],
  ['Asia/Dubai', 'Dubai / Abu Dhabi', 'United Arab Emirates', 'Asia', 'Dubai / Abu Dhabi (Gulf Standard Time)'],
  ['Asia/Riyadh', 'Riyadh', 'Saudi Arabia', 'Asia', 'Riyadh (Arabia Standard Time)'],
  ['Asia/Kolkata', 'Mumbai / Delhi / Kolkata', 'India', 'Asia', 'Mumbai / Delhi (India Standard Time)'],
  ['Asia/Dhaka', 'Dhaka', 'Bangladesh', 'Asia', 'Dhaka (Bangladesh Standard Time)'],
  ['Asia/Bangkok', 'Bangkok / Jakarta', 'Thailand', 'Asia', 'Bangkok / Jakarta (Indochina Time)'],
  ['Asia/Singapore', 'Singapore', 'Singapore', 'Asia', 'Singapore (Singapore Standard Time)'],
  ['Asia/Hong_Kong', 'Hong Kong', 'Hong Kong', 'Asia', 'Hong Kong (Hong Kong Time)'],
  ['Asia/Shanghai', 'Beijing / Shanghai', 'China', 'Asia', 'Beijing / Shanghai (China Standard Time)'],
  ['Asia/Tokyo', 'Tokyo', 'Japan', 'Asia', 'Tokyo (Japan Standard Time)'],
  ['Asia/Seoul', 'Seoul', 'South Korea', 'Asia', 'Seoul (Korea Standard Time)'],
  ['Asia/Manila', 'Manila', 'Philippines', 'Asia', 'Manila (Philippine Standard Time)'],
  ['Asia/Kuala_Lumpur', 'Kuala Lumpur', 'Malaysia', 'Asia', 'Kuala Lumpur (Malaysia Time)'],
  ['Australia/Sydney', 'Sydney / Melbourne', 'Australia', 'Pacific', 'Sydney / Melbourne (Eastern Australia)'],
  ['Australia/Brisbane', 'Brisbane', 'Australia', 'Pacific', 'Brisbane (Queensland, no DST)'],
  ['Australia/Adelaide', 'Adelaide', 'Australia', 'Pacific', 'Adelaide (Central Australia)'],
  ['Australia/Perth', 'Perth', 'Australia', 'Pacific', 'Perth (Western Australia)'],
  ['Pacific/Auckland', 'Auckland / Wellington', 'New Zealand', 'Pacific', 'Auckland / Wellington (New Zealand)'],
  ['Pacific/Fiji', 'Suva', 'Fiji', 'Pacific', 'Fiji (Fiji Time)'],
  ['Africa/Cairo', 'Cairo', 'Egypt', 'Africa', 'Cairo (Eastern Africa)'],
  ['Africa/Johannesburg', 'Johannesburg', 'South Africa', 'Africa', 'Johannesburg (South Africa Standard Time)'],
  ['Africa/Lagos', 'Lagos', 'Nigeria', 'Africa', 'Lagos (West Africa Time)'],
  ['Africa/Nairobi', 'Nairobi', 'Kenya', 'Africa', 'Nairobi (East Africa Time)'],
  ['Africa/Casablanca', 'Casablanca', 'Morocco', 'Africa', 'Casablanca (Morocco Time)'],
];

export const TIMEZONE_REGISTRY: TimezoneEntry[] = RAW_TIMEZONES.map(
  ([iana, city, country, region, label]) => ({
    iana,
    city,
    country,
    region,
    label,
  })
);

export const REGION_ORDER: Array<TimezoneEntry['region']> = [
  'Americas',
  'Europe',
  'Asia',
  'Pacific',
  'Africa',
  'Global',
];

export const REGION_LABELS: Record<TimezoneEntry['region'], string> = {
  Americas: 'Americas & Caribbean',
  Europe: 'Europe',
  Asia: 'Asia & Middle East',
  Pacific: 'Australia & Pacific',
  Africa: 'Africa',
  Global: 'Universal',
};

/**
 * Returns formatted UTC offset string (e.g. "UTC+05:00", "UTC-04:00", "UTC+00:00")
 * for a given IANA timezone name.
 */
export function getTimezoneUtcOffset(iana: string, date: Date = new Date()): string {
  if (iana === 'UTC') {
    return 'UTC+00:00';
  }

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: iana,
      timeZoneName: 'longOffset',
    });
    const parts = formatter.formatToParts(date);
    const tzPart = parts.find((p) => p.type === 'timeZoneName');
    if (tzPart?.value) {
      // Typically returns "GMT+05:00" or "GMT-04:00"
      return tzPart.value.replace('GMT', 'UTC');
    }
  } catch (_e) {
    // Fallback if IANA timezone is invalid or unsupported
  }

  return 'UTC';
}

/**
 * Returns current formatted local time for an IANA timezone (e.g. "04:30 PM").
 */
export function getTimezoneCurrentTime(iana: string, date: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: iana,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  } catch (_e) {
    return '';
  }
}

/**
 * Finds a timezone entry in the registry or synthesizes a fallback entry.
 */
export function findTimezoneEntry(iana: string): TimezoneEntry {
  const match = TIMEZONE_REGISTRY.find((tz) => tz.iana === iana);
  if (match) {
    return match;
  }

  // Synthesize entry from IANA string (e.g. "Asia/Karachi" -> City: "Karachi", Region: "Asia")
  const parts = iana.split('/');
  const rawRegion = parts[0] || 'Global';
  const rawCity = (parts[1] || iana).replaceAll('_', ' ');

  let resolvedRegion: TimezoneEntry['region'] = 'Global';
  if (rawRegion === 'America') resolvedRegion = 'Americas';
  else if (rawRegion === 'Europe') resolvedRegion = 'Europe';
  else if (rawRegion === 'Asia') resolvedRegion = 'Asia';
  else if (rawRegion === 'Pacific' || rawRegion === 'Australia') resolvedRegion = 'Pacific';
  else if (rawRegion === 'Africa') resolvedRegion = 'Africa';

  return {
    iana,
    city: rawCity,
    country: rawRegion,
    region: resolvedRegion,
    label: `${rawCity} (${iana})`,
  };
}

/**
 * Filters the timezone registry by search query and groups results by region.
 */
export function searchAndGroupTimezones(
  query: string,
  now: Date = new Date()
): Record<TimezoneEntry['region'], Array<TimezoneEntry & { offset: string; currentTime: string }>> {
  const normalized = query.trim().toLowerCase();

  const filtered = TIMEZONE_REGISTRY.filter((entry) => {
    if (!normalized) return true;
    return (
      entry.city.toLowerCase().includes(normalized) ||
      entry.country.toLowerCase().includes(normalized) ||
      entry.label.toLowerCase().includes(normalized) ||
      entry.iana.toLowerCase().includes(normalized) ||
      entry.region.toLowerCase().includes(normalized)
    );
  });

  const grouped: Record<
    TimezoneEntry['region'],
    Array<TimezoneEntry & { offset: string; currentTime: string }>
  > = {
    Americas: [],
    Europe: [],
    Asia: [],
    Pacific: [],
    Africa: [],
    Global: [],
  };

  for (const entry of filtered) {
    const offset = getTimezoneUtcOffset(entry.iana, now);
    const currentTime = getTimezoneCurrentTime(entry.iana, now);
    grouped[entry.region].push({
      ...entry,
      offset,
      currentTime,
    });
  }

  return grouped;
}

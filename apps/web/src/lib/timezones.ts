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

export const TIMEZONE_REGISTRY: TimezoneEntry[] = [
  // Global
  {
    iana: 'UTC',
    city: 'Coordinated Universal Time',
    country: 'Universal',
    region: 'Global',
    label: 'UTC (Universal Coordinated Time)',
  },

  // Americas
  {
    iana: 'America/New_York',
    city: 'New York',
    country: 'United States',
    region: 'Americas',
    label: 'New York (US Eastern)',
  },
  {
    iana: 'America/Chicago',
    city: 'Chicago',
    country: 'United States',
    region: 'Americas',
    label: 'Chicago (US Central)',
  },
  {
    iana: 'America/Denver',
    city: 'Denver',
    country: 'United States',
    region: 'Americas',
    label: 'Denver (US Mountain)',
  },
  {
    iana: 'America/Los_Angeles',
    city: 'Los Angeles',
    country: 'United States',
    region: 'Americas',
    label: 'Los Angeles (US Pacific)',
  },
  {
    iana: 'America/Anchorage',
    city: 'Anchorage',
    country: 'United States',
    region: 'Americas',
    label: 'Anchorage (Alaska)',
  },
  {
    iana: 'Pacific/Honolulu',
    city: 'Honolulu',
    country: 'United States',
    region: 'Americas',
    label: 'Honolulu (Hawaii)',
  },
  {
    iana: 'America/Toronto',
    city: 'Toronto',
    country: 'Canada',
    region: 'Americas',
    label: 'Toronto (Eastern Canada)',
  },
  {
    iana: 'America/Vancouver',
    city: 'Vancouver',
    country: 'Canada',
    region: 'Americas',
    label: 'Vancouver (Pacific Canada)',
  },
  {
    iana: 'America/Mexico_City',
    city: 'Mexico City',
    country: 'Mexico',
    region: 'Americas',
    label: 'Mexico City (Central Mexico)',
  },
  {
    iana: 'America/Bogota',
    city: 'Bogota',
    country: 'Colombia',
    region: 'Americas',
    label: 'Bogota (Colombia, Peru, Ecuador)',
  },
  {
    iana: 'America/Sao_Paulo',
    city: 'Sao Paulo',
    country: 'Brazil',
    region: 'Americas',
    label: 'Sao Paulo (Brazil Standard)',
  },
  {
    iana: 'America/Buenos_Aires',
    city: 'Buenos Aires',
    country: 'Argentina',
    region: 'Americas',
    label: 'Buenos Aires (Argentina)',
  },
  {
    iana: 'America/Santiago',
    city: 'Santiago',
    country: 'Chile',
    region: 'Americas',
    label: 'Santiago (Chile)',
  },

  // Europe
  {
    iana: 'Europe/London',
    city: 'London',
    country: 'United Kingdom',
    region: 'Europe',
    label: 'London (GMT / British Summer Time)',
  },
  {
    iana: 'Europe/Dublin',
    city: 'Dublin',
    country: 'Ireland',
    region: 'Europe',
    label: 'Dublin (Irish Standard Time)',
  },
  {
    iana: 'Europe/Paris',
    city: 'Paris',
    country: 'France',
    region: 'Europe',
    label: 'Paris (Central European Time)',
  },
  {
    iana: 'Europe/Berlin',
    city: 'Berlin',
    country: 'Germany',
    region: 'Europe',
    label: 'Berlin (Germany)',
  },
  {
    iana: 'Europe/Madrid',
    city: 'Madrid',
    country: 'Spain',
    region: 'Europe',
    label: 'Madrid (Spain)',
  },
  {
    iana: 'Europe/Rome',
    city: 'Rome',
    country: 'Italy',
    region: 'Europe',
    label: 'Rome (Italy)',
  },
  {
    iana: 'Europe/Amsterdam',
    city: 'Amsterdam',
    country: 'Netherlands',
    region: 'Europe',
    label: 'Amsterdam (Netherlands)',
  },
  {
    iana: 'Europe/Stockholm',
    city: 'Stockholm',
    country: 'Sweden',
    region: 'Europe',
    label: 'Stockholm (Sweden, Norway)',
  },
  {
    iana: 'Europe/Athens',
    city: 'Athens',
    country: 'Greece',
    region: 'Europe',
    label: 'Athens (Eastern European Time)',
  },
  {
    iana: 'Europe/Istanbul',
    city: 'Istanbul',
    country: 'Turkey',
    region: 'Europe',
    label: 'Istanbul (Turkey Time)',
  },
  {
    iana: 'Europe/Warsaw',
    city: 'Warsaw',
    country: 'Poland',
    region: 'Europe',
    label: 'Warsaw (Poland)',
  },
  {
    iana: 'Europe/Bucharest',
    city: 'Bucharest',
    country: 'Romania',
    region: 'Europe',
    label: 'Bucharest (Romania)',
  },
  {
    iana: 'Europe/Kiev',
    city: 'Kyiv',
    country: 'Ukraine',
    region: 'Europe',
    label: 'Kyiv (Ukraine)',
  },

  // Asia & Middle East
  {
    iana: 'Asia/Karachi',
    city: 'Karachi / Islamabad',
    country: 'Pakistan',
    region: 'Asia',
    label: 'Karachi / Islamabad (Pakistan Standard Time)',
  },
  {
    iana: 'Asia/Dubai',
    city: 'Dubai / Abu Dhabi',
    country: 'United Arab Emirates',
    region: 'Asia',
    label: 'Dubai / Abu Dhabi (Gulf Standard Time)',
  },
  {
    iana: 'Asia/Riyadh',
    city: 'Riyadh',
    country: 'Saudi Arabia',
    region: 'Asia',
    label: 'Riyadh (Arabia Standard Time)',
  },
  {
    iana: 'Asia/Kolkata',
    city: 'Mumbai / Delhi / Kolkata',
    country: 'India',
    region: 'Asia',
    label: 'Mumbai / Delhi (India Standard Time)',
  },
  {
    iana: 'Asia/Dhaka',
    city: 'Dhaka',
    country: 'Bangladesh',
    region: 'Asia',
    label: 'Dhaka (Bangladesh Standard Time)',
  },
  {
    iana: 'Asia/Bangkok',
    city: 'Bangkok / Jakarta',
    country: 'Thailand',
    region: 'Asia',
    label: 'Bangkok / Jakarta (Indochina Time)',
  },
  {
    iana: 'Asia/Singapore',
    city: 'Singapore',
    country: 'Singapore',
    region: 'Asia',
    label: 'Singapore (Singapore Standard Time)',
  },
  {
    iana: 'Asia/Hong_Kong',
    city: 'Hong Kong',
    country: 'Hong Kong',
    region: 'Asia',
    label: 'Hong Kong (Hong Kong Time)',
  },
  {
    iana: 'Asia/Shanghai',
    city: 'Beijing / Shanghai',
    country: 'China',
    region: 'Asia',
    label: 'Beijing / Shanghai (China Standard Time)',
  },
  {
    iana: 'Asia/Tokyo',
    city: 'Tokyo',
    country: 'Japan',
    region: 'Asia',
    label: 'Tokyo (Japan Standard Time)',
  },
  {
    iana: 'Asia/Seoul',
    city: 'Seoul',
    country: 'South Korea',
    region: 'Asia',
    label: 'Seoul (Korea Standard Time)',
  },
  {
    iana: 'Asia/Manila',
    city: 'Manila',
    country: 'Philippines',
    region: 'Asia',
    label: 'Manila (Philippine Standard Time)',
  },
  {
    iana: 'Asia/Kuala_Lumpur',
    city: 'Kuala Lumpur',
    country: 'Malaysia',
    region: 'Asia',
    label: 'Kuala Lumpur (Malaysia Time)',
  },

  // Australia & Pacific
  {
    iana: 'Australia/Sydney',
    city: 'Sydney / Melbourne',
    country: 'Australia',
    region: 'Pacific',
    label: 'Sydney / Melbourne (Eastern Australia)',
  },
  {
    iana: 'Australia/Brisbane',
    city: 'Brisbane',
    country: 'Australia',
    region: 'Pacific',
    label: 'Brisbane (Queensland, no DST)',
  },
  {
    iana: 'Australia/Adelaide',
    city: 'Adelaide',
    country: 'Australia',
    region: 'Pacific',
    label: 'Adelaide (Central Australia)',
  },
  {
    iana: 'Australia/Perth',
    city: 'Perth',
    country: 'Australia',
    region: 'Pacific',
    label: 'Perth (Western Australia)',
  },
  {
    iana: 'Pacific/Auckland',
    city: 'Auckland / Wellington',
    country: 'New Zealand',
    region: 'Pacific',
    label: 'Auckland / Wellington (New Zealand)',
  },
  {
    iana: 'Pacific/Fiji',
    city: 'Suva',
    country: 'Fiji',
    region: 'Pacific',
    label: 'Fiji (Fiji Time)',
  },

  // Africa
  {
    iana: 'Africa/Cairo',
    city: 'Cairo',
    country: 'Egypt',
    region: 'Africa',
    label: 'Cairo (Eastern Africa)',
  },
  {
    iana: 'Africa/Johannesburg',
    city: 'Johannesburg',
    country: 'South Africa',
    region: 'Africa',
    label: 'Johannesburg (South Africa Standard Time)',
  },
  {
    iana: 'Africa/Lagos',
    city: 'Lagos',
    country: 'Nigeria',
    region: 'Africa',
    label: 'Lagos (West Africa Time)',
  },
  {
    iana: 'Africa/Nairobi',
    city: 'Nairobi',
    country: 'Kenya',
    region: 'Africa',
    label: 'Nairobi (East Africa Time)',
  },
  {
    iana: 'Africa/Casablanca',
    city: 'Casablanca',
    country: 'Morocco',
    region: 'Africa',
    label: 'Casablanca (Morocco Time)',
  },
];

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
    if (tzPart && tzPart.value) {
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
  const rawCity = (parts[1] || iana).replace(/_/g, ' ');

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

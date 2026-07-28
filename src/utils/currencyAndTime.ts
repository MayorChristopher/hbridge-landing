// Currency + timezone helpers for international patients booking Nigerian
// doctors (from the practitioner feedback meeting: "consider currency
// conversion for international patients and fair compensation for doctors
// consulting across different time zones"). Deliberately dependency-free —
// uses the built-in Intl API (already available via Hermes) rather than
// adding expo-localization, so this doesn't add to the native-rebuild
// already required for the Jitsi SDK work.

const NIGERIA_TIMEZONE = 'Africa/Lagos';

/** The device's current IANA timezone, e.g. "America/New_York". */
export function getDeviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || NIGERIA_TIMEZONE;
  } catch {
    return NIGERIA_TIMEZONE;
  }
}

/** True if the device's timezone isn't a Nigerian one — i.e. likely an international patient. */
export function isLikelyInternational(): boolean {
  return getDeviceTimezone() !== NIGERIA_TIMEZONE;
}

/**
 * Formats a UTC ISO timestamp in a given IANA timezone, e.g.
 * "Jun 15, 2:00 PM" — used to show the same appointment in both the
 * patient's and the doctor's local time when they differ.
 */
export function formatInTimezone(iso: string, timeZone: string): string {
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone,
    });
  } catch {
    return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
}

/** Short display label for a timezone, e.g. "GMT+1" or "EST". */
export function timezoneAbbrev(timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' }).formatToParts(new Date());
    return parts.find(p => p.type === 'timeZoneName')?.value ?? timeZone;
  } catch {
    return timeZone;
  }
}

/**
 * Renders both the doctor's (Nigeria) and the patient's local time for an
 * appointment, only showing the second line when they actually differ —
 * avoids clutter for the common case of a Nigerian patient booking locally.
 */
export function appointmentTimeLines(iso: string): { doctorLine: string; patientLine: string | null } {
  const deviceTz = getDeviceTimezone();
  const doctorLine = `${formatInTimezone(iso, NIGERIA_TIMEZONE)} (${timezoneAbbrev(NIGERIA_TIMEZONE)})`;
  if (deviceTz === NIGERIA_TIMEZONE) return { doctorLine, patientLine: null };
  const patientLine = `${formatInTimezone(iso, deviceTz)} (${timezoneAbbrev(deviceTz)}) — your time`;
  return { doctorLine, patientLine };
}

// ── Currency conversion (display only — actual charges still process in NGN
// via Paystack; this is informational so international patients understand
// the fee before paying) ──────────────────────────────────────────────────

let cachedRates: { rates: Record<string, number>; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

async function getRatesFromNGN(): Promise<Record<string, number> | null> {
  if (cachedRates && Date.now() - cachedRates.fetchedAt < CACHE_TTL_MS) return cachedRates.rates;
  try {
    // Free, no API key required.
    const res = await fetch('https://open.er-api.com/v6/latest/NGN');
    const json = await res.json();
    if (json?.result !== 'success' || !json.rates) return null;
    cachedRates = { rates: json.rates, fetchedAt: Date.now() };
    return json.rates;
  } catch {
    return null;
  }
}

/** Best-guess currency code from the device locale's region, defaulting to USD. */
export function guessDeviceCurrency(): string {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    const region = new Intl.Locale(locale).maximize().region;
    const REGION_CURRENCY: Record<string, string> = {
      US: 'USD', GB: 'GBP', CA: 'CAD', AU: 'AUD', DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR',
      NL: 'EUR', IE: 'EUR', ZA: 'ZAR', GH: 'GHS', KE: 'KES', IN: 'INR', AE: 'AED',
    };
    return (region && REGION_CURRENCY[region]) || 'USD';
  } catch {
    return 'USD';
  }
}

/**
 * Converts a NGN amount to the device's likely local currency and returns a
 * formatted "≈ $12.34" string, or null if rates aren't available (caller
 * should just show the NGN price alone in that case — never block on this).
 */
export async function approxLocalPrice(ngnAmount: number): Promise<string | null> {
  if (!isLikelyInternational() || !ngnAmount) return null;
  const currency = guessDeviceCurrency();
  const rates = await getRatesFromNGN();
  const rate = rates?.[currency];
  if (!rate) return null;
  try {
    const converted = ngnAmount * rate;
    return `≈ ${new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(converted)}`;
  } catch {
    return null;
  }
}

import { suspectVpn } from './policy.js';

export interface IpIntel {
  ip: string;
  country?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  org?: string;
  hosting?: boolean;
  proxy?: boolean;
  vpnSuspected: boolean;
}

/**
 * Best-effort IP intelligence. Uses ip-api.com in non-private contexts;
 * fails soft for local/dev IPs.
 */
export async function lookupIpIntel(ip: string): Promise<IpIntel> {
  const normalized = ip.replace(/^::ffff:/, '');
  const base: IpIntel = { ip: normalized, vpnSuspected: false };

  if (
    !normalized ||
    normalized === '127.0.0.1' ||
    normalized === '::1' ||
    normalized.startsWith('10.') ||
    normalized.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized)
  ) {
    return { ...base, city: 'Local', country: 'XX', vpnSuspected: false };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(normalized)}?fields=status,countryCode,regionName,city,lat,lon,org,proxy,hosting,query`,
      { signal: controller.signal },
    );
    clearTimeout(timer);
    if (!res.ok) return base;
    const data = (await res.json()) as {
      status?: string;
      countryCode?: string;
      regionName?: string;
      city?: string;
      lat?: number;
      lon?: number;
      org?: string;
      proxy?: boolean;
      hosting?: boolean;
      query?: string;
    };
    if (data.status !== 'success') return base;
    const intel: IpIntel = {
      ip: data.query ?? normalized,
      country: data.countryCode,
      region: data.regionName,
      city: data.city,
      latitude: data.lat,
      longitude: data.lon,
      org: data.org,
      hosting: data.hosting,
      proxy: data.proxy,
      vpnSuspected: false,
    };
    intel.vpnSuspected = suspectVpn(intel);
    return intel;
  } catch {
    return base;
  }
}

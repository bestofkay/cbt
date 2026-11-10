export interface ProctoringPolicy {
  webcam: boolean;
  faceDetection: boolean;
  multiFace: boolean;
  microphone: boolean;
  voiceDetection: boolean;
  screenShare: boolean;
  screenShareRequired: boolean;
  geolocation: boolean;
  vpnCheck: boolean;
  requireConsent: boolean;
}

const FULL: ProctoringPolicy = {
  webcam: true,
  faceDetection: true,
  multiFace: true,
  microphone: true,
  voiceDetection: true,
  screenShare: true,
  screenShareRequired: true,
  geolocation: true,
  vpnCheck: true,
  requireConsent: true,
};

const LIGHT: ProctoringPolicy = {
  webcam: false,
  faceDetection: false,
  multiFace: false,
  microphone: false,
  voiceDetection: false,
  screenShare: false,
  screenShareRequired: false,
  geolocation: false,
  vpnCheck: true,
  requireConsent: false,
};

export function resolveProctoringPolicy(
  mode: string,
  settings: unknown,
): ProctoringPolicy {
  const base = mode === 'PRACTICE' || mode === 'MOCK' ? { ...LIGHT } : { ...FULL };
  const nested =
    settings &&
    typeof settings === 'object' &&
    settings !== null &&
    'proctoring' in settings
      ? (settings as { proctoring?: Partial<ProctoringPolicy> }).proctoring
      : undefined;
  if (!nested || typeof nested !== 'object') return base;
  return { ...base, ...nested };
}

/** Heuristic VPN / hosting detection from IP + optional ASN metadata */
export function suspectVpn(input: {
  ip: string;
  org?: string | null;
  hosting?: boolean | null;
  proxy?: boolean | null;
}): boolean {
  if (input.hosting || input.proxy) return true;
  const org = (input.org ?? '').toLowerCase();
  const vpnHints = [
    'vpn',
    'proxy',
    'hosting',
    'datacenter',
    'digitalocean',
    'amazon',
    'aws',
    'google cloud',
    'microsoft azure',
    'ovh',
    'hetzner',
    'linode',
    'cloudflare',
    'vultr',
  ];
  if (vpnHints.some((h) => org.includes(h))) return true;
  if (
    input.ip === '127.0.0.1' ||
    input.ip === '::1' ||
    input.ip.startsWith('10.') ||
    input.ip.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(input.ip)
  ) {
    return false;
  }
  return false;
}

export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

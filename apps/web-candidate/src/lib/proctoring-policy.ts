export type ProctorEventType =
  | 'FULLSCREEN_EXIT'
  | 'TAB_SWITCH'
  | 'CLIPBOARD_COPY'
  | 'CLIPBOARD_PASTE'
  | 'RIGHT_CLICK'
  | 'FOCUS_LOST'
  | 'FOCUS_GAINED'
  | 'FACE_MISSING'
  | 'MULTIPLE_FACES'
  | 'VOICE_DETECTED'
  | 'SCREEN_CAPTURE'
  | 'RECONNECT'
  | 'LOCATION_CHANGE'
  | 'VPN_SUSPECTED'
  | 'IP_CHANGE'
  | 'CUSTOM';

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

export const DEFAULT_FULL_POLICY: ProctoringPolicy = {
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

export function policyNeedsMedia(policy: ProctoringPolicy) {
  return (
    policy.webcam ||
    policy.microphone ||
    policy.screenShare ||
    policy.geolocation ||
    policy.faceDetection ||
    policy.voiceDetection
  );
}

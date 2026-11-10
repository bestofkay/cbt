export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ProctorFlag {
  id: string;
  type: string;
  message: string;
  reason?: string;
  severity?: number;
  createdAt: string;
}

export interface ProctorCandidate {
  id: string;
  attemptId: string;
  examSessionId: string;
  examTitle: string;
  name: string;
  candidateName: string;
  candidateEmail: string;
  attemptStatus: string;
  cheatingScore: number;
  riskLevel: RiskLevel;
  status: string;
  eventCount: number;
  flags: ProctorFlag[];
}

export interface GroupedProctorSession {
  id: string;
  name: string;
  examTitle: string;
  activeCandidates: number;
  flaggedCandidates: number;
  candidates: ProctorCandidate[];
}

export interface ProctorSessionsResponse {
  data: GroupedProctorSession[];
}

export interface ProctorEvent {
  id: string;
  type: string;
  severity: string;
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface CandidateMonitorDetail {
  id: string;
  attemptId: string;
  candidateName: string;
  examTitle: string;
  cheatingScore: number;
  riskLevel: RiskLevel;
  status: string;
  events: ProctorEvent[];
  flags: ProctorFlag[];
  locations?: Array<{
    id: string;
    ipAddress: string;
    country: string | null;
    region: string | null;
    city: string | null;
    latitude: number | null;
    longitude: number | null;
    vpnSuspected: boolean;
    createdAt: string;
  }>;
  signalCounts?: Record<string, number>;
}

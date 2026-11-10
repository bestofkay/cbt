import type { FastifyInstance } from 'fastify';
import { resolveProctoringPolicy } from '../modules/proctoring/policy.js';

/** Shared DTO mappers so frontends get stable shapes. */

export function mapDashboardStats(raw: {
  users: number;
  questions: number;
  exams: number;
  attempts: number;
  liveAttempts: number;
}) {
  return {
    totalUsers: raw.users,
    activeExams: raw.exams,
    liveSessions: raw.liveAttempts,
    completedAttempts: raw.attempts,
    questions: raw.questions,
    recentActivity: [] as Array<{ id: string; summary: string; createdAt: string }>,
  };
}

export function mapUserListItem(u: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  createdAt: Date;
  candidateId?: string | null;
  roles: Array<{ role?: { code: string }; code?: string } | string> | string[];
}) {
  const roles = (u.roles as unknown[]).map((r) => {
    if (typeof r === 'string') return r;
    const obj = r as { role?: { code: string }; code?: string };
    return obj.role?.code ?? obj.code ?? '';
  }).filter(Boolean);
  return {
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    status: u.status,
    createdAt: u.createdAt,
    candidateId: u.candidateId ?? null,
    roles,
    role: roles[0] ?? 'CANDIDATE',
  };
}

export function mapBank(bank: {
  id: string;
  name: string;
  code: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count?: { questions: number };
  category?: { id: string; name: string } | null;
  questions?: unknown[];
  topics?: unknown[];
}) {
  return {
    id: bank.id,
    name: bank.name,
    code: bank.code,
    description: bank.description,
    isActive: bank.isActive,
    createdAt: bank.createdAt,
    updatedAt: bank.updatedAt,
    questionCount: bank._count?.questions ?? (bank.questions?.length ?? 0),
    category: bank.category,
    topics: bank.topics ?? [],
    questions: (bank.questions as Array<{
      id: string;
      code: string;
      type: string;
      difficulty: string;
      status: string;
      versions?: Array<{ stem?: string }>;
    }> | undefined)?.map((q) => ({
      id: q.id,
      code: q.code,
      type: q.type,
      difficulty: q.difficulty,
      status: q.status,
      stemPreview: q.versions?.[0]?.stem?.slice(0, 120) ?? '',
    })) ?? [],
  };
}

export function mapQuestionDetail(q: {
  id: string;
  bankId: string;
  code: string;
  type: string;
  difficulty: string;
  status: string;
  pointsDefault: unknown;
  negativeMarking: unknown;
  partialScoring: boolean;
  versions: Array<{
    id: string;
    version: number;
    languageId: string;
    stem: string;
    stemFormat: string;
    solution: string | null;
    autoGradeConfig: unknown;
    choices: Array<{
      id: string;
      label: string;
      content: string;
      isCorrect: boolean;
      sortOrder: number;
    }>;
  }>;
  tags: Array<{ tag: { id: string; name: string } }>;
}) {
  const latest = q.versions[0];
  return {
    id: q.id,
    bankId: q.bankId,
    code: q.code,
    type: q.type,
    difficulty: q.difficulty,
    status: q.status,
    pointsDefault: Number(q.pointsDefault),
    negativeMarking: Number(q.negativeMarking),
    partialScoring: q.partialScoring,
    version: latest
      ? {
          id: latest.id,
          version: latest.version,
          languageId: latest.languageId,
          stem: latest.stem,
          stemFormat: latest.stemFormat,
          solution: latest.solution,
          autoGradeConfig: latest.autoGradeConfig,
          choices: latest.choices,
        }
      : null,
    versions: q.versions,
    tags: q.tags.map((t) => t.tag),
  };
}

export function mapExamTemplate(e: {
  id: string;
  code: string;
  title: string;
  description: string | null;
  durationMinutes: number;
  mode: string;
  isPublished: boolean;
  passingScore: unknown;
  maxAttempts: number;
  createdAt: Date;
  updatedAt: Date;
  sections?: unknown[];
  _count?: { sessions: number };
}) {
  return {
    id: e.id,
    code: e.code,
    title: e.title,
    description: e.description,
    durationMinutes: e.durationMinutes,
    mode: e.mode,
    isPublished: e.isPublished,
    status: e.isPublished ? 'PUBLISHED' : 'DRAFT',
    passingScore: Number(e.passingScore),
    maxAttempts: e.maxAttempts,
    sessionCount: e._count?.sessions ?? 0,
    sections: e.sections ?? [],
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  };
}

export function mapExamSession(s: {
  id: string;
  name: string;
  status: string;
  startsAt: Date | null;
  endsAt: Date | null;
  examTemplate?: {
    id: string;
    title: string;
    code: string;
    durationMinutes: number;
    accessType?: string;
  } | null;
  _count?: { attempts: number; invitations: number };
  invitations?: unknown[];
}) {
  return {
    id: s.id,
    name: s.name,
    status: s.status,
    startsAt: s.startsAt,
    endsAt: s.endsAt,
    examTitle: s.examTemplate?.title ?? s.name,
    examCode: s.examTemplate?.code,
    durationMinutes: s.examTemplate?.durationMinutes ?? 0,
    candidateCount: s._count?.attempts ?? 0,
    invitationCount: s._count?.invitations ?? 0,
    requiresAccessCode: s.examTemplate?.accessType === 'ACCESS_CODE',
    examTemplate: s.examTemplate,
  };
}

export function mapResult(r: {
  id: string;
  totalScore: unknown;
  maxScore: unknown;
  percent: unknown;
  passed: boolean;
  gradedAt: Date;
  sectionScores?: unknown;
  attempt?: {
    submittedAt?: Date | null;
    user?: { firstName: string; lastName: string; email: string };
    examSession?: {
      name: string;
      examTemplate?: { title: string; code: string };
    };
  };
  certificate?: { id: string; certificateNo: string } | null;
}) {
  const examTitle =
    r.attempt?.examSession?.examTemplate?.title ?? r.attempt?.examSession?.name ?? 'Exam';
  const candidateName = r.attempt?.user
    ? `${r.attempt.user.firstName} ${r.attempt.user.lastName}`.trim()
    : '';
  return {
    id: r.id,
    examTitle,
    candidateName,
    candidateEmail: r.attempt?.user?.email ?? '',
    score: Number(r.totalScore),
    maxScore: Number(r.maxScore),
    percentage: Number(r.percent),
    percent: Number(r.percent),
    passed: r.passed,
    submittedAt: r.attempt?.submittedAt ?? r.gradedAt,
    gradedAt: r.gradedAt,
    sections: Array.isArray(r.sectionScores)
      ? r.sectionScores
      : r.sectionScores && typeof r.sectionScores === 'object'
        ? Object.entries(r.sectionScores as Record<string, { score?: number; maxScore?: number }>).map(
            ([title, v]) => ({
              title,
              score: Number(v.score ?? 0),
              maxScore: Number(v.maxScore ?? 0),
            }),
          )
        : [],
    certificate: r.certificate,
  };
}

export function mapBranding(b: {
  id: string;
  appName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  loginBackground: string | null;
  customCss: string | null;
  supportEmail: string | null;
  supportUrl: string | null;
}) {
  return {
    ...b,
    platformName: b.appName,
  };
}

export function mapInvoice(inv: {
  id: string;
  number: string;
  status: string;
  totalCents: number;
  currency: string;
  dueAt: Date | null;
  issuedAt: Date | null;
  paidAt: Date | null;
  createdAt: Date;
  user?: { email: string; firstName: string; lastName: string };
  lines?: unknown[];
}) {
  return {
    id: inv.id,
    number: inv.number,
    status: inv.status,
    amount: inv.totalCents / 100,
    totalCents: inv.totalCents,
    currency: inv.currency,
    dueDate: inv.dueAt,
    issuedAt: inv.issuedAt,
    paidAt: inv.paidAt,
    createdAt: inv.createdAt,
    customerName: inv.user
      ? `${inv.user.firstName} ${inv.user.lastName}`.trim()
      : '',
    customerEmail: inv.user?.email,
    lines: inv.lines ?? [],
  };
}

export function mapTicket(t: {
  id: string;
  number: string;
  subject: string;
  status: string;
  priority: string;
  createdAt: Date;
  updatedAt: Date;
  requester?: { firstName: string; lastName: string; email: string } | null;
  assignee?: { firstName: string; lastName: string; email: string } | null;
  _count?: { messages: number };
}) {
  return {
    id: t.id,
    number: t.number,
    subject: t.subject,
    status: t.status,
    priority: t.priority,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    requesterName: t.requester
      ? `${t.requester.firstName} ${t.requester.lastName}`.trim()
      : '',
    requesterEmail: t.requester?.email,
    assigneeName: t.assignee
      ? `${t.assignee.firstName} ${t.assignee.lastName}`.trim()
      : null,
    messageCount: t._count?.messages ?? 0,
  };
}

export async function mapAttemptForCandidate(app: FastifyInstance, attemptId: string) {
  const attempt = await app.prisma.examAttempt.findUniqueOrThrow({
    where: { id: attemptId },
    include: {
      examSession: { include: { examTemplate: true } },
      answers: true,
      bookmarks: true,
      flags: true,
    },
  });
  const order = (attempt.questionOrder as string[]) ?? [];
  const questions = await app.prisma.question.findMany({
    where: { id: { in: order } },
    include: {
      versions: {
        orderBy: { version: 'desc' },
        take: 1,
        include: {
          choices: {
            select: {
              id: true,
              label: true,
              content: true,
              contentFormat: true,
              sortOrder: true,
            },
            orderBy: { sortOrder: 'asc' },
          },
        },
      },
    },
  });
  const byId = new Map(questions.map((q) => [q.id, q]));
  const answeredIds = new Set(attempt.answers.map((a) => a.questionId));
  const bookmarked = new Set(attempt.bookmarks.map((b) => b.questionId));
  const flagged = new Set(attempt.flags.map((f) => f.questionId));
  const meta = (attempt.metadata as { currentQuestionId?: string } | null) ?? {};

  const mappedQuestions = order
    .map((id, index) => {
      const q = byId.get(id);
      if (!q) return null;
      const version = q.versions[0];
      const answer = attempt.answers.find((a) => a.questionId === id);
      return {
        id: q.id,
        index: index + 1,
        type: q.type,
        stem: version?.stem ?? '',
        stemFormat: version?.stemFormat ?? 'markdown',
        choices: version?.choices ?? [],
        answered: answeredIds.has(id),
        bookmarked: bookmarked.has(id),
        flagged: flagged.has(id),
        response: answer?.response ?? null,
      };
    })
    .filter(Boolean);

  const currentQuestionId =
    meta.currentQuestionId && order.includes(meta.currentQuestionId)
      ? meta.currentQuestionId
      : order[0] ?? null;

  return {
    id: attempt.id,
    attemptId: attempt.id,
    examSessionId: attempt.examSessionId,
    status: attempt.status,
    examTitle: attempt.examSession.examTemplate.title,
    examMode: attempt.examSession.examTemplate.mode,
    durationMinutes: attempt.examSession.examTemplate.durationMinutes,
    startedAt: attempt.startedAt,
    endsAt: attempt.endsAt,
    submittedAt: attempt.submittedAt,
    remainingSeconds: attempt.endsAt
      ? Math.max(0, Math.floor((attempt.endsAt.getTime() - Date.now()) / 1000))
      : null,
    currentQuestionId,
    questions: mappedQuestions,
    answers: attempt.answers,
    bookmarks: attempt.bookmarks,
    flags: attempt.flags,
    proctoringPolicy: resolveProctoringPolicy(
      attempt.examSession.examTemplate.mode,
      attempt.examSession.examTemplate.settings,
    ),
  };
}

export function mapProctorLive(session: {
  id: string;
  attemptId: string;
  cheatingScore: unknown;
  status: string;
  flags: Array<{ id: string; reason: string; severity: number; createdAt: Date }>;
  _count?: { events: number };
  attempt: {
    id: string;
    status: string;
    user: { id: string; firstName: string; lastName: string; email: string };
    examSession: { id: string; name: string };
  };
}) {
  const score = Number(session.cheatingScore);
  return {
    id: session.id,
    attemptId: session.attemptId,
    examSessionId: session.attempt.examSession.id,
    examTitle: session.attempt.examSession.name,
    name: session.attempt.examSession.name,
    candidateName: `${session.attempt.user.firstName} ${session.attempt.user.lastName}`.trim(),
    candidateEmail: session.attempt.user.email,
    attemptStatus: session.attempt.status,
    cheatingScore: score,
    riskLevel: score >= 70 ? 'CRITICAL' : score >= 40 ? 'HIGH' : score >= 20 ? 'MEDIUM' : 'LOW',
    status: session.status,
    flaggedCandidates: session.flags.length,
    activeCandidates: session.status === 'ACTIVE' ? 1 : 0,
    eventCount: session._count?.events ?? 0,
    flags: session.flags.map((f) => ({
      id: f.id,
      type: 'FLAG',
      message: f.reason,
      reason: f.reason,
      severity: f.severity,
      createdAt: f.createdAt,
    })),
  };
}

export function mapProctorDetail(session: {
  id: string;
  attemptId: string;
  cheatingScore: unknown;
  status: string;
  events: Array<{
    id: string;
    type: string;
    severity: number;
    payload: unknown;
    createdAt: Date;
  }>;
  flags: Array<{ id: string; reason: string; severity: number; createdAt: Date }>;
  locationLogs?: Array<{
    id: string;
    ipAddress: string;
    country: string | null;
    region: string | null;
    city: string | null;
    latitude: unknown;
    longitude: unknown;
    vpnSuspected: boolean;
    createdAt: Date;
  }>;
  attempt: {
    user: { id: string; firstName: string; lastName: string; email: string };
    examSession?: { name: string; examTemplate?: { title: string } };
  };
}) {
  const score = Number(session.cheatingScore);
  const mediaTypes = new Set([
    'FACE_MISSING',
    'MULTIPLE_FACES',
    'VOICE_DETECTED',
    'SCREEN_CAPTURE',
    'VPN_SUSPECTED',
    'LOCATION_CHANGE',
    'IP_CHANGE',
  ]);
  const signalCounts: Record<string, number> = {};
  for (const e of session.events) {
    if (mediaTypes.has(e.type)) {
      signalCounts[e.type] = (signalCounts[e.type] ?? 0) + 1;
    }
  }
  return {
    id: session.id,
    attemptId: session.attemptId,
    candidateName: `${session.attempt.user.firstName} ${session.attempt.user.lastName}`.trim(),
    examTitle:
      session.attempt.examSession?.examTemplate?.title ??
      session.attempt.examSession?.name ??
      'Exam',
    cheatingScore: score,
    riskLevel: score >= 70 ? 'CRITICAL' : score >= 40 ? 'HIGH' : score >= 20 ? 'MEDIUM' : 'LOW',
    status: session.status,
    events: session.events.map((e) => ({
      id: e.id,
      type: e.type,
      severity: e.severity >= 8 ? 'CRITICAL' : e.severity >= 5 ? 'HIGH' : e.severity >= 3 ? 'MEDIUM' : 'LOW',
      message: e.type.replaceAll('_', ' '),
      metadata: e.payload,
      createdAt: e.createdAt,
    })),
    flags: session.flags.map((f) => ({
      id: f.id,
      type: 'FLAG',
      message: f.reason,
      createdAt: f.createdAt,
    })),
    locations: (session.locationLogs ?? []).map((l) => ({
      id: l.id,
      ipAddress: l.ipAddress,
      country: l.country,
      region: l.region,
      city: l.city,
      latitude: l.latitude != null ? Number(l.latitude) : null,
      longitude: l.longitude != null ? Number(l.longitude) : null,
      vpnSuspected: l.vpnSuspected,
      createdAt: l.createdAt,
    })),
    signalCounts,
  };
}

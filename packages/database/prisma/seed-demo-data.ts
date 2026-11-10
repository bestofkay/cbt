import { createHash } from 'node:crypto';
import type { PrismaClient, Role } from '@prisma/client';
import { ROLE_CODES } from '@cbt/shared';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

/** Stable IDs so re-seeding is idempotent. */
export const DEMO = {
  dept: {
    root: '10000000-0000-0000-0000-000000000001',
    engineering: '10000000-0000-0000-0000-000000000002',
  },
  users: {
    manager: '20000000-0000-0000-0000-000000000001',
    author: '20000000-0000-0000-0000-000000000002',
    reviewer: '20000000-0000-0000-0000-000000000003',
    proctor: '20000000-0000-0000-0000-000000000004',
    finance: '20000000-0000-0000-0000-000000000005',
    support: '20000000-0000-0000-0000-000000000006',
    candidate1: '20000000-0000-0000-0000-000000000010',
    candidate2: '20000000-0000-0000-0000-000000000011',
    candidate3: '20000000-0000-0000-0000-000000000012',
  },
  candidates: {
    c1: '30000000-0000-0000-0000-000000000001',
    c2: '30000000-0000-0000-0000-000000000002',
    c3: '30000000-0000-0000-0000-000000000003',
  },
  category: {
    it: '40000000-0000-0000-0000-000000000001',
    business: '40000000-0000-0000-0000-000000000002',
  },
  bank: {
    general: '50000000-0000-0000-0000-000000000001',
    software: '50000000-0000-0000-0000-000000000002',
  },
  topic: {
    networking: '51000000-0000-0000-0000-000000000001',
    security: '51000000-0000-0000-0000-000000000002',
    javascript: '51000000-0000-0000-0000-000000000003',
  },
  tag: {
    fundamentals: '52000000-0000-0000-0000-000000000001',
    advanced: '52000000-0000-0000-0000-000000000002',
    compliance: '52000000-0000-0000-0000-000000000003',
  },
  questions: {
    q1: '60000000-0000-0000-0000-000000000001',
    q2: '60000000-0000-0000-0000-000000000002',
    q3: '60000000-0000-0000-0000-000000000003',
    q4: '60000000-0000-0000-0000-000000000004',
    q5: '60000000-0000-0000-0000-000000000005',
    q6: '60000000-0000-0000-0000-000000000006',
    q7: '60000000-0000-0000-0000-000000000007',
  },
  exam: {
    certification: '70000000-0000-0000-0000-000000000001',
    practice: '70000000-0000-0000-0000-000000000002',
  },
  section: {
    core: '71000000-0000-0000-0000-000000000001',
    essay: '71000000-0000-0000-0000-000000000002',
  },
  session: {
    live: '72000000-0000-0000-0000-000000000001',
    published: '72000000-0000-0000-0000-000000000002',
    completed: '72000000-0000-0000-0000-000000000003',
  },
  attempt: {
    inProgress: '73000000-0000-0000-0000-000000000001',
    graded: '73000000-0000-0000-0000-000000000002',
    underReview: '73000000-0000-0000-0000-000000000003',
    analytics1: '73000000-0000-0000-0000-000000000004',
    analytics2: '73000000-0000-0000-0000-000000000005',
  },
  result: {
    graded: '74000000-0000-0000-0000-000000000001',
    underReview: '74000000-0000-0000-0000-000000000002',
  },
  certificate: {
    demo: '75000000-0000-0000-0000-000000000001',
  },
  proctorSession: {
    live: '76000000-0000-0000-0000-000000000001',
  },
  product: {
    examPack: '77000000-0000-0000-0000-000000000001',
    certFee: '77000000-0000-0000-0000-000000000002',
  },
  coupon: {
    welcome: '78000000-0000-0000-0000-000000000001',
    halfOff: '78000000-0000-0000-0000-000000000002',
  },
  invoice: {
    paid: '79000000-0000-0000-0000-000000000001',
    issued: '79000000-0000-0000-0000-000000000002',
  },
  payment: {
    paid: '7a000000-0000-0000-0000-000000000001',
  },
  ticket: {
    open: '7b000000-0000-0000-0000-000000000001',
    resolved: '7b000000-0000-0000-0000-000000000002',
  },
  announcement: {
    global: '7c000000-0000-0000-0000-000000000001',
    session: '7c000000-0000-0000-0000-000000000002',
  },
} as const;

export const DEMO_PASSWORD = 'ChangeMe!Demo1';
export const DEMO_CERT_VERIFY_CODE = 'DEMO-VERIFY-2026';

interface SeedContext {
  prisma: PrismaClient;
  roleMap: Map<string, Role>;
  languageId: string;
  adminId: string;
  passwordHash: string;
}

async function upsertUserWithRole(
  ctx: SeedContext,
  opts: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    roleCode: string;
    candidateId?: string;
    departmentId?: string;
  },
) {
  const role = ctx.roleMap.get(opts.roleCode);
  if (!role) throw new Error(`Missing role ${opts.roleCode}`);

  const user = await ctx.prisma.user.upsert({
    where: { email: opts.email },
    update: {
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      candidateId: opts.candidateId,
      departmentId: opts.departmentId,
      passwordHash: ctx.passwordHash,
    },
    create: {
      id: opts.id,
      email: opts.email,
      passwordHash: ctx.passwordHash,
      firstName: opts.firstName,
      lastName: opts.lastName,
      displayName: `${opts.firstName} ${opts.lastName}`,
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      candidateId: opts.candidateId,
      departmentId: opts.departmentId,
    },
  });

  await ctx.prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: role.id } },
    update: {},
    create: { userId: user.id, roleId: role.id },
  });

  return user;
}

async function seedDepartments(ctx: SeedContext) {
  await ctx.prisma.department.upsert({
    where: { code: 'HQ' },
    update: { name: 'Headquarters' },
    create: {
      id: DEMO.dept.root,
      code: 'HQ',
      name: 'Headquarters',
      description: 'Corporate headquarters',
    },
  });

  await ctx.prisma.department.upsert({
    where: { code: 'ENG' },
    update: { name: 'Engineering', parentId: DEMO.dept.root },
    create: {
      id: DEMO.dept.engineering,
      code: 'ENG',
      name: 'Engineering',
      description: 'Software and platform engineering',
      parentId: DEMO.dept.root,
    },
  });
}

async function seedDemoUsers(ctx: SeedContext) {
  for (const candidate of [
    { id: DEMO.candidates.c1, externalId: 'CAND-001', city: 'Lagos', country: 'NG' },
    { id: DEMO.candidates.c2, externalId: 'CAND-002', city: 'Abuja', country: 'NG' },
    { id: DEMO.candidates.c3, externalId: 'CAND-003', city: 'Port Harcourt', country: 'NG' },
  ]) {
    await ctx.prisma.candidate.upsert({
      where: { id: candidate.id },
      update: { city: candidate.city, country: candidate.country },
      create: {
        id: candidate.id,
        externalId: candidate.externalId,
        city: candidate.city,
        country: candidate.country,
      },
    });
  }

  const staff = [
    { id: DEMO.users.manager, email: 'manager@cbt.local', firstName: 'Elena', lastName: 'Manager', role: ROLE_CODES.EXAM_MANAGER },
    { id: DEMO.users.author, email: 'author@cbt.local', firstName: 'Omar', lastName: 'Author', role: ROLE_CODES.QUESTION_AUTHOR },
    { id: DEMO.users.reviewer, email: 'reviewer@cbt.local', firstName: 'Priya', lastName: 'Reviewer', role: ROLE_CODES.QUESTION_REVIEWER },
    { id: DEMO.users.proctor, email: 'proctor@cbt.local', firstName: 'James', lastName: 'Proctor', role: ROLE_CODES.PROCTOR },
    { id: DEMO.users.finance, email: 'finance@cbt.local', firstName: 'Fatima', lastName: 'Finance', role: ROLE_CODES.FINANCE },
    { id: DEMO.users.support, email: 'support@cbt.local', firstName: 'Sam', lastName: 'Support', role: ROLE_CODES.SUPPORT },
  ];

  for (const u of staff) {
    await upsertUserWithRole(ctx, {
      ...u,
      roleCode: u.role,
      departmentId: DEMO.dept.engineering,
    });
  }

  await upsertUserWithRole(ctx, {
    id: DEMO.users.candidate1,
    email: 'candidate1@cbt.local',
    firstName: 'Alice',
    lastName: 'Demo',
    roleCode: ROLE_CODES.CANDIDATE,
    candidateId: DEMO.candidates.c1,
  });
  await upsertUserWithRole(ctx, {
    id: DEMO.users.candidate2,
    email: 'candidate2@cbt.local',
    firstName: 'Bob',
    lastName: 'Demo',
    roleCode: ROLE_CODES.CANDIDATE,
    candidateId: DEMO.candidates.c2,
  });
  await upsertUserWithRole(ctx, {
    id: DEMO.users.candidate3,
    email: 'candidate3@cbt.local',
    firstName: 'Carol',
    lastName: 'Demo',
    roleCode: ROLE_CODES.CANDIDATE,
    candidateId: DEMO.candidates.c3,
  });

  // Trusted devices for security pages
  const deviceUsers = [
    { userId: ctx.adminId, name: 'Admin laptop' },
    { userId: DEMO.users.candidate1, name: 'Alice phone' },
    { userId: DEMO.users.proctor, name: 'Proctor workstation' },
  ];
  for (const [i, d] of deviceUsers.entries()) {
    const id = `80000000-0000-0000-0000-00000000000${i + 1}`;
    await ctx.prisma.device.upsert({
      where: { id },
      update: { lastSeenAt: new Date(), trusted: true, trustedAt: new Date() },
      create: {
        id,
        userId: d.userId,
        name: d.name,
        deviceType: 'desktop',
        os: 'Windows 11',
        browser: 'Chrome 128',
        trusted: true,
        trustedAt: new Date(),
        lastSeenAt: new Date(),
        lastIp: '192.168.1.10',
      },
    });
  }
}

async function seedTaxonomy(ctx: SeedContext) {
  await ctx.prisma.examCategory.upsert({
    where: { slug: 'information-technology' },
    update: { name: 'Information Technology' },
    create: {
      id: DEMO.category.it,
      name: 'Information Technology',
      slug: 'information-technology',
      description: 'IT certification and skills assessments',
      sortOrder: 1,
    },
  });

  await ctx.prisma.examCategory.upsert({
    where: { slug: 'business' },
    update: { name: 'Business & Management', parentId: null },
    create: {
      id: DEMO.category.business,
      name: 'Business & Management',
      slug: 'business',
      description: 'Business aptitude and compliance exams',
      sortOrder: 2,
    },
  });

  for (const bank of [
    { id: DEMO.bank.general, code: 'GEN-KNOW', name: 'General Knowledge Bank', categoryId: DEMO.category.it },
    { id: DEMO.bank.software, code: 'SW-DEV', name: 'Software Development Bank', categoryId: DEMO.category.it },
  ]) {
    await ctx.prisma.questionBank.upsert({
      where: { code: bank.code },
      update: { name: bank.name, categoryId: bank.categoryId, isActive: true },
      create: { ...bank, description: `${bank.name} demo content`, isActive: true },
    });
  }

  const topics = [
    { id: DEMO.topic.networking, bankId: DEMO.bank.general, code: 'NET', name: 'Networking Fundamentals' },
    { id: DEMO.topic.security, bankId: DEMO.bank.general, code: 'SEC', name: 'Security Basics' },
    { id: DEMO.topic.javascript, bankId: DEMO.bank.software, code: 'JS', name: 'JavaScript' },
  ];
  for (const topic of topics) {
    await ctx.prisma.topic.upsert({
      where: { bankId_code: { bankId: topic.bankId, code: topic.code } },
      update: { name: topic.name },
      create: topic,
    });
  }

  const tags = [
    { id: DEMO.tag.fundamentals, name: 'fundamentals', color: '#0F766E' },
    { id: DEMO.tag.advanced, name: 'advanced', color: '#B45309' },
    { id: DEMO.tag.compliance, name: 'compliance', color: '#1D4ED8' },
  ];
  for (const tag of tags) {
    await ctx.prisma.tag.upsert({
      where: { name: tag.name },
      update: { color: tag.color },
      create: tag,
    });
  }
}

type QuestionSeed = {
  id: string;
  code: string;
  bankId: string;
  type: 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'ESSAY';
  status: 'APPROVED' | 'IN_REVIEW' | 'DRAFT' | 'REJECTED';
  stem: string;
  topicId: string;
  points: number;
  choices?: Array<{ label: string; content: string; isCorrect: boolean }>;
  reviewNotes?: string;
};

async function seedQuestions(ctx: SeedContext) {
  const questions: QuestionSeed[] = [
    {
      id: DEMO.questions.q1,
      code: 'NET-001',
      bankId: DEMO.bank.general,
      type: 'MULTIPLE_CHOICE',
      status: 'APPROVED',
      stem: 'Which layer of the OSI model is responsible for routing packets between networks?',
      topicId: DEMO.topic.networking,
      points: 2,
      choices: [
        { label: 'A', content: 'Data Link', isCorrect: false },
        { label: 'B', content: 'Network', isCorrect: true },
        { label: 'C', content: 'Transport', isCorrect: false },
        { label: 'D', content: 'Session', isCorrect: false },
      ],
    },
    {
      id: DEMO.questions.q2,
      code: 'SEC-001',
      bankId: DEMO.bank.general,
      type: 'MULTIPLE_CHOICE',
      status: 'APPROVED',
      stem: 'What does MFA stand for in authentication?',
      topicId: DEMO.topic.security,
      points: 2,
      choices: [
        { label: 'A', content: 'Multi-Factor Authentication', isCorrect: true },
        { label: 'B', content: 'Managed File Access', isCorrect: false },
        { label: 'C', content: 'Mainframe Authorization', isCorrect: false },
        { label: 'D', content: 'Mobile Firewall Agent', isCorrect: false },
      ],
    },
    {
      id: DEMO.questions.q3,
      code: 'SEC-002',
      bankId: DEMO.bank.general,
      type: 'TRUE_FALSE',
      status: 'APPROVED',
      stem: 'HTTPS encrypts data in transit between client and server.',
      topicId: DEMO.topic.security,
      points: 1,
      choices: [
        { label: 'T', content: 'True', isCorrect: true },
        { label: 'F', content: 'False', isCorrect: false },
      ],
    },
    {
      id: DEMO.questions.q4,
      code: 'JS-ESSAY',
      bankId: DEMO.bank.software,
      type: 'ESSAY',
      status: 'APPROVED',
      stem: 'Explain the difference between `let`, `const`, and `var` in JavaScript. Include scope and hoisting behavior.',
      topicId: DEMO.topic.javascript,
      points: 10,
    },
    {
      id: DEMO.questions.q5,
      code: 'NET-002',
      bankId: DEMO.bank.general,
      type: 'MULTIPLE_CHOICE',
      status: 'IN_REVIEW',
      stem: 'Which protocol resolves domain names to IP addresses?',
      topicId: DEMO.topic.networking,
      points: 2,
      choices: [
        { label: 'A', content: 'DNS', isCorrect: true },
        { label: 'B', content: 'DHCP', isCorrect: false },
        { label: 'C', content: 'FTP', isCorrect: false },
        { label: 'D', content: 'SMTP', isCorrect: false },
      ],
    },
    {
      id: DEMO.questions.q6,
      code: 'JS-001',
      bankId: DEMO.bank.software,
      type: 'MULTIPLE_CHOICE',
      status: 'DRAFT',
      stem: 'Which method creates a new array with transformed elements?',
      topicId: DEMO.topic.javascript,
      points: 2,
      choices: [
        { label: 'A', content: 'map()', isCorrect: true },
        { label: 'B', content: 'forEach()', isCorrect: false },
        { label: 'C', content: 'push()', isCorrect: false },
        { label: 'D', content: 'slice()', isCorrect: false },
      ],
    },
    {
      id: DEMO.questions.q7,
      code: 'NET-003',
      bankId: DEMO.bank.general,
      type: 'MULTIPLE_CHOICE',
      status: 'REJECTED',
      stem: 'What is the default SSH port? (rejected — duplicate of existing item)',
      topicId: DEMO.topic.networking,
      points: 1,
      reviewNotes: 'Duplicate question — merge with NET-004 instead.',
      choices: [
        { label: 'A', content: '22', isCorrect: true },
        { label: 'B', content: '80', isCorrect: false },
      ],
    },
  ];

  for (const q of questions) {
    await ctx.prisma.question.upsert({
      where: { bankId_code: { bankId: q.bankId, code: q.code } },
      update: {
        type: q.type,
        status: q.status,
        topicId: q.topicId,
        authorId: DEMO.users.author,
        pointsDefault: q.points,
      },
      create: {
        id: q.id,
        bankId: q.bankId,
        topicId: q.topicId,
        code: q.code,
        type: q.type,
        difficulty: 'MEDIUM',
        status: q.status,
        authorId: DEMO.users.author,
        pointsDefault: q.points,
      },
    });

    const version = await ctx.prisma.questionVersion.upsert({
      where: {
        questionId_version_languageId: {
          questionId: q.id,
          version: 1,
          languageId: ctx.languageId,
        },
      },
      update: {
        stem: q.stem,
        status: q.status,
        reviewerId: q.status === 'APPROVED' || q.status === 'REJECTED' ? DEMO.users.reviewer : null,
        reviewedAt: q.status === 'APPROVED' || q.status === 'REJECTED' ? new Date() : null,
        reviewNotes: q.reviewNotes,
        gradingRubric:
          q.type === 'ESSAY'
            ? { criteria: ['Scope explanation', 'Hoisting', 'Examples'], maxScore: q.points }
            : undefined,
      },
      create: {
        questionId: q.id,
        version: 1,
        languageId: ctx.languageId,
        stem: q.stem,
        status: q.status,
        reviewerId: q.status === 'APPROVED' || q.status === 'REJECTED' ? DEMO.users.reviewer : null,
        reviewedAt: q.status === 'APPROVED' || q.status === 'REJECTED' ? new Date() : null,
        reviewNotes: q.reviewNotes,
        gradingRubric:
          q.type === 'ESSAY'
            ? { criteria: ['Scope explanation', 'Hoisting', 'Examples'], maxScore: q.points }
            : undefined,
      },
    });

    if (q.choices?.length) {
      await ctx.prisma.choice.deleteMany({ where: { questionVersionId: version.id } });
      for (const [i, choice] of q.choices.entries()) {
        await ctx.prisma.choice.create({
          data: {
            questionVersionId: version.id,
            label: choice.label,
            content: choice.content,
            isCorrect: choice.isCorrect,
            sortOrder: i,
          },
        });
      }
    }

    await ctx.prisma.questionTag.upsert({
      where: { questionId_tagId: { questionId: q.id, tagId: DEMO.tag.fundamentals } },
      update: {},
      create: { questionId: q.id, tagId: DEMO.tag.fundamentals },
    });

    if (q.status === 'IN_REVIEW') {
      const existing = await ctx.prisma.approvalWorkflow.findFirst({
        where: { questionVersionId: version.id, action: 'SUBMITTED' },
      });
      if (!existing) {
        await ctx.prisma.approvalWorkflow.create({
          data: {
            questionVersionId: version.id,
            action: 'SUBMITTED',
            actorId: DEMO.users.author,
            notes: 'Ready for SME review',
          },
        });
      }
    }
  }
}

async function seedExams(ctx: SeedContext) {
  const proctoringSettings = {
    proctoring: {
      requireWebcam: true,
      requireMicrophone: true,
      requireScreenShare: true,
      requireGeolocation: true,
      requireConsent: true,
      vpnDetection: true,
    },
  };

  await ctx.prisma.examTemplate.upsert({
    where: { code: 'IT-CERT-2026' },
    update: {
      title: 'IT Professional Certification',
      isPublished: true,
      mode: 'LIVE',
      certificateEnabled: true,
      settings: proctoringSettings,
      retakePolicy: { maxRetakes: 2, cooldownDays: 30 },
    },
    create: {
      id: DEMO.exam.certification,
      code: 'IT-CERT-2026',
      title: 'IT Professional Certification',
      description: 'Comprehensive IT certification exam with proctored delivery and essay component.',
      categoryId: DEMO.category.it,
      mode: 'LIVE',
      accessType: 'SCHEDULED',
      durationMinutes: 90,
      passingScore: 70,
      maxAttempts: 2,
      shuffleQuestions: true,
      shuffleChoices: true,
      certificateEnabled: true,
      showResults: true,
      isPublished: true,
      settings: proctoringSettings,
      retakePolicy: { maxRetakes: 2, cooldownDays: 30 },
      instructions: 'Ensure webcam, microphone, and screen share are enabled before starting.',
    },
  });

  await ctx.prisma.examTemplate.upsert({
    where: { code: 'PRACTICE-IT' },
    update: { isPublished: true, mode: 'PRACTICE' },
    create: {
      id: DEMO.exam.practice,
      code: 'PRACTICE-IT',
      title: 'IT Practice Quiz',
      description: 'Low-stakes practice session for candidates.',
      categoryId: DEMO.category.it,
      mode: 'PRACTICE',
      accessType: 'OPEN',
      durationMinutes: 30,
      passingScore: 50,
      maxAttempts: 5,
      shuffleQuestions: true,
      showResults: true,
      isPublished: true,
      settings: { proctoring: { requireWebcam: false, requireConsent: false } },
    },
  });

  for (const section of [
    {
      id: DEMO.section.core,
      examTemplateId: DEMO.exam.certification,
      title: 'Core Knowledge',
      sortOrder: 0,
      questionCount: 3,
    },
    {
      id: DEMO.section.essay,
      examTemplateId: DEMO.exam.certification,
      title: 'Written Response',
      sortOrder: 1,
      questionCount: 1,
    },
  ]) {
    await ctx.prisma.examSection.upsert({
      where: { id: section.id },
      update: { title: section.title, sortOrder: section.sortOrder },
      create: section,
    });
  }

  const rules = [
    { questionId: DEMO.questions.q1, sectionId: DEMO.section.core, sortOrder: 0, points: 2 },
    { questionId: DEMO.questions.q2, sectionId: DEMO.section.core, sortOrder: 1, points: 2 },
    { questionId: DEMO.questions.q3, sectionId: DEMO.section.core, sortOrder: 2, points: 1 },
    { questionId: DEMO.questions.q4, sectionId: DEMO.section.essay, sortOrder: 3, points: 10 },
  ];

  await ctx.prisma.examQuestionRule.deleteMany({
    where: { examTemplateId: DEMO.exam.certification },
  });

  for (const rule of rules) {
    await ctx.prisma.examQuestionRule.create({
      data: {
        examTemplateId: DEMO.exam.certification,
        sectionId: rule.sectionId,
        questionId: rule.questionId,
        points: rule.points,
        sortOrder: rule.sortOrder,
      },
    });
  }

  await ctx.prisma.examQuestionRule.deleteMany({
    where: { examTemplateId: DEMO.exam.practice },
  });
  for (const [i, questionId] of [DEMO.questions.q1, DEMO.questions.q2, DEMO.questions.q3].entries()) {
    await ctx.prisma.examQuestionRule.create({
      data: {
        examTemplateId: DEMO.exam.practice,
        questionId,
        points: 1,
        sortOrder: i,
      },
    });
  }

  await ctx.prisma.certificateTemplate.upsert({
    where: { examTemplateId: DEMO.exam.certification },
    update: {},
    create: {
      examTemplateId: DEMO.exam.certification,
      name: 'IT Certification',
      htmlTemplate:
        '<div class="cert"><h1>Certificate of Achievement</h1><p>{{candidateName}} passed {{examTitle}} with {{percent}}%.</p></div>',
      css: '.cert { font-family: serif; text-align: center; }',
    },
  });
}

async function seedSessions(ctx: SeedContext) {
  const now = new Date();
  const inOneWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  await ctx.prisma.examSession.upsert({
    where: { id: DEMO.session.live },
    update: {
      status: 'LIVE',
      startsAt: oneHourAgo,
      endsAt: twoHoursFromNow,
    },
    create: {
      id: DEMO.session.live,
      examTemplateId: DEMO.exam.certification,
      name: 'IT Cert — Live Proctored (Demo)',
      status: 'LIVE',
      startsAt: oneHourAgo,
      endsAt: twoHoursFromNow,
      timezone: 'Africa/Lagos',
      maxCandidates: 50,
    },
  });

  await ctx.prisma.examSession.upsert({
    where: { id: DEMO.session.published },
    update: { status: 'PUBLISHED', startsAt: now, endsAt: inOneWeek },
    create: {
      id: DEMO.session.published,
      examTemplateId: DEMO.exam.practice,
      name: 'Practice Quiz — Open Window',
      status: 'PUBLISHED',
      startsAt: now,
      endsAt: inOneWeek,
      timezone: 'UTC',
    },
  });

  await ctx.prisma.examSession.upsert({
    where: { id: DEMO.session.completed },
    update: { status: 'COMPLETED' },
    create: {
      id: DEMO.session.completed,
      examTemplateId: DEMO.exam.certification,
      name: 'IT Cert — March 2026 Cohort',
      status: 'COMPLETED',
      startsAt: lastWeek,
      endsAt: new Date(lastWeek.getTime() + 4 * 60 * 60 * 1000),
      timezone: 'Africa/Lagos',
    },
  });

  for (const [candidateId, email] of [
    [DEMO.candidates.c1, 'candidate1@cbt.local'],
    [DEMO.candidates.c2, 'candidate2@cbt.local'],
    [DEMO.candidates.c3, 'candidate3@cbt.local'],
  ] as const) {
    const inviteToken = `demo-invite-${candidateId.slice(-4)}`;
    await ctx.prisma.examInvitation.upsert({
      where: {
        examSessionId_candidateId: {
          examSessionId: DEMO.session.live,
          candidateId,
        },
      },
      update: { email, tokenHash: sha256(inviteToken) },
      create: {
        examSessionId: DEMO.session.live,
        candidateId,
        email,
        tokenHash: sha256(inviteToken),
        expiresAt: twoHoursFromNow,
      },
    });
  }
}

async function seedAttemptsAndResults(ctx: SeedContext) {
  const now = new Date();
  const questionOrder = [DEMO.questions.q1, DEMO.questions.q2, DEMO.questions.q3, DEMO.questions.q4];
  const endsAt = new Date(now.getTime() + 75 * 60 * 1000);

  // Bob — in-progress live attempt (proctor monitor demo)
  await ctx.prisma.examAttempt.upsert({
    where: {
      examSessionId_candidateId_attemptNumber: {
        examSessionId: DEMO.session.live,
        candidateId: DEMO.candidates.c2,
        attemptNumber: 1,
      },
    },
    update: {
      status: 'IN_PROGRESS',
      startedAt: new Date(now.getTime() - 20 * 60 * 1000),
      endsAt,
      lastActivityAt: now,
      questionOrder,
    },
    create: {
      id: DEMO.attempt.inProgress,
      examSessionId: DEMO.session.live,
      candidateId: DEMO.candidates.c2,
      userId: DEMO.users.candidate2,
      attemptNumber: 1,
      status: 'IN_PROGRESS',
      startedAt: new Date(now.getTime() - 20 * 60 * 1000),
      endsAt,
      lastActivityAt: now,
      timeSpentSeconds: 1200,
      ipAddress: '102.89.12.45',
      questionOrder,
    },
  });

  // Alice — graded pass with certificate
  await ctx.prisma.examAttempt.upsert({
    where: {
      examSessionId_candidateId_attemptNumber: {
        examSessionId: DEMO.session.completed,
        candidateId: DEMO.candidates.c1,
        attemptNumber: 1,
      },
    },
    update: {
      status: 'GRADED',
      scoreRaw: 13,
      scorePercent: 86.67,
      passed: true,
      submittedAt: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000),
    },
    create: {
      id: DEMO.attempt.graded,
      examSessionId: DEMO.session.completed,
      candidateId: DEMO.candidates.c1,
      userId: DEMO.users.candidate1,
      attemptNumber: 1,
      status: 'GRADED',
      startedAt: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000 - 90 * 60 * 1000),
      endsAt: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000),
      submittedAt: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000),
      lastActivityAt: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000),
      timeSpentSeconds: 4800,
      scoreRaw: 13,
      scorePercent: 86.67,
      passed: true,
      questionOrder,
    },
  });

  // Carol — under manual review (essay pending)
  await ctx.prisma.examAttempt.upsert({
    where: {
      examSessionId_candidateId_attemptNumber: {
        examSessionId: DEMO.session.completed,
        candidateId: DEMO.candidates.c3,
        attemptNumber: 1,
      },
    },
    update: { status: 'UNDER_REVIEW', scoreRaw: 3, scorePercent: 20, passed: false },
    create: {
      id: DEMO.attempt.underReview,
      examSessionId: DEMO.session.completed,
      candidateId: DEMO.candidates.c3,
      userId: DEMO.users.candidate3,
      attemptNumber: 1,
      status: 'UNDER_REVIEW',
      startedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000 - 90 * 60 * 1000),
      endsAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      submittedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      lastActivityAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      timeSpentSeconds: 5100,
      scoreRaw: 3,
      scorePercent: 20,
      passed: false,
      questionOrder,
    },
  });

  // Extra graded attempts for analytics psychometrics
  const analyticsAttempts = [
    {
      id: DEMO.attempt.analytics1,
      candidateId: DEMO.candidates.c2,
      userId: DEMO.users.candidate2,
      attemptNumber: 1,
      scoreRaw: 11,
      scorePercent: 73.33,
      passed: true,
    },
    {
      id: DEMO.attempt.analytics2,
      candidateId: DEMO.candidates.c3,
      userId: DEMO.users.candidate3,
      attemptNumber: 2,
      scoreRaw: 9,
      scorePercent: 60,
      passed: false,
    },
  ];

  for (const a of analyticsAttempts) {
    await ctx.prisma.examAttempt.upsert({
      where: {
        examSessionId_candidateId_attemptNumber: {
          examSessionId: DEMO.session.completed,
          candidateId: a.candidateId,
          attemptNumber: a.attemptNumber,
        },
      },
      update: {
        status: 'GRADED',
        scoreRaw: a.scoreRaw,
        scorePercent: a.scorePercent,
        passed: a.passed,
      },
      create: {
        id: a.id,
        examSessionId: DEMO.session.completed,
        candidateId: a.candidateId,
        userId: a.userId,
        attemptNumber: a.attemptNumber,
        status: 'GRADED',
        startedAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000),
        submittedAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000),
        scoreRaw: a.scoreRaw,
        scorePercent: a.scorePercent,
        passed: a.passed,
        questionOrder: questionOrder.slice(0, 3),
      },
    });
  }

  const answerSets: Array<{
    attemptId: string;
    answers: Array<{
      questionId: string;
      response: unknown;
      isCorrect: boolean | null;
      scoreAwarded: number | null;
      maxScore: number;
      needsReview?: boolean;
    }>;
  }> = [
    {
      attemptId: DEMO.attempt.inProgress,
      answers: [
        { questionId: DEMO.questions.q1, response: { choiceIds: [] }, isCorrect: null, scoreAwarded: null, maxScore: 2 },
        { questionId: DEMO.questions.q2, response: { choiceIds: [] }, isCorrect: null, scoreAwarded: null, maxScore: 2 },
      ],
    },
    {
      attemptId: DEMO.attempt.graded,
      answers: [
        { questionId: DEMO.questions.q1, response: { choiceLabel: 'B' }, isCorrect: true, scoreAwarded: 2, maxScore: 2 },
        { questionId: DEMO.questions.q2, response: { choiceLabel: 'A' }, isCorrect: true, scoreAwarded: 2, maxScore: 2 },
        { questionId: DEMO.questions.q3, response: { value: true }, isCorrect: true, scoreAwarded: 1, maxScore: 1 },
        {
          questionId: DEMO.questions.q4,
          response: { text: 'let and const are block-scoped; var is function-scoped. const cannot be reassigned.' },
          isCorrect: true,
          scoreAwarded: 8,
          maxScore: 10,
        },
      ],
    },
    {
      attemptId: DEMO.attempt.underReview,
      answers: [
        { questionId: DEMO.questions.q1, response: { choiceLabel: 'B' }, isCorrect: true, scoreAwarded: 2, maxScore: 2 },
        { questionId: DEMO.questions.q2, response: { choiceLabel: 'C' }, isCorrect: false, scoreAwarded: 0, maxScore: 2 },
        { questionId: DEMO.questions.q3, response: { value: true }, isCorrect: true, scoreAwarded: 1, maxScore: 1 },
        {
          questionId: DEMO.questions.q4,
          response: { text: 'Variables store values.' },
          isCorrect: null,
          scoreAwarded: null,
          maxScore: 10,
          needsReview: true,
        },
      ],
    },
  ];

  for (const set of answerSets) {
    for (const a of set.answers) {
      await ctx.prisma.attemptAnswer.upsert({
        where: { attemptId_questionId: { attemptId: set.attemptId, questionId: a.questionId } },
        update: {
          response: a.response,
          isCorrect: a.isCorrect,
          scoreAwarded: a.scoreAwarded,
          maxScore: a.maxScore,
          needsReview: a.needsReview ?? false,
          answeredAt: a.scoreAwarded !== null || a.needsReview ? new Date() : null,
        },
        create: {
          attemptId: set.attemptId,
          questionId: a.questionId,
          response: a.response,
          isCorrect: a.isCorrect,
          scoreAwarded: a.scoreAwarded,
          maxScore: a.maxScore,
          needsReview: a.needsReview ?? false,
          answeredAt: a.scoreAwarded !== null || a.needsReview ? new Date() : null,
        },
      });
    }
  }

  const analyticsAnswers = [
    {
      attemptId: DEMO.attempt.analytics1,
      answers: [
        { questionId: DEMO.questions.q1, isCorrect: true, scoreAwarded: 2 },
        { questionId: DEMO.questions.q2, isCorrect: true, scoreAwarded: 2 },
        { questionId: DEMO.questions.q3, isCorrect: false, scoreAwarded: 0 },
      ],
    },
    {
      attemptId: DEMO.attempt.analytics2,
      answers: [
        { questionId: DEMO.questions.q1, isCorrect: true, scoreAwarded: 2 },
        { questionId: DEMO.questions.q2, isCorrect: false, scoreAwarded: 0 },
        { questionId: DEMO.questions.q3, isCorrect: false, scoreAwarded: 0 },
      ],
    },
  ];

  for (const set of analyticsAnswers) {
    for (const a of set.answers) {
      await ctx.prisma.attemptAnswer.upsert({
        where: { attemptId_questionId: { attemptId: set.attemptId, questionId: a.questionId } },
        update: {
          response: { demo: true },
          isCorrect: a.isCorrect,
          scoreAwarded: a.scoreAwarded,
          maxScore: 2,
          answeredAt: new Date(),
        },
        create: {
          attemptId: set.attemptId,
          questionId: a.questionId,
          response: { demo: true },
          isCorrect: a.isCorrect,
          scoreAwarded: a.scoreAwarded,
          maxScore: 2,
          answeredAt: new Date(),
        },
      });
    }

    await ctx.prisma.result.upsert({
      where: { attemptId: set.attemptId },
      update: {},
      create: {
        attemptId: set.attemptId,
        totalScore: set.answers.reduce((s, a) => s + a.scoreAwarded, 0),
        maxScore: 6,
        percent: set.attemptId === DEMO.attempt.analytics1 ? 66.67 : 33.33,
        passed: set.attemptId === DEMO.attempt.analytics1,
      },
    });
  }

  const essayAnswer = await ctx.prisma.attemptAnswer.findUniqueOrThrow({
    where: {
      attemptId_questionId: {
        attemptId: DEMO.attempt.underReview,
        questionId: DEMO.questions.q4,
      },
    },
  });

  await ctx.prisma.manualReviewItem.upsert({
    where: { id: '7d000000-0000-0000-0000-000000000001' },
    update: { status: 'PENDING', answerId: essayAnswer.id },
    create: {
      id: '7d000000-0000-0000-0000-000000000001',
      attemptId: DEMO.attempt.underReview,
      answerId: essayAnswer.id,
      status: 'PENDING',
    },
  });

  await ctx.prisma.result.upsert({
    where: { attemptId: DEMO.attempt.graded },
    update: { totalScore: 13, maxScore: 15, percent: 86.67, passed: true },
    create: {
      id: DEMO.result.graded,
      attemptId: DEMO.attempt.graded,
      totalScore: 13,
      maxScore: 15,
      percent: 86.67,
      passed: true,
      sectionScores: { core: 5, essay: 8 },
      topicScores: { networking: 2, security: 3, javascript: 8 },
    },
  });

  await ctx.prisma.result.upsert({
    where: { attemptId: DEMO.attempt.underReview },
    update: { totalScore: 3, maxScore: 15, percent: 20, passed: false },
    create: {
      id: DEMO.result.underReview,
      attemptId: DEMO.attempt.underReview,
      totalScore: 3,
      maxScore: 15,
      percent: 20,
      passed: false,
    },
  });

  await ctx.prisma.certificate.upsert({
    where: { resultId: DEMO.result.graded },
    update: {
      verificationCode: DEMO_CERT_VERIFY_CODE,
      certificateNo: 'CERT-DEMO-2026-0001',
    },
    create: {
      id: DEMO.certificate.demo,
      resultId: DEMO.result.graded,
      userId: DEMO.users.candidate1,
      certificateNo: 'CERT-DEMO-2026-0001',
      verificationCode: DEMO_CERT_VERIFY_CODE,
      issuedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      expiresAt: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
    },
  });
}

async function seedProctoring(ctx: SeedContext) {
  const proctorSession = await ctx.prisma.proctorSession.upsert({
    where: { attemptId: DEMO.attempt.inProgress },
    update: {
      status: 'ACTIVE',
      proctorUserId: DEMO.users.proctor,
      cheatingScore: 42,
    },
    create: {
      id: DEMO.proctorSession.live,
      attemptId: DEMO.attempt.inProgress,
      proctorUserId: DEMO.users.proctor,
      status: 'ACTIVE',
      cheatingScore: 42,
      settings: { autoFlagThreshold: 50 },
    },
  });

  await ctx.prisma.proctorEvent.deleteMany({ where: { proctorSessionId: proctorSession.id } });
  const events: Array<{ type: 'TAB_SWITCH' | 'FACE_MISSING' | 'VOICE_DETECTED' | 'VPN_SUSPECTED' | 'LOCATION_CHANGE'; severity: number }> = [
    { type: 'TAB_SWITCH', severity: 3 },
    { type: 'FACE_MISSING', severity: 4 },
    { type: 'VOICE_DETECTED', severity: 2 },
    { type: 'VPN_SUSPECTED', severity: 5 },
    { type: 'LOCATION_CHANGE', severity: 3 },
  ];
  for (const [i, e] of events.entries()) {
    await ctx.prisma.proctorEvent.create({
      data: {
        proctorSessionId: proctorSession.id,
        type: e.type,
        severity: e.severity,
        payload: { demo: true, index: i },
        clientTimestamp: new Date(Date.now() - (events.length - i) * 5 * 60 * 1000),
      },
    });
  }

  await ctx.prisma.locationLog.deleteMany({ where: { proctorSessionId: proctorSession.id } });
  await ctx.prisma.locationLog.createMany({
    data: [
      {
        proctorSessionId: proctorSession.id,
        ipAddress: '102.89.12.45',
        country: 'NG',
        region: 'Lagos',
        city: 'Lagos',
        latitude: 6.5244,
        longitude: 3.3792,
        vpnSuspected: false,
      },
      {
        proctorSessionId: proctorSession.id,
        ipAddress: '185.220.101.5',
        country: 'DE',
        region: 'Berlin',
        city: 'Berlin',
        latitude: 52.52,
        longitude: 13.405,
        vpnSuspected: true,
      },
    ],
  });

  await ctx.prisma.proctorFlag.deleteMany({ where: { proctorSessionId: proctorSession.id } });
  await ctx.prisma.proctorFlag.create({
    data: {
      proctorSessionId: proctorSession.id,
      reason: 'Multiple high-severity proctoring signals',
      severity: 4,
      autoGenerated: true,
    },
  });
}

async function seedBilling(ctx: SeedContext) {
  await ctx.prisma.product.upsert({
    where: { sku: 'EXAM-PACK-IT' },
    update: { name: 'IT Certification Exam Pack', priceCents: 15000, isActive: true },
    create: {
      id: DEMO.product.examPack,
      sku: 'EXAM-PACK-IT',
      name: 'IT Certification Exam Pack',
      description: 'Single attempt for IT Professional Certification',
      priceCents: 15000,
      currency: 'USD',
      isActive: true,
    },
  });

  await ctx.prisma.product.upsert({
    where: { sku: 'CERT-REPRINT' },
    update: { name: 'Certificate Reprint', priceCents: 2500, isActive: true },
    create: {
      id: DEMO.product.certFee,
      sku: 'CERT-REPRINT',
      name: 'Certificate Reprint',
      description: 'Official certificate PDF reprint',
      priceCents: 2500,
      currency: 'USD',
      isActive: true,
    },
  });

  await ctx.prisma.coupon.upsert({
    where: { code: 'WELCOME10' },
    update: { isActive: true, percentOff: 10 },
    create: {
      id: DEMO.coupon.welcome,
      code: 'WELCOME10',
      description: '10% off first exam purchase',
      percentOff: 10,
      maxRedemptions: 100,
      isActive: true,
    },
  });

  await ctx.prisma.coupon.upsert({
    where: { code: 'HALFOFF50' },
    update: { isActive: true, amountOffCents: 5000, currency: 'USD' },
    create: {
      id: DEMO.coupon.halfOff,
      code: 'HALFOFF50',
      description: '$50 off certification bundle',
      amountOffCents: 5000,
      currency: 'USD',
      maxRedemptions: 20,
      isActive: true,
    },
  });

  await ctx.prisma.invoice.upsert({
    where: { number: 'INV-DEMO-0001' },
    update: { status: 'PAID', totalCents: 13500 },
    create: {
      id: DEMO.invoice.paid,
      userId: DEMO.users.candidate1,
      couponId: DEMO.coupon.welcome,
      number: 'INV-DEMO-0001',
      status: 'PAID',
      subtotalCents: 15000,
      discountCents: 1500,
      taxCents: 0,
      totalCents: 13500,
      currency: 'USD',
      issuedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      paidAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
    },
  });

  await ctx.prisma.invoiceLine.deleteMany({ where: { invoiceId: DEMO.invoice.paid } });
  await ctx.prisma.invoiceLine.create({
    data: {
      invoiceId: DEMO.invoice.paid,
      productId: DEMO.product.examPack,
      description: 'IT Certification Exam Pack',
      quantity: 1,
      unitCents: 15000,
      totalCents: 15000,
    },
  });

  await ctx.prisma.invoice.upsert({
    where: { number: 'INV-DEMO-0002' },
    update: { status: 'ISSUED', totalCents: 2500 },
    create: {
      id: DEMO.invoice.issued,
      userId: DEMO.users.candidate2,
      number: 'INV-DEMO-0002',
      status: 'ISSUED',
      subtotalCents: 2500,
      discountCents: 0,
      taxCents: 0,
      totalCents: 2500,
      currency: 'USD',
      issuedAt: new Date(),
      dueAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
  });

  await ctx.prisma.invoiceLine.deleteMany({ where: { invoiceId: DEMO.invoice.issued } });
  await ctx.prisma.invoiceLine.create({
    data: {
      invoiceId: DEMO.invoice.issued,
      productId: DEMO.product.certFee,
      description: 'Certificate Reprint',
      quantity: 1,
      unitCents: 2500,
      totalCents: 2500,
    },
  });

  await ctx.prisma.payment.upsert({
    where: { id: DEMO.payment.paid },
    update: { status: 'SUCCEEDED', amountCents: 13500 },
    create: {
      id: DEMO.payment.paid,
      userId: DEMO.users.candidate1,
      invoiceId: DEMO.invoice.paid,
      couponId: DEMO.coupon.welcome,
      provider: 'simulated',
      providerPaymentId: 'sim_demo_0001',
      amountCents: 13500,
      currency: 'USD',
      status: 'SUCCEEDED',
      paidAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
    },
  });
}

async function seedCommsAndSupport(ctx: SeedContext) {
  const notifications = [
    {
      id: '7e000000-0000-0000-0000-000000000001',
      userId: DEMO.users.candidate1,
      channel: 'IN_APP' as const,
      subject: 'Exam result available',
      body: 'Your IT Professional Certification result is ready to view.',
      status: 'SENT' as const,
    },
    {
      id: '7e000000-0000-0000-0000-000000000002',
      userId: DEMO.users.candidate2,
      channel: 'IN_APP' as const,
      subject: 'Live exam reminder',
      body: 'Your proctored session is active. Join before the window closes.',
      status: 'SENT' as const,
    },
    {
      id: '7e000000-0000-0000-0000-000000000003',
      userId: ctx.adminId,
      channel: 'IN_APP' as const,
      subject: 'Manual grading queue',
      body: '1 essay response is awaiting review.',
      status: 'SENT' as const,
    },
  ];

  for (const n of notifications) {
    await ctx.prisma.notification.upsert({
      where: { id: n.id },
      update: { subject: n.subject, body: n.body, status: n.status, sentAt: new Date() },
      create: { ...n, sentAt: new Date() },
    });
  }

  await ctx.prisma.announcement.upsert({
    where: { id: DEMO.announcement.global },
    update: {},
    create: {
      id: DEMO.announcement.global,
      title: 'Platform maintenance window',
      body: 'Scheduled maintenance this Sunday 02:00–04:00 UTC. Candidate exams will remain available.',
      priority: 1,
      createdById: ctx.adminId,
    },
  });

  await ctx.prisma.announcement.upsert({
    where: { id: DEMO.announcement.session },
    update: {},
    create: {
      id: DEMO.announcement.session,
      examSessionId: DEMO.session.live,
      title: 'Proctoring check',
      body: 'Ensure your webcam and microphone are enabled before continuing the live exam.',
      priority: 2,
      createdById: DEMO.users.proctor,
    },
  });

  await ctx.prisma.supportTicket.upsert({
    where: { number: 'TKT-DEMO-0001' },
    update: { status: 'OPEN', assigneeId: DEMO.users.support },
    create: {
      id: DEMO.ticket.open,
      number: 'TKT-DEMO-0001',
      requesterId: DEMO.users.candidate2,
      assigneeId: DEMO.users.support,
      subject: 'Cannot start proctored exam',
      status: 'OPEN',
      priority: 'HIGH',
      category: 'technical',
    },
  });

  await ctx.prisma.supportMessage.deleteMany({ where: { ticketId: DEMO.ticket.open } });
  await ctx.prisma.supportMessage.createMany({
    data: [
      {
        ticketId: DEMO.ticket.open,
        authorId: DEMO.users.candidate2,
        body: 'The exam asks for screen share but my browser keeps blocking it.',
      },
      {
        ticketId: DEMO.ticket.open,
        authorId: DEMO.users.support,
        body: 'Please allow screen capture for this site in Chrome settings and retry.',
        isInternal: false,
      },
    ],
  });

  await ctx.prisma.supportTicket.upsert({
    where: { number: 'TKT-DEMO-0002' },
    update: { status: 'RESOLVED' },
    create: {
      id: DEMO.ticket.resolved,
      number: 'TKT-DEMO-0002',
      requesterId: DEMO.users.candidate1,
      assigneeId: DEMO.users.support,
      subject: 'Certificate download',
      status: 'RESOLVED',
      priority: 'MEDIUM',
      category: 'billing',
      closedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
  });

  await ctx.prisma.supportMessage.deleteMany({ where: { ticketId: DEMO.ticket.resolved } });
  await ctx.prisma.supportMessage.create({
    data: {
      ticketId: DEMO.ticket.resolved,
      authorId: DEMO.users.support,
      body: 'Your certificate is available under Results. Verification code: DEMO-VERIFY-2026',
    },
  });
}

async function seedAuditAndExtras(ctx: SeedContext) {
  const auditEntries = [
    {
      id: '81000000-0000-0000-0000-000000000001',
      actorId: ctx.adminId,
      action: 'exam.publish',
      resource: 'exam_template',
      resourceId: DEMO.exam.certification,
      metadata: { code: 'IT-CERT-2026' },
    },
    {
      id: '81000000-0000-0000-0000-000000000002',
      actorId: DEMO.users.manager,
      action: 'session.create',
      resource: 'exam_session',
      resourceId: DEMO.session.live,
      metadata: { name: 'IT Cert — Live Proctored (Demo)' },
    },
    {
      id: '81000000-0000-0000-0000-000000000003',
      actorId: DEMO.users.reviewer,
      action: 'question.approve',
      resource: 'question',
      resourceId: DEMO.questions.q1,
    },
  ];

  for (const entry of auditEntries) {
    await ctx.prisma.auditLog.upsert({
      where: { id: entry.id },
      update: {},
      create: entry,
    });
  }

  await ctx.prisma.webhook.upsert({
    where: { id: '7f000000-0000-0000-0000-000000000001' },
    update: { isActive: true },
    create: {
      id: '7f000000-0000-0000-0000-000000000001',
      name: 'Demo LMS webhook',
      url: 'https://example.com/webhooks/cbt',
      events: ['exam.completed', 'certificate.issued'],
      isActive: true,
    },
  });

  await ctx.prisma.featureFlag.upsert({
    where: { key: 'billing.catalog' },
    update: { enabled: true },
    create: {
      key: 'billing.catalog',
      description: 'Enable product catalog and coupons',
      enabled: true,
    },
  });
}

export async function seedDemoData(
  prisma: PrismaClient,
  roleMap: Map<string, Role>,
  languageId: string,
  adminId: string,
  passwordHash: string,
) {
  const ctx: SeedContext = { prisma, roleMap, languageId, adminId, passwordHash };

  console.log('Seeding demo data…');
  await seedDepartments(ctx);
  await seedDemoUsers(ctx);
  await seedTaxonomy(ctx);
  await seedQuestions(ctx);
  await seedExams(ctx);
  await seedSessions(ctx);
  await seedAttemptsAndResults(ctx);
  await seedProctoring(ctx);
  await seedBilling(ctx);
  await seedCommsAndSupport(ctx);
  await seedAuditAndExtras(ctx);
  console.log('Demo data seeded.');
}

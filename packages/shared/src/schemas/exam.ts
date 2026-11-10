import { z } from 'zod';
import { difficultySchema, questionTypeSchema } from './question.js';

export const createExamTemplateSchema = z.object({
  code: z.string().min(1).max(50),
  title: z.string().min(1).max(250),
  description: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  mode: z.enum(['PRACTICE', 'MOCK', 'REAL', 'LIVE']).default('REAL'),
  accessType: z.enum(['OPEN', 'INVITATION_ONLY', 'ACCESS_CODE', 'SCHEDULED']).default('SCHEDULED'),
  durationMinutes: z.number().int().positive(),
  sectionTiming: z.boolean().default(false),
  allowBreaks: z.boolean().default(false),
  breakMinutes: z.number().int().min(0).default(0),
  passingScore: z.number().min(0).max(100).default(50),
  maxAttempts: z.number().int().positive().default(1),
  shuffleQuestions: z.boolean().default(true),
  shuffleChoices: z.boolean().default(true),
  adaptive: z.boolean().default(false),
  negativeMarking: z.boolean().default(false),
  gracePeriodSeconds: z.number().int().min(0).default(30),
  lateEntryMinutes: z.number().int().min(0).default(0),
  allowResume: z.boolean().default(true),
  autoSubmit: z.boolean().default(true),
  showResults: z.boolean().default(false),
  certificateEnabled: z.boolean().default(false),
  instructions: z.string().optional(),
  sections: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        description: z.string().optional(),
        sortOrder: z.number().int().default(0),
        durationMinutes: z.number().int().positive().optional(),
      }),
    )
    .optional(),
  questionRules: z
    .array(
      z.object({
        sectionId: z.string().uuid().optional(),
        questionId: z.string().uuid().optional(),
        poolBankId: z.string().uuid().optional(),
        poolTopicId: z.string().uuid().optional(),
        poolDifficulty: difficultySchema.optional(),
        poolType: questionTypeSchema.optional(),
        poolCount: z.number().int().positive().optional(),
        points: z.number().positive().default(1),
        negativePoints: z.number().min(0).default(0),
        sortOrder: z.number().int().default(0),
        isMandatory: z.boolean().default(true),
      }),
    )
    .optional(),
});

export const createExamSessionSchema = z.object({
  examTemplateId: z.string().uuid(),
  name: z.string().min(1).max(200),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  timezone: z.string().default('UTC'),
  maxCandidates: z.number().int().positive().optional(),
  accessCode: z.string().min(4).max(32).optional(),
});

export const startAttemptSchema = z.object({
  examSessionId: z.string().uuid(),
  accessCode: z.string().optional(),
  invitationToken: z.string().optional(),
  deviceFingerprint: z.string().optional(),
});

export const saveAnswerSchema = z.object({
  questionId: z.string().uuid(),
  response: z.unknown(),
  timeSpentSeconds: z.number().int().min(0).optional(),
});

export const submitAttemptSchema = z.object({
  confirm: z.literal(true),
});

export type CreateExamTemplateInput = z.infer<typeof createExamTemplateSchema>;
export type StartAttemptInput = z.infer<typeof startAttemptSchema>;
export type SaveAnswerInput = z.infer<typeof saveAnswerSchema>;

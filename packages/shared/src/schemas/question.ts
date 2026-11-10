import { z } from 'zod';
import { DIFFICULTIES, QUESTION_TYPES } from '../constants.js';

export const questionTypeSchema = z.enum(QUESTION_TYPES);
export const difficultySchema = z.enum(DIFFICULTIES);

export const createBankSchema = z.object({
  name: z.string().min(1).max(200),
  code: z.string().min(1).max(50).regex(/^[A-Z0-9_-]+$/i),
  description: z.string().max(5000).optional(),
  categoryId: z.string().uuid().optional(),
});

export const createQuestionSchema = z.object({
  bankId: z.string().uuid(),
  topicId: z.string().uuid().optional(),
  code: z.string().min(1).max(50),
  type: questionTypeSchema,
  difficulty: difficultySchema.default('MEDIUM'),
  pointsDefault: z.number().positive().default(1),
  negativeMarking: z.number().min(0).default(0),
  partialScoring: z.boolean().default(false),
  estimatedSeconds: z.number().int().positive().optional(),
  tagIds: z.array(z.string().uuid()).optional(),
  version: z.object({
    languageId: z.string().uuid(),
    stem: z.string().min(1),
    stemFormat: z.enum(['markdown', 'html', 'latex']).default('markdown'),
    latexBlocks: z.array(z.string()).optional(),
    randomVariables: z.record(z.unknown()).optional(),
    hints: z.array(z.string()).optional(),
    solution: z.string().optional(),
    solutionFormat: z.enum(['markdown', 'html', 'latex']).optional(),
    gradingRubric: z.unknown().optional(),
    autoGradeConfig: z.unknown().optional(),
    choices: z
      .array(
        z.object({
          label: z.string().max(10),
          content: z.string().min(1),
          contentFormat: z.enum(['markdown', 'html', 'latex']).default('markdown'),
          isCorrect: z.boolean().default(false),
          weight: z.number().default(0),
          sortOrder: z.number().int().default(0),
          matchKey: z.string().optional(),
          metadata: z.unknown().optional(),
        }),
      )
      .optional(),
  }),
});

export const submitForReviewSchema = z.object({
  notes: z.string().max(2000).optional(),
});

export const reviewQuestionSchema = z.object({
  action: z.enum(['APPROVED', 'REJECTED', 'CHANGES_REQUESTED']),
  notes: z.string().max(2000).optional(),
});

export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;
export type CreateBankInput = z.infer<typeof createBankSchema>;

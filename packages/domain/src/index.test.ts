import { describe, expect, it } from 'vitest';
import {
  aggregateAttemptScore,
  gradeObjectiveAnswer,
  computeCheatingScore,
  facilityIndex,
  discriminationIndex,
  assertAttemptTransition,
} from '../src/index.js';
import { AppError } from '@cbt/shared';

describe('scoring', () => {
  it('aggregates attempt scores', () => {
    const result = aggregateAttemptScore(
      [
        { maxScore: 1, scoreAwarded: 1, isCorrect: true },
        { maxScore: 1, scoreAwarded: 0, isCorrect: false },
      ],
      50,
    );
    expect(result.percent).toBe(50);
    expect(result.passed).toBe(true);
  });
});

describe('grading', () => {
  it('grades multiple choice', () => {
    const graded = gradeObjectiveAnswer({
      type: 'MULTIPLE_CHOICE',
      maxScore: 2,
      negativePoints: 0.5,
      partialScoring: false,
      choices: [
        { id: 'a', isCorrect: true, weight: 1, label: 'A' },
        { id: 'b', isCorrect: false, weight: 0, label: 'B' },
      ],
      response: { choiceId: 'a' },
    });
    expect(graded.isCorrect).toBe(true);
    expect(graded.scoreAwarded).toBe(2);
  });
});

describe('cheating score', () => {
  it('caps at 100', () => {
    const score = computeCheatingScore([
      { type: 'DEVTOOLS_OPEN', severity: 10 },
      { type: 'MULTIPLE_FACES', severity: 10 },
      { type: 'TAB_SWITCH', severity: 10 },
    ]);
    expect(score).toBeLessThanOrEqual(100);
    expect(score).toBeGreaterThan(0);
  });
});

describe('psychometrics', () => {
  it('computes facility and discrimination', () => {
    expect(facilityIndex(8, 10)).toBe(0.8);
    expect(
      discriminationIndex({
        questionId: 'q1',
        correctCount: 8,
        attemptCount: 10,
        highGroupCorrect: 9,
        highGroupSize: 10,
        lowGroupCorrect: 2,
        lowGroupSize: 10,
      }),
    ).toBe(0.7);
  });
});

describe('attempt lifecycle', () => {
  it('rejects invalid transitions', () => {
    expect(() => assertAttemptTransition('GRADED', 'IN_PROGRESS')).toThrow(AppError);
  });
});

export type AutoGradeableType =
  | 'MULTIPLE_CHOICE'
  | 'MULTIPLE_RESPONSE'
  | 'TRUE_FALSE'
  | 'NUMERIC'
  | 'FILL_BLANK'
  | 'MATCHING'
  | 'ORDERING';

export interface ChoiceKey {
  id: string;
  isCorrect: boolean;
  weight: number;
  matchKey?: string | null;
  label: string;
}

export interface GradeResult {
  isCorrect: boolean | null;
  scoreAwarded: number;
  needsReview: boolean;
}

export function gradeObjectiveAnswer(input: {
  type: string;
  maxScore: number;
  negativePoints: number;
  partialScoring: boolean;
  choices: ChoiceKey[];
  response: unknown;
  autoGradeConfig?: Record<string, unknown> | null;
}): GradeResult {
  const { type, maxScore, negativePoints, partialScoring, choices, response, autoGradeConfig } =
    input;

  switch (type) {
    case 'MULTIPLE_CHOICE':
    case 'TRUE_FALSE': {
      const selected = String((response as { choiceId?: string })?.choiceId ?? '');
      const correct = choices.find((c) => c.isCorrect);
      const ok = !!correct && selected === correct.id;
      return {
        isCorrect: ok,
        scoreAwarded: ok ? maxScore : -Math.abs(negativePoints),
        needsReview: false,
      };
    }
    case 'MULTIPLE_RESPONSE': {
      const selected = new Set(
        ((response as { choiceIds?: string[] })?.choiceIds ?? []).map(String),
      );
      const correctIds = choices.filter((c) => c.isCorrect).map((c) => c.id);
      if (!partialScoring) {
        const ok =
          correctIds.length === selected.size && correctIds.every((id) => selected.has(id));
        return {
          isCorrect: ok,
          scoreAwarded: ok ? maxScore : -Math.abs(negativePoints),
          needsReview: false,
        };
      }
      let hits = 0;
      let misses = 0;
      for (const id of selected) {
        if (correctIds.includes(id)) hits += 1;
        else misses += 1;
      }
      const ratio = correctIds.length === 0 ? 0 : Math.max(0, (hits - misses) / correctIds.length);
      return {
        isCorrect: ratio === 1,
        scoreAwarded: round4(maxScore * ratio),
        needsReview: false,
      };
    }
    case 'NUMERIC': {
      const expected = Number(autoGradeConfig?.expected ?? NaN);
      const tolerance = Number(autoGradeConfig?.tolerance ?? 0);
      const value = Number((response as { value?: number })?.value);
      const ok = Number.isFinite(value) && Math.abs(value - expected) <= tolerance;
      return {
        isCorrect: ok,
        scoreAwarded: ok ? maxScore : -Math.abs(negativePoints),
        needsReview: false,
      };
    }
    case 'FILL_BLANK': {
      const answers = ((autoGradeConfig?.answers as string[]) ?? []).map((a) =>
        a.trim().toLowerCase(),
      );
      const value = String((response as { text?: string })?.text ?? '')
        .trim()
        .toLowerCase();
      const ok = answers.includes(value);
      return {
        isCorrect: ok,
        scoreAwarded: ok ? maxScore : -Math.abs(negativePoints),
        needsReview: false,
      };
    }
    case 'ORDERING':
    case 'MATCHING': {
      const expected = (autoGradeConfig?.order as string[]) ?? choices.map((c) => c.id);
      const actual = ((response as { order?: string[] })?.order ?? []).map(String);
      if (!partialScoring) {
        const ok =
          expected.length === actual.length && expected.every((id, i) => id === actual[i]);
        return {
          isCorrect: ok,
          scoreAwarded: ok ? maxScore : -Math.abs(negativePoints),
          needsReview: false,
        };
      }
      let hits = 0;
      for (let i = 0; i < expected.length; i += 1) {
        if (expected[i] === actual[i]) hits += 1;
      }
      const ratio = expected.length === 0 ? 0 : hits / expected.length;
      return {
        isCorrect: ratio === 1,
        scoreAwarded: round4(maxScore * ratio),
        needsReview: false,
      };
    }
    default:
      return { isCorrect: null, scoreAwarded: 0, needsReview: true };
  }
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

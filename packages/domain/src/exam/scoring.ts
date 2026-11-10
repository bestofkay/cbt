export interface ScoreLine {
  maxScore: number;
  scoreAwarded: number;
  isCorrect: boolean | null;
}

export interface AttemptScore {
  totalScore: number;
  maxScore: number;
  percent: number;
  passed: boolean;
}

export function aggregateAttemptScore(
  lines: ScoreLine[],
  passingScorePercent: number,
): AttemptScore {
  const totalScore = lines.reduce((sum, l) => sum + l.scoreAwarded, 0);
  const maxScore = lines.reduce((sum, l) => sum + l.maxScore, 0);
  const percent = maxScore === 0 ? 0 : Math.round((totalScore / maxScore) * 10000) / 100;
  return {
    totalScore: round4(totalScore),
    maxScore: round4(maxScore),
    percent,
    passed: percent >= passingScorePercent,
  };
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

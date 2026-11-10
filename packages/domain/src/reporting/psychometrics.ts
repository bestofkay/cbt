export interface ItemStat {
  questionId: string;
  correctCount: number;
  attemptCount: number;
  highGroupCorrect: number;
  highGroupSize: number;
  lowGroupCorrect: number;
  lowGroupSize: number;
}

export function facilityIndex(correctCount: number, attemptCount: number): number {
  if (attemptCount === 0) return 0;
  return round4(correctCount / attemptCount);
}

export function discriminationIndex(stat: ItemStat): number {
  if (stat.highGroupSize === 0 || stat.lowGroupSize === 0) return 0;
  const high = stat.highGroupCorrect / stat.highGroupSize;
  const low = stat.lowGroupCorrect / stat.lowGroupSize;
  return round4(high - low);
}

export function summarizePsychometrics(stats: ItemStat[]) {
  return stats.map((s) => ({
    questionId: s.questionId,
    facilityIndex: facilityIndex(s.correctCount, s.attemptCount),
    discriminationIndex: discriminationIndex(s),
    attemptCount: s.attemptCount,
  }));
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

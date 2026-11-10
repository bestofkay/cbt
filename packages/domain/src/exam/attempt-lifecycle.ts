import { AppError } from '@cbt/shared';

export type AttemptLifecycleStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'PAUSED'
  | 'SUBMITTED'
  | 'AUTO_SUBMITTED'
  | 'UNDER_REVIEW'
  | 'GRADED'
  | 'VOIDED';

const TRANSITIONS: Record<AttemptLifecycleStatus, AttemptLifecycleStatus[]> = {
  NOT_STARTED: ['IN_PROGRESS', 'VOIDED'],
  IN_PROGRESS: ['PAUSED', 'SUBMITTED', 'AUTO_SUBMITTED', 'VOIDED'],
  PAUSED: ['IN_PROGRESS', 'AUTO_SUBMITTED', 'VOIDED'],
  SUBMITTED: ['UNDER_REVIEW', 'GRADED', 'VOIDED'],
  AUTO_SUBMITTED: ['UNDER_REVIEW', 'GRADED', 'VOIDED'],
  UNDER_REVIEW: ['GRADED', 'VOIDED'],
  GRADED: ['VOIDED'],
  VOIDED: [],
};

export function assertAttemptTransition(
  from: AttemptLifecycleStatus,
  to: AttemptLifecycleStatus,
): void {
  if (!TRANSITIONS[from].includes(to)) {
    throw new AppError(
      'INVALID_ATTEMPT_TRANSITION',
      `Cannot transition attempt from ${from} to ${to}`,
      409,
    );
  }
}

export function canSaveAnswers(status: AttemptLifecycleStatus): boolean {
  return status === 'IN_PROGRESS' || status === 'PAUSED';
}

export function isTerminal(status: AttemptLifecycleStatus): boolean {
  return status === 'GRADED' || status === 'VOIDED';
}

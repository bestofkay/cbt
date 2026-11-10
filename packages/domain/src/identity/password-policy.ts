import { ValidationError } from '@cbt/shared';

const UPPER = /[A-Z]/;
const LOWER = /[a-z]/;
const DIGIT = /[0-9]/;
const SPECIAL = /[^A-Za-z0-9]/;

export function assertPasswordPolicy(password: string): void {
  if (password.length < 12) {
    throw new ValidationError('Password must be at least 12 characters');
  }
  if (password.length > 128) {
    throw new ValidationError('Password must be at most 128 characters');
  }
  if (!UPPER.test(password) || !LOWER.test(password) || !DIGIT.test(password) || !SPECIAL.test(password)) {
    throw new ValidationError(
      'Password must include uppercase, lowercase, digit, and special character',
    );
  }
}

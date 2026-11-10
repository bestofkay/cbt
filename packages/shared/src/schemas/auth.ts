import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email().max(320),
  password: z
    .string()
    .min(12)
    .max(128)
    .regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[a-z]/, 'Must contain lowercase')
    .regex(/[0-9]/, 'Must contain digit')
    .regex(/[^A-Za-z0-9]/, 'Must contain special character'),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone: z.string().max(30).optional(),
  locale: z.string().max(10).default('en'),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  otp: z.string().length(6).optional(),
  rememberDevice: z.boolean().optional(),
  deviceFingerprint: z.string().max(128).optional(),
  deviceName: z.string().max(200).optional(),
});

export const refreshSchema = z.object({
  refreshToken: z.string().optional(),
});

export const passwordResetRequestSchema = z.object({
  email: z.string().email(),
  /** Which web app should receive the reset link */
  portal: z.enum(['admin', 'candidate', 'proctor']).optional(),
});

export const passwordResetConfirmSchema = z.object({
  token: z.string().min(20),
  password: registerSchema.shape.password,
});

export const verifyEmailSchema = z.object({
  token: z.string().min(20),
});

export const enable2faSchema = z.object({
  code: z.string().length(6),
});

export const verify2faSchema = z.object({
  code: z.string().min(6).max(12),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

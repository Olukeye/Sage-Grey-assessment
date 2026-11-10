import { z } from 'zod';

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email('Enter a valid email address.'));

export const registerSchema = z.object({
  email,
  fullName: z.string().trim().min(2, 'Enter your full name.').max(120),
  password: z
    .string()
    .min(8, 'Use at least 8 characters.')
    .max(72, 'Use at most 72 characters.')
    .regex(/[A-Za-z]/, 'Include at least one letter.')
    .regex(/\d/, 'Include at least one number.'),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password.').max(72),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1).max(200),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

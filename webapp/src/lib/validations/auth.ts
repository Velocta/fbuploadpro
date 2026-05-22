import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string()
    .trim()
    .email('Invalid email address')
    .max(255, 'Email is too long')
    .transform((email) => {
      const [local, domain] = email.toLowerCase().split('@')
      if (domain === 'gmail.com') {
        const baseLocal = local.split('+')[0].replace(/\./g, '')
        return `${baseLocal}@${domain}`
      }
      return email.toLowerCase()
    }),
  password: z.string().trim().min(6, 'Password must be at least 6 characters').max(100, 'Password is too long'),
})

export const requestResetSchema = z.object({
  email: z.string()
    .trim()
    .email('Invalid email address')
    .max(255, 'Email is too long')
    .transform((email) => {
      const [local, domain] = email.toLowerCase().split('@')
      if (domain === 'gmail.com') {
        const baseLocal = local.split('+')[0].replace(/\./g, '')
        return `${baseLocal}@${domain}`
      }
      return email.toLowerCase()
    }),
})

export const verifyOtpSchema = z.object({
  email: z.string()
    .trim()
    .email('Invalid email address')
    .max(255, 'Email is too long')
    .transform((email) => {
      const [local, domain] = email.toLowerCase().split('@')
      if (domain === 'gmail.com') {
        const baseLocal = local.split('+')[0].replace(/\./g, '')
        return `${baseLocal}@${domain}`
      }
      return email.toLowerCase()
    }),
  token: z.string().trim().length(6, 'OTP must be exactly 6 digits'),
})

export const updatePasswordSchema = z.object({
  password: z.string().trim().min(6, 'Password must be at least 6 characters').max(100, 'Password is too long'),
})

export const signupSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100, 'Name is too long'),
  phone_number: z.string()
    .trim()
    .regex(/^\+[1-9]\d{7,14}$/, 'Phone number must include a valid country code (e.g. +923001234567)'),
  email: z.string()
    .trim()
    .email('Invalid email address')
    .max(255, 'Email is too long')
    .refine((email) => email.toLowerCase().endsWith('@gmail.com'), {
      message: 'Only @gmail.com addresses are allowed',
    })
    .transform((email) => {
      const [local, domain] = email.toLowerCase().split('@')
      if (domain === 'gmail.com') {
        const baseLocal = local.split('+')[0].replace(/\./g, '')
        return `${baseLocal}@${domain}`
      }
      return email.toLowerCase()
    }),
  password: z.string().trim().min(6, 'Password must be at least 6 characters').max(100, 'Password is too long'),
})

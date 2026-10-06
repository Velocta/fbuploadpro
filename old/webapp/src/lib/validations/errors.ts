import type { ZodError } from 'zod'

export function zodErrorMessage(error: ZodError): string {
  return error.issues.at(0)?.message ?? 'Validation failed'
}

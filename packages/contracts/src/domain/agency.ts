import { z } from 'zod';

export const RESERVED_SUBDOMAINS = [
  'api', 'app', 'admin', 'www', 'billing', 'support', 'status',
  'auth', 'mail', 'dashboard', 'preview', 'staging', 'test',
] as const;

export const SubdomainSchema = z
  .string()
  .min(2)
  .max(50)
  .regex(
    /^[a-z0-9]([a-z0-9-]{0,48}[a-z0-9])?$/,
    'Subdomain must be lowercase alphanumeric and may contain hyphens, but cannot start or end with a hyphen.'
  )
  .refine(
    (val) => !RESERVED_SUBDOMAINS.includes(val as (typeof RESERVED_SUBDOMAINS)[number]),
    { message: 'Subdomain is reserved by the platform.' }
  );

export const AgencyStatusSchema = z.enum(['active', 'suspended', 'trial']);
export type AgencyStatus = z.infer<typeof AgencyStatusSchema>;

export const AgencySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2).max(100),
  subdomain: SubdomainSchema,
  status: AgencyStatusSchema,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Agency = z.infer<typeof AgencySchema>;

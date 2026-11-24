import { z } from 'zod';

export const AtsProviderSchema = z.enum(['greenhouse', 'lever', 'ashby', 'smartrecruiters']);
export type AtsProvider = z.infer<typeof AtsProviderSchema>;

export interface BoardTarget {
  provider: AtsProvider;
  companySlug: string;
}

const PROVIDER_URL_PATTERNS: Array<{ provider: AtsProvider; regex: RegExp }> = [
  {
    provider: 'greenhouse',
    regex: /^https?:\/\/(?:boards|job-boards)\.greenhouse\.io\/([a-zA-Z0-9._-]+)/i,
  },
  {
    provider: 'lever',
    regex: /^https?:\/\/jobs\.lever\.co\/([a-zA-Z0-9._-]+)/i,
  },
  {
    provider: 'ashby',
    regex: /^https?:\/\/jobs\.ashbyhq\.com\/([a-zA-Z0-9._-]+)/i,
  },
  {
    provider: 'smartrecruiters',
    regex: /^https?:\/\/jobs\.smartrecruiters\.com\/([a-zA-Z0-9._-]+)/i,
  },
];

/**
 * Parses a board identifier in `provider:slug` format or a public ATS board URL.
 */
export function parseBoardTarget(raw: string): BoardTarget {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new Error('Board target cannot be empty.');
  }

  for (const { provider, regex } of PROVIDER_URL_PATTERNS) {
    const match = trimmed.match(regex);
    const slug = match?.[1];
    if (slug) {
      return { provider, companySlug: slug };
    }
  }

  const colonIdx = trimmed.indexOf(':');
  if (colonIdx > 0) {
    const rawProvider = trimmed.slice(0, colonIdx).toLowerCase();
    const companySlug = trimmed.slice(colonIdx + 1).trim();
    const parsedProvider = AtsProviderSchema.safeParse(rawProvider);
    if (parsedProvider.success && /^[a-zA-Z0-9._-]+$/.test(companySlug)) {
      return {
        provider: parsedProvider.data,
        companySlug,
      };
    }
  }

  throw new Error(
    `Invalid board target "${raw}". Expected "provider:slug" (greenhouse|lever|ashby|smartrecruiters) or a supported ATS board URL.`,
  );
}

export const ActorInputSchema = z.object({
  boards: z.array(z.string().trim().min(1)).default([]),
  keywords: z.array(z.string().trim().min(1)).default([]),
  locations: z.array(z.string().trim().min(1)).default([]),
  departments: z.array(z.string().trim().min(1)).default([]),
  remoteOnly: z.boolean().default(false),
  postedAfter: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'postedAfter must be YYYY-MM-DD')
    .optional(),
  includeDescription: z.boolean().default(false),
  maxItems: z.number().int().min(1).max(2000).default(100),
});

export type ActorInput = z.infer<typeof ActorInputSchema>;

export interface ParsedActorInput extends ActorInput {
  targets: BoardTarget[];
}

/**
 * Validates raw Actor/MCP input and parses deduplicated ATS board targets.
 */
export function parseActorInput(raw: unknown): ParsedActorInput {
  const parsed = ActorInputSchema.parse(raw ?? {});
  const seen = new Set<string>();
  const targets: BoardTarget[] = [];

  for (const rawBoard of parsed.boards) {
    const target = parseBoardTarget(rawBoard);
    const dedupeKey = `${target.provider}:${target.companySlug.toLowerCase()}`;
    if (!seen.has(dedupeKey)) {
      seen.add(dedupeKey);
      targets.push(target);
    }
  }

  return {
    ...parsed,
    targets,
  };
}

export const WorkplaceTypeSchema = z.enum(['remote', 'hybrid', 'onsite', 'unknown']);
export type WorkplaceType = z.infer<typeof WorkplaceTypeSchema>;

export const SenioritySchema = z.enum([
  'intern',
  'junior',
  'mid',
  'senior',
  'staff',
  'lead',
  'executive',
  'unknown',
]);
export type Seniority = z.infer<typeof SenioritySchema>;

export const NormalizedJobSchema = z.object({
  jobId: z.string().min(1),
  provider: AtsProviderSchema,
  companySlug: z.string().min(1),
  companyName: z.string().min(1),
  title: z.string().min(1),
  department: z.string().nullable(),
  location: z.string(),
  workplaceType: WorkplaceTypeSchema,
  isRemote: z.boolean(),
  employmentType: z.string().nullable(),
  seniority: SenioritySchema,
  salaryMin: z.number().nullable(),
  salaryMax: z.number().nullable(),
  salaryCurrency: z.string().nullable(),
  postedAt: z.string().nullable(),
  jobUrl: z.string().url(),
  applyUrl: z.string().url().nullable(),
  description: z.string().nullable(),
});

export type NormalizedJob = z.infer<typeof NormalizedJobSchema>;

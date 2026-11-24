import type { NormalizedJob, Seniority, WorkplaceType } from './job-schema.js';

const ENTITY_MAP: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
};

/**
 * Decodes common HTML entities, strips tags, and collapses whitespace.
 */
export function stripHtml(input: string): string {
  const decoded = input.replace(
    /&(?:amp|lt|gt|quot|#39|apos|nbsp);/gi,
    (entity) => ENTITY_MAP[entity.toLowerCase()] ?? entity,
  );
  return decoded
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes ISO date strings or epoch timestamps (ms) to YYYY-MM-DD.
 */
export function toIsoDate(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const date = typeof value === 'number' ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

/**
 * Infers standardized seniority level from job title and optional ATS experience level.
 */
export function inferSeniority(title: string, experienceLevel?: string | null): Seniority {
  const combined = `${title} ${experienceLevel ?? ''}`.toLowerCase();

  if (/\b(intern|internship|co-op|coop|trainee)\b/.test(combined)) {
    return 'intern';
  }
  if (/\b(chief|ceo|cto|cfo|coo|cpo|cmo|cro|vp|vice president|head of|director)\b/.test(combined)) {
    return 'executive';
  }
  if (/\b(staff|principal|distinguished|fellow)\b/.test(combined)) {
    return 'staff';
  }
  if (/\b(lead|manager|engineering manager|tech lead|team lead)\b/.test(combined)) {
    return 'lead';
  }
  if (/\b(senior|sr\.?|iii|iv)\b/.test(combined)) {
    return 'senior';
  }
  if (/\b(junior|jr\.?|entry[- ]level|graduate|associate|intern)\b/.test(combined)) {
    return 'junior';
  }
  if (/\b(mid[- ]level|intermediate|ii)\b/.test(combined)) {
    return 'mid';
  }

  return 'unknown';
}

/**
 * Infers workplaceType and isRemote flag from explicit ATS flags and location text.
 */
export function inferWorkplaceType(
  rawType?: string | null,
  isRemoteFlag?: boolean | null,
  location?: string | null,
): { workplaceType: WorkplaceType; isRemote: boolean } {
  const typeText = (rawType ?? '').toLowerCase();
  const locText = (location ?? '').toLowerCase();

  if (isRemoteFlag === true || typeText.includes('remote') || locText.includes('remote')) {
    if (typeText.includes('hybrid') || locText.includes('hybrid')) {
      return { workplaceType: 'hybrid', isRemote: true };
    }
    return { workplaceType: 'remote', isRemote: true };
  }

  if (typeText.includes('hybrid') || locText.includes('hybrid')) {
    return { workplaceType: 'hybrid', isRemote: false };
  }

  if (
    typeText.includes('onsite') ||
    typeText.includes('on-site') ||
    typeText.includes('in-office') ||
    isRemoteFlag === false
  ) {
    return { workplaceType: 'onsite', isRemote: false };
  }

  return { workplaceType: 'unknown', isRemote: false };
}

const CURRENCY_SYMBOL_MAP: Record<string, string> = {
  $: 'USD',
  '€': 'EUR',
  '£': 'GBP',
};

function parseSalaryNumber(raw: string, hasK: boolean): number {
  const numeric = Number(raw.replaceAll(',', ''));
  return Math.round(hasK ? numeric * 1000 : numeric);
}

/**
 * Extracts annual salary range and currency from free-form text when structured compensation is absent.
 */
export function extractSalaryFromText(text: string): {
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
} {
  if (!text) {
    return { salaryMin: null, salaryMax: null, salaryCurrency: null };
  }

  const rangeMatch = text.match(
    /([$€£])\s*(\d{2,3}(?:,\d{3})+|\d{2,3})\s*(k)?\s*(?:-|–|—|to)\s*(?:[$€£]\s*)?(\d{2,3}(?:,\d{3})+|\d{2,3})\s*(k)?/i,
  );

  if (rangeMatch) {
    const symbol = rangeMatch[1] ?? '$';
    const minRaw = rangeMatch[2];
    const minK = Boolean(rangeMatch[3]);
    const maxRaw = rangeMatch[4];
    const maxK = Boolean(rangeMatch[5]);

    if (minRaw && maxRaw) {
      const salaryMin = parseSalaryNumber(minRaw, minK || (maxK && minRaw.length <= 3));
      const salaryMax = parseSalaryNumber(maxRaw, maxK);
      if (salaryMin >= 15000 && salaryMax >= salaryMin) {
        return {
          salaryMin,
          salaryMax,
          salaryCurrency: CURRENCY_SYMBOL_MAP[symbol] ?? 'USD',
        };
      }
    }
  }

  return { salaryMin: null, salaryMax: null, salaryCurrency: null };
}

function formatCompanySlug(slug: string): string {
  return slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

interface GreenhouseJobRaw {
  id?: string | number;
  title?: string;
  company_name?: string;
  absolute_url?: string;
  location?: { name?: string };
  departments?: Array<{ name?: string }>;
  first_published?: string | null;
  updated_at?: string | null;
  content?: string | null;
}

export function parseGreenhouseResponse(
  payload: unknown,
  companySlug: string,
  includeDescription: boolean,
): NormalizedJob[] {
  const jobsRaw = (payload as { jobs?: GreenhouseJobRaw[] } | null)?.jobs;
  if (!Array.isArray(jobsRaw)) {
    return [];
  }

  const results: NormalizedJob[] = [];

  for (const job of jobsRaw) {
    if (job.id === undefined || !job.title || !job.absolute_url) {
      continue;
    }

    const rawId = String(job.id);
    const location = job.location?.name?.trim() || 'Unspecified';
    const department = job.departments?.[0]?.name?.trim() || null;
    const plainContent = job.content ? stripHtml(job.content) : '';
    const salary = extractSalaryFromText(plainContent);
    const workplace = inferWorkplaceType(null, null, location);

    results.push({
      jobId: `greenhouse:${companySlug}:${rawId}`,
      provider: 'greenhouse',
      companySlug,
      companyName: job.company_name?.trim() || formatCompanySlug(companySlug),
      title: job.title.trim(),
      department,
      location,
      workplaceType: workplace.workplaceType,
      isRemote: workplace.isRemote,
      employmentType: null,
      seniority: inferSeniority(job.title),
      salaryMin: salary.salaryMin,
      salaryMax: salary.salaryMax,
      salaryCurrency: salary.salaryCurrency,
      postedAt: toIsoDate(job.first_published ?? job.updated_at),
      jobUrl: job.absolute_url,
      applyUrl: job.absolute_url,
      description: includeDescription && plainContent.length > 0 ? plainContent : null,
    });
  }

  return results;
}

interface LeverJobRaw {
  id?: string;
  text?: string;
  hostedUrl?: string;
  applyUrl?: string;
  workplaceType?: string;
  createdAt?: number;
  categories?: {
    commitment?: string;
    department?: string;
    location?: string;
    team?: string;
  };
  descriptionPlain?: string;
  additionalPlain?: string;
}

export function parseLeverResponse(
  payload: unknown,
  companySlug: string,
  includeDescription: boolean,
): NormalizedJob[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  const results: NormalizedJob[] = [];

  for (const job of payload as LeverJobRaw[]) {
    if (!job.id || !job.text || !job.hostedUrl) {
      continue;
    }

    const location = job.categories?.location?.trim() || 'Unspecified';
    const department = job.categories?.department?.trim() || job.categories?.team?.trim() || null;
    const combinedText = [job.descriptionPlain ?? '', job.additionalPlain ?? '']
      .filter(Boolean)
      .join(' ')
      .trim();
    const salary = extractSalaryFromText(combinedText);
    const workplace = inferWorkplaceType(job.workplaceType, null, location);

    results.push({
      jobId: `lever:${companySlug}:${job.id}`,
      provider: 'lever',
      companySlug,
      companyName: formatCompanySlug(companySlug),
      title: job.text.trim(),
      department,
      location,
      workplaceType: workplace.workplaceType,
      isRemote: workplace.isRemote,
      employmentType: job.categories?.commitment?.trim() || null,
      seniority: inferSeniority(job.text),
      salaryMin: salary.salaryMin,
      salaryMax: salary.salaryMax,
      salaryCurrency: salary.salaryCurrency,
      postedAt: toIsoDate(job.createdAt),
      jobUrl: job.hostedUrl,
      applyUrl: job.applyUrl ?? job.hostedUrl,
      description: includeDescription && combinedText.length > 0 ? combinedText : null,
    });
  }

  return results;
}

interface AshbyCompensationComponent {
  compensationType?: string;
  currencyCode?: string;
  minValue?: number | null;
  maxValue?: number | null;
}

interface AshbyJobRaw {
  id?: string;
  title?: string;
  department?: string | null;
  team?: string | null;
  employmentType?: string | null;
  location?: string | null;
  publishedAt?: string | null;
  isListed?: boolean;
  isRemote?: boolean | null;
  workplaceType?: string | null;
  jobUrl?: string;
  applyUrl?: string | null;
  descriptionPlain?: string | null;
  compensation?: {
    summaryComponents?: AshbyCompensationComponent[];
  } | null;
}

export function parseAshbyResponse(
  payload: unknown,
  companySlug: string,
  includeDescription: boolean,
): NormalizedJob[] {
  const jobsRaw = (payload as { jobs?: AshbyJobRaw[] } | null)?.jobs;
  if (!Array.isArray(jobsRaw)) {
    return [];
  }

  const results: NormalizedJob[] = [];

  for (const job of jobsRaw) {
    if (job.isListed === false || !job.id || !job.title || !job.jobUrl) {
      continue;
    }

    const location = job.location?.trim() || 'Unspecified';
    const department = job.department?.trim() || job.team?.trim() || null;
    const workplace = inferWorkplaceType(job.workplaceType, job.isRemote, location);

    const salaryComp = job.compensation?.summaryComponents?.find(
      (c) => c.compensationType?.toLowerCase() === 'salary',
    );
    const plainDesc = job.descriptionPlain?.trim() || '';
    const fallbackSalary = extractSalaryFromText(plainDesc);

    const salaryMin = salaryComp?.minValue ?? fallbackSalary.salaryMin;
    const salaryMax = salaryComp?.maxValue ?? fallbackSalary.salaryMax;
    const salaryCurrency =
      salaryMin !== null || salaryMax !== null
        ? (salaryComp?.currencyCode ?? fallbackSalary.salaryCurrency ?? 'USD')
        : null;

    results.push({
      jobId: `ashby:${companySlug}:${job.id}`,
      provider: 'ashby',
      companySlug,
      companyName: formatCompanySlug(companySlug),
      title: job.title.trim(),
      department,
      location,
      workplaceType: workplace.workplaceType,
      isRemote: workplace.isRemote,
      employmentType: job.employmentType?.trim() || null,
      seniority: inferSeniority(job.title),
      salaryMin,
      salaryMax,
      salaryCurrency,
      postedAt: toIsoDate(job.publishedAt),
      jobUrl: job.jobUrl,
      applyUrl: job.applyUrl ?? job.jobUrl,
      description: includeDescription && plainDesc.length > 0 ? plainDesc : null,
    });
  }

  return results;
}

interface SmartRecruitersPostingRaw {
  id?: string;
  name?: string;
  releasedDate?: string;
  company?: {
    identifier?: string;
    name?: string;
  };
  location?: {
    city?: string;
    country?: string;
    remote?: boolean;
    hybrid?: boolean;
    fullLocation?: string;
  };
  department?: { label?: string };
  function?: { label?: string };
  typeOfEmployment?: { label?: string };
  experienceLevel?: { label?: string };
}

export function parseSmartRecruitersResponse(
  payload: unknown,
  companySlug: string,
): NormalizedJob[] {
  const postings = (payload as { content?: SmartRecruitersPostingRaw[] } | null)?.content;
  if (!Array.isArray(postings)) {
    return [];
  }

  const results: NormalizedJob[] = [];

  for (const job of postings) {
    if (!job.id || !job.name) {
      continue;
    }

    const companyId = job.company?.identifier?.trim() || companySlug;
    const companyName = job.company?.name?.trim() || formatCompanySlug(companyId);
    const location =
      job.location?.fullLocation?.trim() ||
      [job.location?.city, job.location?.country?.toUpperCase()].filter(Boolean).join(', ') ||
      'Unspecified';

    const workplace = inferWorkplaceType(
      job.location?.hybrid ? 'hybrid' : null,
      job.location?.remote ?? null,
      location,
    );

    const jobUrl = `https://jobs.smartrecruiters.com/${companyId}/${job.id}`;

    results.push({
      jobId: `smartrecruiters:${companySlug}:${job.id}`,
      provider: 'smartrecruiters',
      companySlug,
      companyName,
      title: job.name.trim(),
      department: job.department?.label?.trim() || job.function?.label?.trim() || null,
      location,
      workplaceType: workplace.workplaceType,
      isRemote: workplace.isRemote,
      employmentType: job.typeOfEmployment?.label?.trim() || null,
      seniority: inferSeniority(job.name, job.experienceLevel?.label),
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: null,
      postedAt: toIsoDate(job.releasedDate),
      jobUrl,
      applyUrl: jobUrl,
      description: null,
    });
  }

  return results;
}

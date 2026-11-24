import type { ActorInput, NormalizedJob } from './job-schema.js';

export interface HiringSignalsSummary {
  totalJobs: number;
  remoteJobs: number;
  remoteRatio: number;
  salaryDisclosedJobs: number;
  byCompany: Record<string, number>;
  byDepartment: Record<string, number>;
  bySeniority: Record<string, number>;
}

/**
 * Deduplicates by jobId, applies keyword/location/department/remote/date filters,
 * sorts newest-first, and enforces maxItems.
 */
export function filterAndDeduplicateJobs(
  jobs: NormalizedJob[],
  criteria: Pick<
    ActorInput,
    'keywords' | 'locations' | 'departments' | 'remoteOnly' | 'postedAfter' | 'maxItems'
  >,
): NormalizedJob[] {
  const seen = new Set<string>();
  const keywordsLower = criteria.keywords.map((k) => k.toLowerCase());
  const locationsLower = criteria.locations.map((l) => l.toLowerCase());
  const departmentsLower = criteria.departments.map((d) => d.toLowerCase());

  const filtered: NormalizedJob[] = [];

  for (const job of jobs) {
    if (seen.has(job.jobId)) {
      continue;
    }
    seen.add(job.jobId);

    if (criteria.remoteOnly && !job.isRemote) {
      continue;
    }

    if (criteria.postedAfter !== undefined) {
      if (job.postedAt === null || job.postedAt < criteria.postedAfter) {
        continue;
      }
    }

    if (keywordsLower.length > 0) {
      const searchable = `${job.title} ${job.department ?? ''} ${job.description ?? ''}`.toLowerCase();
      if (!keywordsLower.some((kw) => searchable.includes(kw))) {
        continue;
      }
    }

    if (locationsLower.length > 0) {
      const locLower = job.location.toLowerCase();
      if (!locationsLower.some((loc) => locLower.includes(loc))) {
        continue;
      }
    }

    if (departmentsLower.length > 0) {
      const deptLower = (job.department ?? '').toLowerCase();
      if (!departmentsLower.some((dept) => deptLower.includes(dept))) {
        continue;
      }
    }

    filtered.push(job);
  }

  filtered.sort((a, b) => {
    if (a.postedAt === b.postedAt) {
      return a.jobId.localeCompare(b.jobId);
    }
    if (a.postedAt === null) {
      return 1;
    }
    if (b.postedAt === null) {
      return -1;
    }
    return b.postedAt.localeCompare(a.postedAt);
  });

  return filtered.slice(0, criteria.maxItems);
}

/**
 * Computes B2B hiring intent aggregations across normalized jobs.
 */
export function summarizeHiringSignals(jobs: NormalizedJob[]): HiringSignalsSummary {
  const byCompany: Record<string, number> = {};
  const byDepartment: Record<string, number> = {};
  const bySeniority: Record<string, number> = {};

  let remoteJobs = 0;
  let salaryDisclosedJobs = 0;

  for (const job of jobs) {
    if (job.isRemote) {
      remoteJobs += 1;
    }
    if (job.salaryMin !== null || job.salaryMax !== null) {
      salaryDisclosedJobs += 1;
    }

    byCompany[job.companyName] = (byCompany[job.companyName] ?? 0) + 1;
    const dept = job.department ?? 'Unspecified';
    byDepartment[dept] = (byDepartment[dept] ?? 0) + 1;
    bySeniority[job.seniority] = (bySeniority[job.seniority] ?? 0) + 1;
  }

  const totalJobs = jobs.length;
  const remoteRatio = totalJobs > 0 ? Number((remoteJobs / totalJobs).toFixed(2)) : 0;

  return {
    totalJobs,
    remoteJobs,
    remoteRatio,
    salaryDisclosedJobs,
    byCompany,
    byDepartment,
    bySeniority,
  };
}

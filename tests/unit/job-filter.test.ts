import { describe, expect, it } from 'vitest';
import { filterAndDeduplicateJobs, summarizeHiringSignals } from '../../src/domain/job-filter.js';
import type { NormalizedJob } from '../../src/domain/job-schema.js';

const SAMPLE_JOBS: NormalizedJob[] = [
  {
    jobId: 'greenhouse:stripe:1',
    provider: 'greenhouse',
    companySlug: 'stripe',
    companyName: 'Stripe',
    title: 'Senior AI Infrastructure Engineer',
    department: 'Engineering',
    location: 'Remote - US',
    workplaceType: 'remote',
    isRemote: true,
    employmentType: 'FullTime',
    seniority: 'senior',
    salaryMin: 200000,
    salaryMax: 260000,
    salaryCurrency: 'USD',
    postedAt: '2026-11-20',
    jobUrl: 'https://stripe.com/jobs/1',
    applyUrl: null,
    description: null,
  },
  {
    jobId: 'greenhouse:stripe:1',
    provider: 'greenhouse',
    companySlug: 'stripe',
    companyName: 'Stripe',
    title: 'Senior AI Infrastructure Engineer',
    department: 'Engineering',
    location: 'Remote - US',
    workplaceType: 'remote',
    isRemote: true,
    employmentType: 'FullTime',
    seniority: 'senior',
    salaryMin: 200000,
    salaryMax: 260000,
    salaryCurrency: 'USD',
    postedAt: '2026-11-20',
    jobUrl: 'https://stripe.com/jobs/1',
    applyUrl: null,
    description: null,
  },
  {
    jobId: 'lever:spotify:2',
    provider: 'lever',
    companySlug: 'spotify',
    companyName: 'Spotify',
    title: 'Head of Enterprise Sales',
    department: 'Sales',
    location: 'London, UK',
    workplaceType: 'hybrid',
    isRemote: false,
    employmentType: 'Permanent',
    seniority: 'executive',
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    postedAt: '2026-11-22',
    jobUrl: 'https://jobs.lever.co/spotify/2',
    applyUrl: null,
    description: null,
  },
];

describe('filterAndDeduplicateJobs', () => {
  it('deduplicates by jobId and sorts newest-first', () => {
    const result = filterAndDeduplicateJobs(SAMPLE_JOBS, {
      keywords: [],
      locations: [],
      departments: [],
      remoteOnly: false,
      maxItems: 50,
    });

    expect(result.map((j) => j.jobId)).toEqual(['lever:spotify:2', 'greenhouse:stripe:1']);
  });

  it('filters by remoteOnly, keywords, locations, and postedAfter', () => {
    const result = filterAndDeduplicateJobs(SAMPLE_JOBS, {
      keywords: ['ai'],
      locations: ['us'],
      departments: ['engineering'],
      remoteOnly: true,
      postedAfter: '2026-11-19',
      maxItems: 50,
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.jobId).toBe('greenhouse:stripe:1');
  });
});

describe('summarizeHiringSignals', () => {
  it('computes remote ratio, salary disclosure count, and breakdowns', () => {
    const deduped = filterAndDeduplicateJobs(SAMPLE_JOBS, {
      keywords: [],
      locations: [],
      departments: [],
      remoteOnly: false,
      maxItems: 50,
    });

    expect(summarizeHiringSignals(deduped)).toEqual({
      totalJobs: 2,
      remoteJobs: 1,
      remoteRatio: 0.5,
      salaryDisclosedJobs: 1,
      byCompany: { Spotify: 1, Stripe: 1 },
      byDepartment: { Sales: 1, Engineering: 1 },
      bySeniority: { executive: 1, senior: 1 },
    });
  });
});

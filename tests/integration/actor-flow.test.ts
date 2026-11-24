import { describe, expect, it } from 'vitest';
import { runJobExtraction, type AtsBillingEvent } from '../../src/adapters/apify-actor.js';
import type { NormalizedJob } from '../../src/domain/job-schema.js';
import type { JobSource } from '../../src/ports/job-source.js';
import type { BillingMeter } from '../../src/shared/billing-meter.js';

const fakeSource: JobSource = {
  async fetchBoardJobs(target) {
    return [
      {
        jobId: `${target.provider}:${target.companySlug}:1`,
        provider: target.provider,
        companySlug: target.companySlug,
        companyName: target.companySlug,
        title: 'Senior AI Engineer',
        department: 'Engineering',
        location: 'Remote',
        workplaceType: 'remote',
        isRemote: true,
        employmentType: 'FullTime',
        seniority: 'senior',
        salaryMin: 180000,
        salaryMax: 240000,
        salaryCurrency: 'USD',
        postedAt: '2026-11-20',
        jobUrl: 'https://example.com/job/1',
        applyUrl: null,
        description: null,
      },
    ];
  },
};

describe('runJobExtraction (Batch Actor Flow)', () => {
  it('pushes normalized jobs and charges job-extracted PPE events', async () => {
    const pushed: NormalizedJob[] = [];
    const charges: Array<{ eventName: AtsBillingEvent; count: number }> = [];

    const billing: BillingMeter<AtsBillingEvent> = {
      async charge(eventName, count = 1) {
        charges.push({ eventName, count });
      },
    };

    const result = await runJobExtraction(
      {
        boards: ['greenhouse:stripe', 'ashby:openai'],
        remoteOnly: true,
        maxItems: 10,
      },
      {
        source: fakeSource,
        billing,
        pushData: async (items) => {
          pushed.push(...items);
        },
      },
    );

    expect(result).toHaveLength(2);
    expect(pushed).toHaveLength(2);
    expect(charges).toEqual([{ eventName: 'job-extracted', count: 2 }]);
  });

  it('does not push or charge when boards list is empty', async () => {
    const pushed: NormalizedJob[] = [];
    const charges: Array<{ eventName: AtsBillingEvent; count: number }> = [];

    const result = await runJobExtraction(
      { boards: [] },
      {
        source: fakeSource,
        billing: {
          async charge(eventName, count = 1) {
            charges.push({ eventName, count });
          },
        },
        pushData: async (items) => {
          pushed.push(...items);
        },
      },
    );

    expect(result).toEqual([]);
    expect(pushed).toEqual([]);
    expect(charges).toEqual([]);
  });
});

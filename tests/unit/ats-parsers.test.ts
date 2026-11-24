import { describe, expect, it } from 'vitest';
import {
  extractSalaryFromText,
  inferSeniority,
  parseAshbyResponse,
  parseGreenhouseResponse,
  parseLeverResponse,
  parseSmartRecruitersResponse,
  stripHtml,
} from '../../src/domain/ats-parsers.js';

describe('ATS pure helpers', () => {
  it('strips HTML entities and tags cleanly', () => {
    expect(stripHtml('&lt;h2&gt;Hello &amp; Welcome&lt;/h2&gt;&lt;p&gt;Stripe&lt;/p&gt;')).toBe(
      'Hello & Welcome Stripe',
    );
  });

  it('extracts salary ranges from text', () => {
    expect(extractSalaryFromText('Base range is $87,069-$124,385 plus equity.')).toEqual({
      salaryMin: 87069,
      salaryMax: 124385,
      salaryCurrency: 'USD',
    });
    expect(extractSalaryFromText('Compensation: €60k - €85k')).toEqual({
      salaryMin: 60000,
      salaryMax: 85000,
      salaryCurrency: 'EUR',
    });
  });

  it('infers seniority from titles', () => {
    expect(inferSeniority('Head of Sales')).toBe('executive');
    expect(inferSeniority('Staff Infrastructure Engineer')).toBe('staff');
    expect(inferSeniority('Senior Backend Engineer')).toBe('senior');
    expect(inferSeniority('Software Engineering Intern')).toBe('intern');
  });
});

describe('ATS response parsers', () => {
  it('parses Greenhouse jobs', () => {
    const payload = {
      jobs: [
        {
          id: 8172510,
          title: 'Senior Platform Engineer',
          company_name: 'Stripe',
          absolute_url: 'https://stripe.com/jobs/search?gh_jid=8172510',
          location: { name: 'Remote - US' },
          departments: [{ name: 'Engineering' }],
          first_published: '2026-11-10T10:00:00-04:00',
          content: '&lt;p&gt;Salary $180,000 - $220,000&lt;/p&gt;',
        },
      ],
    };

    const jobs = parseGreenhouseResponse(payload, 'stripe', true);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      jobId: 'greenhouse:stripe:8172510',
      provider: 'greenhouse',
      companyName: 'Stripe',
      department: 'Engineering',
      isRemote: true,
      workplaceType: 'remote',
      seniority: 'senior',
      salaryMin: 180000,
      salaryMax: 220000,
      salaryCurrency: 'USD',
      postedAt: '2026-11-10',
      description: 'Salary $180,000 - $220,000',
    });
  });

  it('parses Lever jobs with epoch timestamp and additionalPlain salary', () => {
    const payload = [
      {
        id: 'lev-1',
        text: 'Lead Product Manager',
        hostedUrl: 'https://jobs.lever.co/spotify/lev-1',
        applyUrl: 'https://jobs.lever.co/spotify/lev-1/apply',
        workplaceType: 'hybrid',
        createdAt: Date.UTC(2026, 10, 15, 12, 0, 0),
        categories: {
          commitment: 'Permanent',
          department: 'Product',
          location: 'New York, NY',
        },
        descriptionPlain: 'Build audio tools.',
        additionalPlain: 'The US base range is $150,000-$190,000.',
      },
    ];

    const jobs = parseLeverResponse(payload, 'spotify', false);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      jobId: 'lever:spotify:lev-1',
      provider: 'lever',
      companyName: 'Spotify',
      department: 'Product',
      workplaceType: 'hybrid',
      isRemote: false,
      seniority: 'lead',
      salaryMin: 150000,
      salaryMax: 190000,
      salaryCurrency: 'USD',
      postedAt: '2026-11-15',
      description: null,
    });
  });

  it('parses Ashby jobs, skips unlisted, and reads summaryComponents compensation', () => {
    const payload = {
      jobs: [
        {
          id: 'ash-hidden',
          title: 'Hidden Role',
          isListed: false,
          jobUrl: 'https://jobs.ashbyhq.com/openai/ash-hidden',
        },
        {
          id: 'ash-1',
          title: 'Technical Program Manager, Compute Infrastructure',
          department: 'Technical Program Management',
          employmentType: 'FullTime',
          location: 'San Francisco',
          publishedAt: '2026-11-05T02:20:02.702+00:00',
          isListed: true,
          isRemote: true,
          workplaceType: 'Hybrid',
          jobUrl: 'https://jobs.ashbyhq.com/openai/ash-1',
          applyUrl: 'https://jobs.ashbyhq.com/openai/ash-1/application',
          compensation: {
            summaryComponents: [
              {
                compensationType: 'Salary',
                currencyCode: 'USD',
                minValue: 207000,
                maxValue: 285000,
              },
            ],
          },
        },
      ],
    };

    const jobs = parseAshbyResponse(payload, 'openai', false);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      jobId: 'ashby:openai:ash-1',
      provider: 'ashby',
      isRemote: true,
      workplaceType: 'hybrid',
      salaryMin: 207000,
      salaryMax: 285000,
      salaryCurrency: 'USD',
      postedAt: '2026-11-05',
    });
  });

  it('parses SmartRecruiters postings', () => {
    const payload = {
      content: [
        {
          id: '744000163399093',
          name: 'Power Electronics Engineer',
          releasedDate: '2026-11-24T08:23:19.581Z',
          company: { identifier: 'BoschGroup', name: 'Bosch Group' },
          location: { fullLocation: 'Shanghai, China', remote: false, hybrid: false },
          function: { label: 'Engineering' },
          typeOfEmployment: { label: 'Full-time' },
          experienceLevel: { label: 'Associate' },
        },
      ],
    };

    const jobs = parseSmartRecruitersResponse(payload, 'BoschGroup');
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      jobId: 'smartrecruiters:BoschGroup:744000163399093',
      provider: 'smartrecruiters',
      companyName: 'Bosch Group',
      department: 'Engineering',
      workplaceType: 'onsite',
      isRemote: false,
      seniority: 'junior',
      postedAt: '2026-11-24',
      jobUrl: 'https://jobs.smartrecruiters.com/BoschGroup/744000163399093',
    });
  });
});

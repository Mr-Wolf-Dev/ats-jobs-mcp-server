import { describe, expect, it } from 'vitest';
import { parseActorInput, parseBoardTarget } from '../../src/domain/job-schema.js';

describe('parseBoardTarget', () => {
  it('parses provider:slug format for all 4 ATS providers', () => {
    expect(parseBoardTarget('greenhouse:stripe')).toEqual({
      provider: 'greenhouse',
      companySlug: 'stripe',
    });
    expect(parseBoardTarget('LEVER:spotify')).toEqual({
      provider: 'lever',
      companySlug: 'spotify',
    });
    expect(parseBoardTarget('ashby:openai')).toEqual({
      provider: 'ashby',
      companySlug: 'openai',
    });
    expect(parseBoardTarget('smartrecruiters:BoschGroup')).toEqual({
      provider: 'smartrecruiters',
      companySlug: 'BoschGroup',
    });
  });

  it('parses full ATS board URLs', () => {
    expect(parseBoardTarget('https://boards.greenhouse.io/stripe')).toEqual({
      provider: 'greenhouse',
      companySlug: 'stripe',
    });
    expect(parseBoardTarget('https://job-boards.greenhouse.io/figma/jobs/123')).toEqual({
      provider: 'greenhouse',
      companySlug: 'figma',
    });
    expect(parseBoardTarget('https://jobs.lever.co/spotify')).toEqual({
      provider: 'lever',
      companySlug: 'spotify',
    });
    expect(parseBoardTarget('https://jobs.ashbyhq.com/openai/abc')).toEqual({
      provider: 'ashby',
      companySlug: 'openai',
    });
    expect(parseBoardTarget('https://jobs.smartrecruiters.com/BoschGroup')).toEqual({
      provider: 'smartrecruiters',
      companySlug: 'BoschGroup',
    });
  });

  it('throws on unsupported or empty board targets', () => {
    expect(() => parseBoardTarget('')).toThrow();
    expect(() => parseBoardTarget('workday:acme')).toThrow();
    expect(() => parseBoardTarget('https://example.com/jobs')).toThrow();
  });
});

describe('parseActorInput', () => {
  it('applies defaults and deduplicates board targets', () => {
    const parsed = parseActorInput({
      boards: [
        'greenhouse:stripe',
        'https://boards.greenhouse.io/Stripe',
        'ashby:openai',
      ],
    });

    expect(parsed.targets).toEqual([
      { provider: 'greenhouse', companySlug: 'stripe' },
      { provider: 'ashby', companySlug: 'openai' },
    ]);
    expect(parsed.remoteOnly).toBe(false);
    expect(parsed.includeDescription).toBe(false);
    expect(parsed.maxItems).toBe(100);
  });

  it('validates postedAfter format and maxItems range', () => {
    expect(() => parseActorInput({ postedAfter: '2026/11/01' })).toThrow();
    expect(() => parseActorInput({ maxItems: 0 })).toThrow();
    expect(() => parseActorInput({ maxItems: 2001 })).toThrow();
  });
});

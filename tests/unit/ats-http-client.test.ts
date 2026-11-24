import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { AtsHttpClient, fetchAllBoards } from '../../src/adapters/ats-http-client.js';

const server = setupServer();

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('AtsHttpClient', () => {
  it('fetches and parses Greenhouse, Lever, Ashby, and paginated SmartRecruiters boards', async () => {
    server.use(
      http.get('https://boards-api.greenhouse.io/v1/boards/stripe/jobs', () =>
        HttpResponse.json({
          jobs: [
            {
              id: 101,
              title: 'Backend Engineer',
              company_name: 'Stripe',
              absolute_url: 'https://stripe.com/jobs/101',
              location: { name: 'Dublin' },
              departments: [{ name: 'Engineering' }],
              first_published: '2026-11-20T00:00:00Z',
            },
          ],
        }),
      ),
      http.get('https://api.lever.co/v0/postings/spotify', () =>
        HttpResponse.json([
          {
            id: 'lev-1',
            text: 'Data Scientist',
            hostedUrl: 'https://jobs.lever.co/spotify/lev-1',
            createdAt: Date.UTC(2026, 10, 21),
            categories: { location: 'Stockholm', department: 'Data' },
          },
        ]),
      ),
      http.get('https://api.ashbyhq.com/posting-api/job-board/openai', () =>
        HttpResponse.json({
          jobs: [
            {
              id: 'ash-1',
              title: 'Research Engineer',
              isListed: true,
              isRemote: false,
              location: 'San Francisco',
              publishedAt: '2026-11-22T00:00:00Z',
              jobUrl: 'https://jobs.ashbyhq.com/openai/ash-1',
            },
          ],
        }),
      ),
      http.get('https://api.smartrecruiters.com/v1/companies/BoschGroup/postings', ({ request }) => {
        const offset = Number(new URL(request.url).searchParams.get('offset') ?? '0');
        if (offset === 0) {
          return HttpResponse.json({
            totalFound: 2,
            content: [
              {
                id: 'sr-1',
                name: 'Embedded Engineer',
                releasedDate: '2026-11-23T00:00:00Z',
                company: { identifier: 'BoschGroup', name: 'Bosch Group' },
                location: { fullLocation: 'Stuttgart, Germany' },
              },
            ],
          });
        }
        return HttpResponse.json({
          totalFound: 2,
          content: [
            {
              id: 'sr-2',
              name: 'Cloud Architect',
              releasedDate: '2026-11-24T00:00:00Z',
              company: { identifier: 'BoschGroup', name: 'Bosch Group' },
              location: { fullLocation: 'Munich, Germany' },
            },
          ],
        });
      }),
    );

    const client = new AtsHttpClient({ retryDelayMs: 0, smartRecruitersPageSize: 1 });

    const gh = await client.fetchBoardJobs(
      { provider: 'greenhouse', companySlug: 'stripe' },
      { includeDescription: false, maxItems: 10 },
    );
    const lv = await client.fetchBoardJobs(
      { provider: 'lever', companySlug: 'spotify' },
      { includeDescription: false, maxItems: 10 },
    );
    const ab = await client.fetchBoardJobs(
      { provider: 'ashby', companySlug: 'openai' },
      { includeDescription: false, maxItems: 10 },
    );
    const sr = await client.fetchBoardJobs(
      { provider: 'smartrecruiters', companySlug: 'BoschGroup' },
      { includeDescription: false, maxItems: 10 },
    );

    expect(gh.map((j) => j.jobId)).toEqual(['greenhouse:stripe:101']);
    expect(lv.map((j) => j.jobId)).toEqual(['lever:spotify:lev-1']);
    expect(ab.map((j) => j.jobId)).toEqual(['ashby:openai:ash-1']);
    expect(sr.map((j) => j.jobId)).toEqual([
      'smartrecruiters:BoschGroup:sr-1',
      'smartrecruiters:BoschGroup:sr-2',
    ]);
  });

  it('isolates failing boards in fetchAllBoards without aborting healthy boards', async () => {
    server.use(
      http.get('https://boards-api.greenhouse.io/v1/boards/missing/jobs', () =>
        new HttpResponse(null, { status: 404 }),
      ),
      http.get('https://api.ashbyhq.com/posting-api/job-board/openai', () =>
        HttpResponse.json({
          jobs: [
            {
              id: 'ash-1',
              title: 'Research Engineer',
              isListed: true,
              location: 'San Francisco',
              publishedAt: '2026-11-22T00:00:00Z',
              jobUrl: 'https://jobs.ashbyhq.com/openai/ash-1',
            },
          ],
        }),
      ),
    );

    const client = new AtsHttpClient({ maxRetries: 1, retryDelayMs: 0 });
    const result = await fetchAllBoards(
      client,
      [
        { provider: 'greenhouse', companySlug: 'missing' },
        { provider: 'ashby', companySlug: 'openai' },
      ],
      { includeDescription: false, maxItems: 10 },
    );

    expect(result.jobs).toHaveLength(1);
    expect(result.failedBoards).toHaveLength(1);
    expect(result.failedBoards[0]?.board).toBe('greenhouse:missing');
  });
});

import type { AddressInfo } from 'node:net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AtsBillingEvent } from '../../src/adapters/apify-actor.js';
import { createAtsMcpHttpServer } from '../../src/adapters/mcp-server.js';
import type { JobSource } from '../../src/ports/job-source.js';
import type { BillingMeter } from '../../src/shared/billing-meter.js';

const fakeSource: JobSource = {
  async fetchBoardJobs(target) {
    if (target.companySlug === 'openai') {
      return [
        {
          jobId: 'ashby:openai:1',
          provider: 'ashby',
          companySlug: 'openai',
          companyName: 'Openai',
          title: 'Staff AI Engineer',
          department: 'Engineering',
          location: 'San Francisco',
          workplaceType: 'remote',
          isRemote: true,
          employmentType: 'FullTime',
          seniority: 'staff',
          salaryMin: 250000,
          salaryMax: 350000,
          salaryCurrency: 'USD',
          postedAt: '2026-11-22',
          jobUrl: 'https://jobs.ashbyhq.com/openai/1',
          applyUrl: null,
          description: null,
        },
      ];
    }

    return [
      {
        jobId: 'greenhouse:stripe:2',
        provider: 'greenhouse',
        companySlug: 'stripe',
        companyName: 'Stripe',
        title: 'Head of Enterprise Sales',
        department: 'Sales',
        location: 'New York',
        workplaceType: 'hybrid',
        isRemote: false,
        employmentType: 'FullTime',
        seniority: 'executive',
        salaryMin: null,
        salaryMax: null,
        salaryCurrency: null,
        postedAt: '2026-11-21',
        jobUrl: 'https://stripe.com/jobs/2',
        applyUrl: null,
        description: null,
      },
    ];
  },
};

describe('createAtsMcpHttpServer', () => {
  const charges: Array<{ eventName: AtsBillingEvent; count: number }> = [];
  const billing: BillingMeter<AtsBillingEvent> = {
    async charge(eventName, count = 1) {
      charges.push({ eventName, count });
    },
  };

  let baseUrl = '';
  let closeServer: () => Promise<void>;

  beforeAll(async () => {
    const server = createAtsMcpHttpServer({
      source: fakeSource,
      billing,
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });

    closeServer = () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
  });

  afterAll(async () => {
    await closeServer();
  });

  it('responds 200 on GET /health', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      status: 'ok',
      service: 'ats-jobs-mcp-server',
    });
  });

  it('exposes search_ats_jobs, get_company_jobs, and detect_hiring_signals and charges mcp-query', async () => {
    const client = new Client({ name: 'test-mcp-client', version: '1.0.0' });
    const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`));
    await client.connect(transport);

    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      'detect_hiring_signals',
      'get_company_jobs',
      'search_ats_jobs',
    ]);

    const searchRes = await client.callTool({
      name: 'search_ats_jobs',
      arguments: {
        boards: ['ashby:openai', 'greenhouse:stripe'],
        remoteOnly: true,
      },
    });
    const searchParsed = JSON.parse(
      (searchRes.content as Array<{ type: string; text: string }>)[0]?.text ?? '',
    ) as { count: number; jobs: Array<{ jobId: string }> };
    expect(searchParsed.count).toBe(1);
    expect(searchParsed.jobs[0]?.jobId).toBe('ashby:openai:1');

    const companyRes = await client.callTool({
      name: 'get_company_jobs',
      arguments: { board: 'greenhouse:stripe' },
    });
    const companyParsed = JSON.parse(
      (companyRes.content as Array<{ type: string; text: string }>)[0]?.text ?? '',
    ) as { count: number; jobs: Array<{ title: string }> };
    expect(companyParsed.count).toBe(1);
    expect(companyParsed.jobs[0]?.title).toBe('Head of Enterprise Sales');

    const signalsRes = await client.callTool({
      name: 'detect_hiring_signals',
      arguments: { boards: ['ashby:openai', 'greenhouse:stripe'] },
    });
    const signalsParsed = JSON.parse(
      (signalsRes.content as Array<{ type: string; text: string }>)[0]?.text ?? '',
    ) as { signals: { totalJobs: number; remoteJobs: number; salaryDisclosedJobs: number } };
    expect(signalsParsed.signals.totalJobs).toBe(2);
    expect(signalsParsed.signals.remoteJobs).toBe(1);
    expect(signalsParsed.signals.salaryDisclosedJobs).toBe(1);

    expect(charges).toEqual([
      { eventName: 'mcp-query', count: 1 },
      { eventName: 'mcp-query', count: 1 },
      { eventName: 'mcp-query', count: 1 },
    ]);

    await transport.close();
  });
});

import type { Server } from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { filterAndDeduplicateJobs, summarizeHiringSignals } from '../domain/job-filter.js';
import { parseActorInput } from '../domain/job-schema.js';
import type { JobSource } from '../ports/job-source.js';
import type { BillingMeter } from '../shared/billing-meter.js';
import { createMcpHttpServer } from '../shared/mcp-http-server.js';
import type { AtsBillingEvent } from './apify-actor.js';
import { fetchAllBoards } from './ats-http-client.js';

export interface McpServerDependencies {
  source: JobSource;
  billing: BillingMeter<AtsBillingEvent>;
}

export function createConfiguredMcpServer(deps: McpServerDependencies): McpServer {
  const server = new McpServer({
    name: 'ats-jobs-mcp-server',
    version: '0.1.0',
  });

  server.registerTool(
    'search_ats_jobs',
    {
      description:
        'Search and filter normalized tech/startup jobs across Greenhouse, Lever, Ashby, and SmartRecruiters.',
      inputSchema: {
        boards: z
          .array(z.string().min(1))
          .min(1)
          .describe('Board identifiers ("provider:slug" or ATS URLs, e.g. ["greenhouse:stripe", "ashby:openai"])'),
        keywords: z.array(z.string()).optional().describe('Keywords to match in title, department, or description'),
        locations: z.array(z.string()).optional().describe('Location substrings to match'),
        departments: z.array(z.string()).optional().describe('Department substrings to match'),
        remoteOnly: z.boolean().optional().describe('Only return remote-friendly jobs'),
        postedAfter: z.string().optional().describe('Minimum publication date (YYYY-MM-DD)'),
        includeDescription: z.boolean().optional().describe('Include plain-text job description'),
        maxItems: z.number().int().min(1).max(500).optional().describe('Maximum jobs to return'),
      },
    },
    async ({
      boards,
      keywords,
      locations,
      departments,
      remoteOnly,
      postedAfter,
      includeDescription,
      maxItems,
    }) => {
      const criteria = parseActorInput({
        boards,
        keywords: keywords ?? [],
        locations: locations ?? [],
        departments: departments ?? [],
        remoteOnly: remoteOnly ?? false,
        postedAfter,
        includeDescription: includeDescription ?? false,
        maxItems: maxItems ?? 50,
      });

      const { jobs: rawJobs, failedBoards } = await fetchAllBoards(deps.source, criteria.targets, {
        includeDescription: criteria.includeDescription,
        maxItems: criteria.maxItems,
      });

      const jobs = filterAndDeduplicateJobs(rawJobs, criteria);
      await deps.billing.charge('mcp-query', 1);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ count: jobs.length, jobs, failedBoards }, null, 2),
          },
        ],
      };
    },
  );

  server.registerTool(
    'get_company_jobs',
    {
      description: 'Fetch all active normalized jobs for a single company ATS board.',
      inputSchema: {
        board: z.string().min(1).describe('Single board ("greenhouse:stripe", "lever:spotify", or ATS URL)'),
        remoteOnly: z.boolean().optional().describe('Only return remote-friendly jobs'),
        includeDescription: z.boolean().optional().describe('Include plain-text job description'),
        maxItems: z.number().int().min(1).max(500).optional().describe('Maximum jobs to return'),
      },
    },
    async ({ board, remoteOnly, includeDescription, maxItems }) => {
      const criteria = parseActorInput({
        boards: [board],
        remoteOnly: remoteOnly ?? false,
        includeDescription: includeDescription ?? false,
        maxItems: maxItems ?? 50,
      });

      const { jobs: rawJobs, failedBoards } = await fetchAllBoards(deps.source, criteria.targets, {
        includeDescription: criteria.includeDescription,
        maxItems: criteria.maxItems,
      });

      const jobs = filterAndDeduplicateJobs(rawJobs, criteria);
      await deps.billing.charge('mcp-query', 1);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ board, count: jobs.length, jobs, failedBoards }, null, 2),
          },
        ],
      };
    },
  );

  server.registerTool(
    'detect_hiring_signals',
    {
      description:
        'Analyze B2B hiring intent across one or more ATS boards (remote ratio, salary transparency, breakdown by company, department, and seniority).',
      inputSchema: {
        boards: z.array(z.string().min(1)).min(1).describe('ATS boards to analyze'),
        keywords: z.array(z.string()).optional().describe('Optional role keywords (e.g. ["Head of Sales", "AI"])'),
        postedAfter: z.string().optional().describe('Only analyze jobs posted on or after YYYY-MM-DD'),
      },
    },
    async ({ boards, keywords, postedAfter }) => {
      const criteria = parseActorInput({
        boards,
        keywords: keywords ?? [],
        postedAfter,
        includeDescription: false,
        maxItems: 500,
      });

      const { jobs: rawJobs, failedBoards } = await fetchAllBoards(deps.source, criteria.targets, {
        includeDescription: false,
        maxItems: criteria.maxItems,
      });

      const jobs = filterAndDeduplicateJobs(rawJobs, criteria);
      const signals = summarizeHiringSignals(jobs);
      await deps.billing.charge('mcp-query', 1);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                signals,
                sampleJobs: jobs.slice(0, 10),
                failedBoards,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  return server;
}

/**
 * Creates a stateless Streamable HTTP MCP server compatible with Apify Standby mode.
 */
export function createAtsMcpHttpServer(deps: McpServerDependencies): Server {
  return createMcpHttpServer({
    serviceName: 'ats-jobs-mcp-server',
    createServer: () => createConfiguredMcpServer(deps),
  });
}

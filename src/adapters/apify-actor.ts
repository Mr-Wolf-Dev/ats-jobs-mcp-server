import { Actor } from 'apify';
import { filterAndDeduplicateJobs } from '../domain/job-filter.js';
import { parseActorInput, type NormalizedJob } from '../domain/job-schema.js';
import type { JobSource } from '../ports/job-source.js';
import type { BillingMeter } from '../shared/billing-meter.js';
import { fetchAllBoards } from './ats-http-client.js';

export type AtsBillingEvent = 'job-extracted' | 'mcp-query';

export interface ExtractionDependencies {
  source: JobSource;
  billing: BillingMeter<AtsBillingEvent>;
  pushData: (items: NormalizedJob[]) => Promise<void>;
}

/**
 * Validates input, queries configured ATS boards, filters/deduplicates,
 * pushes normalized jobs to dataset, and charges PPE events.
 */
export async function runJobExtraction(
  rawInput: unknown,
  deps: ExtractionDependencies,
): Promise<NormalizedJob[]> {
  const criteria = parseActorInput(rawInput);
  if (criteria.targets.length === 0) {
    return [];
  }

  const { jobs: rawJobs, failedBoards } = await fetchAllBoards(deps.source, criteria.targets, {
    includeDescription: criteria.includeDescription,
    maxItems: criteria.maxItems,
  });

  for (const failed of failedBoards) {
    console.warn(`Failed to fetch board ${failed.board}: ${failed.error}`);
  }

  const jobs = filterAndDeduplicateJobs(rawJobs, criteria);

  if (jobs.length > 0) {
    await deps.pushData(jobs);
    await deps.billing.charge('job-extracted', jobs.length);
  }

  return jobs;
}

/**
 * Runs the standard batch Apify Actor extraction mode.
 */
export async function runActorBatch(
  source: JobSource,
  billing: BillingMeter<AtsBillingEvent>,
): Promise<void> {
  const input = await Actor.getInput();
  await runJobExtraction(input, {
    source,
    billing,
    pushData: async (items) => {
      await Actor.pushData(items);
    },
  });
}

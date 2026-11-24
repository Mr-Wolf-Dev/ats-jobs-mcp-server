import {
  parseAshbyResponse,
  parseGreenhouseResponse,
  parseLeverResponse,
  parseSmartRecruitersResponse,
} from '../domain/ats-parsers.js';
import type { BoardTarget, NormalizedJob } from '../domain/job-schema.js';
import type { FetchBoardOptions, JobSource } from '../ports/job-source.js';
import { fetchJsonWithRetry } from '../shared/http-client.js';

export interface AtsHttpClientOptions {
  maxRetries?: number;
  retryDelayMs?: number;
  smartRecruitersPageSize?: number;
}

export interface FailedBoard {
  board: string;
  error: string;
}

/**
 * HTTP-only ATS client querying public JSON job-board APIs for
 * Greenhouse, Lever, Ashby, and SmartRecruiters.
 */
export class AtsHttpClient implements JobSource {
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private readonly smartRecruitersPageSize: number;

  constructor(options: AtsHttpClientOptions = {}) {
    this.maxRetries = options.maxRetries ?? 3;
    this.retryDelayMs = options.retryDelayMs ?? 500;
    this.smartRecruitersPageSize = options.smartRecruitersPageSize ?? 100;
  }

  async fetchBoardJobs(target: BoardTarget, options: FetchBoardOptions): Promise<NormalizedJob[]> {
    const slug = encodeURIComponent(target.companySlug);
    const reqOptions = {
      maxRetries: this.maxRetries,
      retryDelayMs: this.retryDelayMs,
    };

    switch (target.provider) {
      case 'greenhouse': {
        const query = options.includeDescription ? '?content=true' : '';
        const url = `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs${query}`;
        const payload = await fetchJsonWithRetry(url, reqOptions);
        return parseGreenhouseResponse(payload, target.companySlug, options.includeDescription);
      }

      case 'lever': {
        const url = `https://api.lever.co/v0/postings/${slug}?mode=json`;
        const payload = await fetchJsonWithRetry(url, reqOptions);
        return parseLeverResponse(payload, target.companySlug, options.includeDescription);
      }

      case 'ashby': {
        const url = `https://api.ashbyhq.com/posting-api/job-board/${slug}?includeCompensation=true`;
        const payload = await fetchJsonWithRetry(url, reqOptions);
        return parseAshbyResponse(payload, target.companySlug, options.includeDescription);
      }

      case 'smartrecruiters': {
        return this.fetchSmartRecruitersPaginated(target.companySlug, options);
      }
    }
  }

  private async fetchSmartRecruitersPaginated(
    companySlug: string,
    options: FetchBoardOptions,
  ): Promise<NormalizedJob[]> {
    const slug = encodeURIComponent(companySlug);
    const collected: NormalizedJob[] = [];
    let offset = 0;

    while (collected.length < options.maxItems) {
      const limit = Math.min(this.smartRecruitersPageSize, options.maxItems - collected.length);
      const url = `https://api.smartrecruiters.com/v1/companies/${slug}/postings?limit=${limit}&offset=${offset}`;
      const payload = (await fetchJsonWithRetry<{ totalFound?: number }>(url, {
        maxRetries: this.maxRetries,
        retryDelayMs: this.retryDelayMs,
      })) as { totalFound?: number };

      const pageJobs = parseSmartRecruitersResponse(payload, companySlug);
      if (pageJobs.length === 0) {
        break;
      }

      collected.push(...pageJobs);
      offset += pageJobs.length;

      const totalFound = payload.totalFound ?? collected.length;
      if (offset >= totalFound || pageJobs.length < limit) {
        break;
      }
    }

    return collected.slice(0, options.maxItems);
  }
}

/**
 * Fetches multiple ATS boards while isolating per-board errors so one 404 does not abort others.
 */
export async function fetchAllBoards(
  source: JobSource,
  targets: BoardTarget[],
  options: FetchBoardOptions,
): Promise<{ jobs: NormalizedJob[]; failedBoards: FailedBoard[] }> {
  const jobs: NormalizedJob[] = [];
  const failedBoards: FailedBoard[] = [];

  for (const target of targets) {
    try {
      const boardJobs = await source.fetchBoardJobs(target, options);
      jobs.push(...boardJobs);
    } catch (err) {
      failedBoards.push({
        board: `${target.provider}:${target.companySlug}`,
        error: err instanceof Error ? err.message : 'Unknown ATS fetch error',
      });
    }
  }

  return { jobs, failedBoards };
}

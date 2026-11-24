import type { BoardTarget, NormalizedJob } from '../domain/job-schema.js';

export interface FetchBoardOptions {
  includeDescription: boolean;
  maxItems: number;
}

export interface JobSource {
  fetchBoardJobs(target: BoardTarget, options: FetchBoardOptions): Promise<NormalizedJob[]>;
}

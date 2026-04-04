import { DateTime } from "luxon";
import type Commit from "./types.js";

const OUTLIER_MIN_ADDITIONS = 2000;

export interface OutlierDetectionResult {
  outlierCommits: Commit[];
  normalCommits: Commit[];
}

/**
 * Selects the top N commits by weighted additions for outlier analysis,
 * where N = 2 * project age in years (rounded up, minimum 1).
 * Only commits with at least OUTLIER_MIN_ADDITIONS are considered.
 */
export function detectOutlierCommits(
  commits: Commit[],
): OutlierDetectionResult {
  if (commits.length === 0) {
    return { outlierCommits: [], normalCommits: [] };
  }

  const maxOutliers = computeMaxOutliers(commits);

  const indexed = commits.map((commit, index) => ({ commit, index }));
  indexed.sort((a, b) => b.commit.additions - a.commit.additions);

  const outlierIndices = new Set(
    indexed
      .filter((entry) => entry.commit.additions >= OUTLIER_MIN_ADDITIONS)
      .slice(0, maxOutliers)
      .map((entry) => entry.index),
  );

  const outlierCommits: Commit[] = [];
  const normalCommits: Commit[] = [];

  for (let i = 0; i < commits.length; i++) {
    if (outlierIndices.has(i)) {
      outlierCommits.push(commits[i]!);
    } else {
      normalCommits.push(commits[i]!);
    }
  }

  return { outlierCommits, normalCommits };
}

function computeMaxOutliers(commits: Commit[]): number {
  const timestamps = commits
    .map((commit) => DateTime.fromISO(commit.timestamp))
    .filter((dt) => dt.isValid);

  if (timestamps.length === 0) {
    return 1;
  }

  const earliest = timestamps.reduce((min, dt) => (dt < min ? dt : min));
  const latest = timestamps.reduce((max, dt) => (dt > max ? dt : max));

  const projectAgeYears = latest.diff(earliest, "years").years;
  const budget = Math.max(1, Math.ceil(projectAgeYears * 4));
  // Round up to the next multiple of BATCH_SIZE (4) so we don't waste
  // partial API calls
  const BATCH_SIZE = 4;
  return Math.ceil(budget / BATCH_SIZE) * BATCH_SIZE;
}

import { describe, expect, it } from "vitest";
import { detectOutlierCommits } from "./outlierCommits.js";
import type Commit from "./types.js";

function makeCommit(
  additions: number,
  timestamp = "2025-01-06T10:00:00Z",
): Commit {
  return {
    hash: `hash-${String(additions)}-${timestamp}`,
    week: "2025-W02",
    timestamp,
    author: "dev@example.com",
    subject: "",
    additions,
    deletions: 0,
    fileStats: [],
    coAuthors: [],
    subCommitCount: 0,
  };
}

describe("detectOutlierCommits", () => {
  it("returns empty arrays for empty input", () => {
    // Exercise
    const result = detectOutlierCommits([]);

    // Verify
    expect(result.outlierCommits).toEqual([]);
    expect(result.normalCommits).toEqual([]);
  });

  it("selects the top N commits by additions where N = 4 * age in years", () => {
    // Setup SUT — project spans 2 years, so N = ceil(2 * 4) = 8
    // but only 4 commits are above OUTLIER_MIN_ADDITIONS (2000)
    const commits = [
      makeCommit(100, "2023-01-06T10:00:00Z"),
      makeCommit(5000, "2023-06-06T10:00:00Z"),
      makeCommit(200, "2024-01-06T10:00:00Z"),
      makeCommit(8000, "2024-03-06T10:00:00Z"),
      makeCommit(150, "2024-06-06T10:00:00Z"),
      makeCommit(3000, "2024-09-06T10:00:00Z"),
      makeCommit(50, "2024-12-06T10:00:00Z"),
      makeCommit(10000, "2025-01-06T10:00:00Z"),
    ];

    // Exercise
    const result = detectOutlierCommits(commits);

    // Verify — 4 commits above 2000 threshold: 10000, 8000, 5000, 3000
    expect(result.outlierCommits).toHaveLength(4);
    const outlierAdditions = result.outlierCommits
      .map((c) => c.additions)
      .sort((a, b) => b - a);
    expect(outlierAdditions).toEqual([10000, 8000, 5000, 3000]);
    expect(result.normalCommits).toHaveLength(4);
  });

  it("uses minimum of 1 outlier for very short projects", () => {
    // Setup SUT — all commits in the same week, one above minimum threshold
    const commits = [
      makeCommit(100, "2025-01-06T10:00:00Z"),
      makeCommit(5000, "2025-01-06T12:00:00Z"),
      makeCommit(200, "2025-01-06T14:00:00Z"),
    ];

    // Exercise
    const result = detectOutlierCommits(commits);

    // Verify — minimum 1 outlier, should be the largest (above 2000 threshold)
    expect(result.outlierCommits).toHaveLength(1);
    expect(result.outlierCommits[0]!.additions).toBe(5000);
    expect(result.normalCommits).toHaveLength(2);
  });

  it("does not flag commits below the minimum additions threshold", () => {
    // Setup SUT — all commits are small, none above 2000
    const commits = [
      makeCommit(100, "2023-01-06T10:00:00Z"),
      makeCommit(500, "2024-01-06T10:00:00Z"),
      makeCommit(200, "2025-01-06T10:00:00Z"),
    ];

    // Exercise
    const result = detectOutlierCommits(commits);

    // Verify — no outliers despite having enough budget (2 years = 4 slots)
    expect(result.outlierCommits).toHaveLength(0);
    expect(result.normalCommits).toHaveLength(3);
  });

  it("preserves original commit order in both arrays", () => {
    // Setup SUT — 1 year project, so N = ceil(1 * 4) = 4
    // but only 2 commits are above OUTLIER_MIN_ADDITIONS
    const commits = [
      makeCommit(100, "2024-01-06T10:00:00Z"),
      makeCommit(9000, "2024-06-06T10:00:00Z"),
      makeCommit(200, "2024-09-06T10:00:00Z"),
      makeCommit(7000, "2025-01-06T10:00:00Z"),
    ];

    // Exercise
    const result = detectOutlierCommits(commits);

    // Verify — outliers in original order
    expect(result.outlierCommits[0]!.additions).toBe(9000);
    expect(result.outlierCommits[1]!.additions).toBe(7000);
    // normals in original order
    expect(result.normalCommits[0]!.additions).toBe(100);
    expect(result.normalCommits[1]!.additions).toBe(200);
  });

  it("rounds up fractional years", () => {
    // Setup SUT — 1.5 years, so N = ceil(1.5 * 4) = 6
    // but only 3 commits are above OUTLIER_MIN_ADDITIONS
    const commits = [
      makeCommit(100, "2023-07-06T10:00:00Z"),
      makeCommit(5000, "2024-01-06T10:00:00Z"),
      makeCommit(200, "2024-06-06T10:00:00Z"),
      makeCommit(8000, "2024-09-06T10:00:00Z"),
      makeCommit(3000, "2024-12-06T10:00:00Z"),
      makeCommit(50, "2025-01-06T10:00:00Z"),
    ];

    // Exercise
    const result = detectOutlierCommits(commits);

    // Verify — 3 commits above threshold: 8000, 5000, 3000
    expect(result.outlierCommits).toHaveLength(3);
    expect(result.normalCommits).toHaveLength(3);
  });
});

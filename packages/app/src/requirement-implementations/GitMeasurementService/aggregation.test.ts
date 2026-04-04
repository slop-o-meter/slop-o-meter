import { describe, expect, it } from "vitest";
import aggregateCommits from "./aggregation.js";
import type Commit from "./types.js";

function makeCommit(
  week: string,
  author: string,
  additions: number,
  deletions = 0,
): Commit {
  return {
    hash: `${week}-${author}-${String(additions)}`,
    week,
    timestamp: `${week}-1T00:00:00Z`,
    author,
    subject: "",
    additions,
    deletions,
    fileStats: [],
    coAuthors: [],
    subCommitCount: 0,
  };
}

describe("aggregateCommits", () => {
  it("returns empty results for empty input", () => {
    // Exercise
    const { weeklyData, contributorProfiles } = aggregateCommits([]);

    // Verify
    expect(weeklyData).toEqual([]);
    expect(contributorProfiles.size).toBe(0);
  });

  it("aggregates commits into weekly buckets", () => {
    // Setup SUT
    const commits = [
      makeCommit("2025-W01", "alice@example.com", 10, 5),
      makeCommit("2025-W01", "alice@example.com", 20, 3),
      makeCommit("2025-W02", "alice@example.com", 15, 0),
    ];

    // Exercise
    const { weeklyData } = aggregateCommits(commits);

    // Verify
    expect(weeklyData).toHaveLength(2);
    expect(weeklyData[0]!.weightedAdditions).toBe(30);
    expect(weeklyData[0]!.weightedDeletions).toBe(8);
    expect(weeklyData[1]!.weightedAdditions).toBe(15);
  });

  it("includes bot commit data but excludes bots from contributors", () => {
    // Setup SUT
    const commits = [
      makeCommit("2025-W01", "alice@example.com", 10, 5),
      makeCommit(
        "2025-W01",
        "27856297+dependabot[bot]@users.noreply.github.com",
        500,
        0,
      ),
    ];

    // Exercise
    const { weeklyData } = aggregateCommits(commits);

    // Verify
    expect(weeklyData[0]!.weightedAdditions).toBe(510);
    expect(weeklyData[0]!.activeContributors).toEqual(["alice@example.com"]);
  });

  it("computes contributor profiles with commit counts and shares", () => {
    // Setup SUT
    const commits = [
      makeCommit("2025-W01", "alice@example.com", 10),
      makeCommit("2025-W01", "alice@example.com", 10),
      makeCommit("2025-W02", "alice@example.com", 10),
      makeCommit("2025-W02", "bob@example.com", 10),
    ];

    // Exercise
    const { contributorProfiles } = aggregateCommits(commits);

    // Verify
    const aliceProfile = contributorProfiles.get("alice@example.com")!;
    expect(aliceProfile.totalCommits).toBe(3);
    expect(aliceProfile.commitShare).toBe(0.75);

    const bobProfile = contributorProfiles.get("bob@example.com")!;
    expect(bobProfile.totalCommits).toBe(1);
    expect(bobProfile.commitShare).toBe(0.25);
  });

  it("counts co-authors in contributor profiles the same as primary authors", () => {
    // Setup SUT
    const commits: Commit[] = [
      {
        hash: "abc123",
        week: "2025-W01",
        timestamp: "2025-W01-1T00:00:00Z",
        author: "alice@example.com",
        subject: "",
        additions: 100,
        deletions: 0,
        fileStats: [],
        coAuthors: ["bob@example.com"],
        subCommitCount: 0,
      },
    ];

    // Exercise
    const { contributorProfiles } = aggregateCommits(commits);

    // Verify
    expect(contributorProfiles.get("alice@example.com")!.totalCommits).toBe(1);
    expect(contributorProfiles.get("bob@example.com")!.totalCommits).toBe(1);
  });

  it("produces identical profiles when swapping author and co-author", () => {
    // Setup SUT
    const commitsAliceAuthors: Commit[] = [
      {
        hash: "abc123",
        week: "2025-W01",
        timestamp: "2025-W01-1T00:00:00Z",
        author: "alice@example.com",
        subject: "",
        additions: 100,
        deletions: 0,
        fileStats: [],
        coAuthors: ["bob@example.com"],
        subCommitCount: 0,
      },
    ];
    const commitsBobAuthors: Commit[] = [
      {
        hash: "def456",
        week: "2025-W01",
        timestamp: "2025-W01-1T00:00:00Z",
        author: "bob@example.com",
        subject: "",
        additions: 100,
        deletions: 0,
        fileStats: [],
        coAuthors: ["alice@example.com"],
        subCommitCount: 0,
      },
    ];

    // Exercise
    const resultA = aggregateCommits(commitsAliceAuthors);
    const resultB = aggregateCommits(commitsBobAuthors);

    // Verify
    const aliceA = resultA.contributorProfiles.get("alice@example.com")!;
    const bobA = resultA.contributorProfiles.get("bob@example.com")!;
    const aliceB = resultB.contributorProfiles.get("alice@example.com")!;
    const bobB = resultB.contributorProfiles.get("bob@example.com")!;
    expect(aliceA.totalCommits).toBe(aliceB.totalCommits);
    expect(bobA.totalCommits).toBe(bobB.totalCommits);
    expect(aliceA.commitShare).toBe(aliceB.commitShare);
    expect(bobA.commitShare).toBe(bobB.commitShare);
  });

  it("does not exclude any commits as outliers", () => {
    // Setup SUT — all commits should be included regardless of size
    const commits = [
      ...Array.from({ length: 997 }, () =>
        makeCommit("2025-W01", "alice@example.com", 10),
      ),
      ...Array.from({ length: 3 }, () =>
        makeCommit("2025-W01", "alice@example.com", 50000),
      ),
    ];

    // Exercise
    const { weeklyData } = aggregateCommits(commits);

    // Verify — all commits included: 997 * 10 + 3 * 50000 = 159970
    expect(weeklyData[0]!.weightedAdditions).toBe(159970);
  });
});

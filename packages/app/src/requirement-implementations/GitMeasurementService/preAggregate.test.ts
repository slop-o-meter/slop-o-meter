import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import type {
  MeasurementCommit,
  MeasurementData,
} from "../../requirements/MeasurementService.js";
import preAggregate from "./preAggregate.js";

// --- Helpers ---

function makeCommit(
  week: string,
  author: string,
  additions: number,
  options?: {
    deletions?: number;
    coAuthors?: string[];
    subCommitCount?: number;
  },
): MeasurementCommit {
  const dt = DateTime.fromISO(week);
  return {
    hash: crypto.randomUUID(),
    week,
    timestamp: dt.plus({ days: 3, hours: 10 }).toISO()!,
    author,
    subject: "test commit",
    weightedAdditions: additions,
    weightedDeletions: options?.deletions ?? 0,
    fileCount: 1,
    coAuthors: options?.coAuthors ?? [],
    subCommitCount: options?.subCommitCount ?? 0,
  };
}

function makeMeasurementData(
  overrides?: Partial<MeasurementData>,
): MeasurementData {
  return {
    commits: [],
    githubEvents: [],
    excludedHashes: [],
    outlierClassifications: [],
    ...overrides,
  };
}

describe("preAggregate", () => {
  describe("weeklyCommitData", () => {
    it("aggregates commits by week", () => {
      // Setup SUT
      const data = makeMeasurementData({
        commits: [
          makeCommit("2025-W01", "alice", 100, { deletions: 10 }),
          makeCommit("2025-W01", "bob", 200, { deletions: 20 }),
          makeCommit("2025-W02", "alice", 300),
        ],
      });

      // Exercise
      const { preAggregatedData } = preAggregate(data);

      // Verify
      expect(preAggregatedData.weeklyCommitData).toHaveLength(2);
      const w1 = preAggregatedData.weeklyCommitData.find(
        (w) => w.week === "2025-W01",
      )!;
      expect(w1.weightedAdditions).toBe(300);
      expect(w1.weightedDeletions).toBe(30);
      const w2 = preAggregatedData.weeklyCommitData.find(
        (w) => w.week === "2025-W02",
      )!;
      expect(w2.weightedAdditions).toBe(300);
    });

    it("fills week gaps", () => {
      // Setup SUT
      const data = makeMeasurementData({
        commits: [
          makeCommit("2025-W01", "alice", 100),
          makeCommit("2025-W04", "alice", 200),
        ],
      });

      // Exercise
      const { preAggregatedData } = preAggregate(data);

      // Verify — W02 and W03 should be filled in
      expect(preAggregatedData.weeklyCommitData).toHaveLength(4);
      expect(preAggregatedData.weeklyCommitData[1]!.week).toBe("2025-W02");
      expect(preAggregatedData.weeklyCommitData[1]!.weightedAdditions).toBe(0);
    });

    it("separates excluded commits from normal commits", () => {
      // Setup SUT
      const excludedCommit = makeCommit("2025-W01", "alice", 500);
      const data = makeMeasurementData({
        commits: [excludedCommit, makeCommit("2025-W01", "alice", 200)],
        excludedHashes: [{ hash: excludedCommit.hash, reason: "auto" }],
      });

      // Exercise
      const { preAggregatedData } = preAggregate(data);

      // Verify
      const w1 = preAggregatedData.weeklyCommitData[0]!;
      expect(w1.weightedAdditions).toBe(200);
      expect(w1.excludedAdditions).toBe(500);
    });
  });

  describe("contributorProfiles", () => {
    it("builds profiles from non-bot commits", () => {
      // Setup SUT
      const data = makeMeasurementData({
        commits: [
          makeCommit("2025-W01", "alice", 100),
          makeCommit("2025-W01", "alice", 100),
          makeCommit("2025-W01", "bob", 100),
        ],
      });

      // Exercise
      const { preAggregatedData } = preAggregate(data);

      // Verify
      const alice = preAggregatedData.contributorProfiles.find(
        (p) => p.author === "alice",
      )!;
      const bob = preAggregatedData.contributorProfiles.find(
        (p) => p.author === "bob",
      )!;
      expect(alice.totalCommits).toBe(2);
      expect(bob.totalCommits).toBe(1);
      expect(alice.commitShare).toBeCloseTo(2 / 3);
      expect(bob.commitShare).toBeCloseTo(1 / 3);
    });

    it("excludes bot contributors from profiles", () => {
      // Setup SUT
      const data = makeMeasurementData({
        commits: [
          makeCommit("2025-W01", "alice", 100),
          makeCommit(
            "2025-W01",
            "27856297+dependabot[bot]@users.noreply.github.com",
            500,
          ),
        ],
      });

      // Exercise
      const { preAggregatedData } = preAggregate(data);

      // Verify — only alice should appear
      expect(preAggregatedData.contributorProfiles).toHaveLength(1);
      expect(preAggregatedData.contributorProfiles[0]!.author).toBe("alice");
    });
  });

  describe("sessions", () => {
    it("generates sessions from commit signals", () => {
      // Setup SUT
      const data = makeMeasurementData({
        commits: [makeCommit("2025-W01", "alice", 100)],
      });

      // Exercise
      const { sessions } = preAggregate(data);

      // Verify
      expect(sessions.length).toBeGreaterThan(0);
      expect(sessions[0]!.author).toBe("alice");
      expect(sessions[0]!.durationHours).toBeGreaterThan(0);
    });

    it("generates sessions from github events", () => {
      // Setup SUT
      const data = makeMeasurementData({
        commits: [],
        githubEvents: [{ timestamp: "2025-01-06T10:00:00Z", author: "alice" }],
      });

      // Exercise
      const { sessions } = preAggregate(data);

      // Verify
      expect(sessions).toHaveLength(1);
      expect(sessions[0]!.author).toBe("alice");
    });

    it("filters bot authors from signals", () => {
      // Setup SUT
      const data = makeMeasurementData({
        commits: [
          makeCommit(
            "2025-W01",
            "27856297+dependabot[bot]@users.noreply.github.com",
            500,
          ),
        ],
        githubEvents: [
          {
            timestamp: "2025-01-06T10:00:00Z",
            author: "27856297+dependabot[bot]@users.noreply.github.com",
          },
        ],
      });

      // Exercise
      const { sessions } = preAggregate(data);

      // Verify — bots should not produce sessions
      expect(sessions).toHaveLength(0);
    });
  });

  describe("weeklySessionHours", () => {
    it("aggregates session hours by author and week", () => {
      // Setup SUT — two commits in same week by same author
      const data = makeMeasurementData({
        commits: [
          makeCommit("2025-W01", "alice", 100),
          makeCommit("2025-W01", "alice", 100),
        ],
      });

      // Exercise
      const { preAggregatedData } = preAggregate(data);

      // Verify — should have session hours for alice in W01
      const aliceW01 = preAggregatedData.weeklySessionHours.find(
        (e) => e.author === "alice" && e.week === "2025-W01",
      );
      expect(aliceW01).toBeDefined();
      expect(aliceW01!.hours).toBeGreaterThan(0);
    });

    it("keeps separate entries for different authors", () => {
      // Setup SUT
      const data = makeMeasurementData({
        commits: [
          makeCommit("2025-W01", "alice", 100),
          makeCommit("2025-W01", "bob", 100),
        ],
      });

      // Exercise
      const { preAggregatedData } = preAggregate(data);

      // Verify
      const authors = new Set(
        preAggregatedData.weeklySessionHours.map((e) => e.author),
      );
      expect(authors.has("alice")).toBe(true);
      expect(authors.has("bob")).toBe(true);
    });
  });

  describe("co-author signals", () => {
    it("generates signals for human co-authors", () => {
      // Setup SUT
      const data = makeMeasurementData({
        commits: [
          makeCommit("2025-W01", "alice", 100, {
            coAuthors: ["bob"],
          }),
        ],
      });

      // Exercise
      const { preAggregatedData } = preAggregate(data);

      // Verify — bob should appear in session hours
      const bobHours = preAggregatedData.weeklySessionHours.find(
        (e) => e.author === "bob",
      );
      expect(bobHours).toBeDefined();
    });

    it("does not generate signals for bot co-authors", () => {
      // Setup SUT
      const data = makeMeasurementData({
        commits: [
          makeCommit("2025-W01", "alice", 100, {
            coAuthors: ["27856297+dependabot[bot]@users.noreply.github.com"],
          }),
        ],
      });

      // Exercise
      const { preAggregatedData } = preAggregate(data);

      // Verify — only alice should appear
      const authors = new Set(
        preAggregatedData.weeklySessionHours.map((e) => e.author),
      );
      expect(authors.has("alice")).toBe(true);
      expect(authors.size).toBe(1);
    });
  });

  describe("empty input", () => {
    it("returns empty results for empty measurement data", () => {
      // Setup SUT
      const data = makeMeasurementData();

      // Exercise
      const { preAggregatedData, sessions } = preAggregate(data);

      // Verify
      expect(preAggregatedData.weeklyCommitData).toEqual([]);
      expect(preAggregatedData.contributorProfiles).toEqual([]);
      expect(preAggregatedData.weeklySessionHours).toEqual([]);
      expect(sessions).toEqual([]);
    });
  });
});

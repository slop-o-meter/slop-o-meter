import { describe, expect, it } from "vitest";
import type {
  ContributorProfileEntry,
  PreAggregatedData,
  WeeklyCommitData,
  WeeklySessionHoursEntry,
} from "../../requirements/MeasurementService.js";
import toMeasurement from "./GitMeasurement.js";

// --- Helpers ---

function weekLabel(index: number): string {
  return `2025-W${String(index + 1).padStart(2, "0")}`;
}

function makeWeeklyCommitData(
  rates: { additions: number; deletions: number }[],
): WeeklyCommitData[] {
  return rates.map((rate, index) => ({
    week: weekLabel(index),
    weightedAdditions: rate.additions,
    weightedDeletions: rate.deletions,
    excludedAdditions: 0,
    excludedDeletions: 0,
  }));
}

function makeCoreProfile(
  author: string,
  totalCommits = 75,
  commitShare = 1.0,
): ContributorProfileEntry {
  return { author, totalCommits, commitShare };
}

function makeSessionHours(
  weeks: string[],
  hoursPerWeek: number,
  author = "dev@example.com",
): WeeklySessionHoursEntry[] {
  return weeks.map((week) => ({ author, week, hours: hoursPerWeek }));
}

function runMeasurement(
  weeklyCommitData: WeeklyCommitData[],
  sessionHours: WeeklySessionHoursEntry[],
  profiles: ContributorProfileEntry[] = [],
) {
  const data: PreAggregatedData = {
    weeklyCommitData,
    contributorProfiles: profiles,
    weeklySessionHours: sessionHours,
  };
  return toMeasurement(data);
}

// Builds weekly commit data with core history (excluded) to get past bootstrap
function coreHistoryWeeks(
  weekCount = 15,
  additionsPerWeek = 500,
): WeeklyCommitData[] {
  return Array.from({ length: weekCount }, (_, i) => ({
    week: `2021-W${String(i + 1).padStart(2, "0")}`,
    weightedAdditions: 0,
    weightedDeletions: 0,
    excludedAdditions: additionsPerWeek,
    excludedDeletions: 0,
  }));
}

describe("toMeasurement", () => {
  describe("basic scoring", () => {
    it("returns score 0 for zero activity", () => {
      // Setup SUT
      const weeklyData = [
        {
          week: "2025-W01",
          weightedAdditions: 0,
          weightedDeletions: 0,
          excludedAdditions: 0,
          excludedDeletions: 0,
        },
      ];

      // Exercise
      const result = runMeasurement(weeklyData, []);

      // Verify
      expect(result.currentScore).toBe(0);
    });

    it("returns score 0 when session time covers all additions", () => {
      // Setup SUT — 800 additions, 25h session = 1000 LOC capacity.
      // Excluded additions build up codebase size without generating slop.
      const weeklyData = [
        ...coreHistoryWeeks(),
        {
          week: "2025-W01",
          weightedAdditions: 800,
          weightedDeletions: 0,
          excludedAdditions: 0,
          excludedDeletions: 0,
        },
      ];
      const sessions = makeSessionHours(["2025-W01"], 25);
      const profiles = [makeCoreProfile("dev@example.com")];

      // Exercise
      const result = runMeasurement(weeklyData, sessions, profiles);

      // Verify
      expect(result.currentScore).toBe(0);
    });

    it("returns positive score when additions exceed session-based attention", () => {
      // Setup SUT — build up codebase past bootstrap, then add a big week
      // with insufficient session time
      const weeklyData = makeWeeklyCommitData([
        ...Array.from({ length: 7 }, () => ({
          additions: 800,
          deletions: 0,
        })),
        { additions: 3000, deletions: 0 },
      ]);
      const sessions = [
        ...makeSessionHours(
          Array.from({ length: 7 }, (_, i) => weekLabel(i)),
          25,
        ),
        { author: "dev@example.com", week: "2025-W08", hours: 2 },
      ];
      const profiles = [makeCoreProfile("dev@example.com", 8, 1.0)];

      // Exercise
      const result = runMeasurement(weeklyData, sessions, profiles);

      // Verify
      expect(result.currentScore).toBeGreaterThan(0);
    });

    it("returns score between 0 and 1", () => {
      // Setup SUT
      const weeklyData = makeWeeklyCommitData([
        { additions: 5000, deletions: 0 },
        { additions: 5000, deletions: 0 },
      ]);

      // Exercise
      const result = runMeasurement(weeklyData, []);

      // Verify
      expect(result.currentScore).toBeGreaterThanOrEqual(0);
      expect(result.currentScore).toBeLessThanOrEqual(1);
    });
  });

  describe("session-based attention spent", () => {
    it("more session hours reduce slop", () => {
      // Setup SUT
      const weeklyData = [
        ...coreHistoryWeeks(),
        ...makeWeeklyCommitData([
          ...Array.from({ length: 6 }, () => ({
            additions: 800,
            deletions: 0,
          })),
          { additions: 5000, deletions: 0 },
        ]),
      ];
      const profiles = [makeCoreProfile("dev@example.com")];
      const weeks = Array.from({ length: 7 }, (_, i) => weekLabel(i));

      const fewHoursSessions = makeSessionHours(weeks, 2);
      const manyHoursSessions = makeSessionHours(weeks, 40);

      // Exercise
      const scoreFewHours = runMeasurement(
        weeklyData,
        fewHoursSessions,
        profiles,
      ).currentScore;
      const scoreManyHours = runMeasurement(
        weeklyData,
        manyHoursSessions,
        profiles,
      ).currentScore;

      // Verify
      expect(scoreManyHours).toBeLessThan(scoreFewHours);
    });

    it("drive-by contributors' session time is discounted by core factor", () => {
      // Setup SUT — "core" has profile, "driveby" does not
      const weeklyData = [
        ...coreHistoryWeeks(),
        ...makeWeeklyCommitData([
          ...Array.from({ length: 6 }, () => ({
            additions: 800,
            deletions: 0,
          })),
          { additions: 5000, deletions: 0 },
        ]),
      ];

      const coreSessions = [
        { author: "core@example.com", week: "2025-W07", hours: 20 },
      ];
      const drivebySessions = [
        { author: "driveby@example.com", week: "2025-W07", hours: 20 },
      ];
      const profiles = [makeCoreProfile("core@example.com")];

      // Exercise
      const scoreCore = runMeasurement(
        weeklyData,
        coreSessions,
        profiles,
      ).currentScore;
      const scoreDriveby = runMeasurement(
        weeklyData,
        drivebySessions,
        profiles,
      ).currentScore;

      // Verify — drive-by has 0 core factor, so their time doesn't count
      expect(scoreDriveby).toBeGreaterThan(scoreCore);
    });
  });

  describe("weekly hour cap", () => {
    it("limits how much a single author can contribute per week", () => {
      // Setup SUT — two scenarios with the same total session hours.
      // One author with many hours vs two authors splitting them.
      const weeklyData = [
        ...coreHistoryWeeks(30),
        {
          week: "2025-W01",
          weightedAdditions: 10000,
          weightedDeletions: 0,
          excludedAdditions: 0,
          excludedDeletions: 0,
        },
      ];

      const profiles = [
        makeCoreProfile("a@example.com", 150, 0.5),
        makeCoreProfile("b@example.com", 150, 0.5),
      ];

      // One author with 150h (well above the cap)
      const oneAuthorSessions = [
        { author: "a@example.com", week: "2025-W01", hours: 150 },
      ];
      // Split across two authors
      const twoAuthorSessions = [
        { author: "a@example.com", week: "2025-W01", hours: 90 },
        { author: "b@example.com", week: "2025-W01", hours: 60 },
      ];

      // Exercise
      const scoreOne = runMeasurement(
        weeklyData,
        oneAuthorSessions,
        profiles,
      ).currentScore;
      const scoreTwo = runMeasurement(
        weeklyData,
        twoAuthorSessions,
        profiles,
      ).currentScore;

      // Verify — two authors get more total effective hours because
      // each author's cap is applied independently
      expect(scoreTwo).toBeLessThan(scoreOne);
    });
  });

  describe("codebase size dampening", () => {
    it("dampens slop when codebase is small (under bootstrap threshold)", () => {
      // Setup SUT — a single week with 1000 adds. With only 1000
      // cumulative lines, dampening = 1000/5000 = 0.2, so the attention
      // cost is much lower than the raw line count.
      const weeklyData = [
        {
          week: "2025-W01",
          weightedAdditions: 1000,
          weightedDeletions: 0,
          excludedAdditions: 0,
          excludedDeletions: 0,
        },
      ];
      const profiles = [makeCoreProfile("dev@example.com", 15, 1.0)];
      const sessions = makeSessionHours(["2025-W01"], 5);

      // Exercise
      const result = runMeasurement(weeklyData, sessions, profiles);

      // Verify — score is less than 1 because dampening reduces the
      // attention cost below the raw line count
      expect(result.currentScore).toBeGreaterThan(0);
      expect(result.currentScore).toBeLessThan(1);
    });

    it("applies lower dampening for small codebase than large one", () => {
      // Setup SUT — small codebase
      const smallData: PreAggregatedData = {
        weeklyCommitData: [
          {
            week: "2025-W01",
            weightedAdditions: 3000,
            weightedDeletions: 0,
            excludedAdditions: 0,
            excludedDeletions: 0,
          },
        ],
        contributorProfiles: [makeCoreProfile("dev@example.com", 15, 1.0)],
        weeklySessionHours: makeSessionHours(["2025-W01"], 20),
      };

      // Large codebase — ramp up with excluded additions then same test week
      const largeData: PreAggregatedData = {
        weeklyCommitData: [
          ...Array.from({ length: 15 }, (_, i) => ({
            week: weekLabel(i),
            weightedAdditions: 800,
            weightedDeletions: 0,
            excludedAdditions: 0,
            excludedDeletions: 0,
          })),
          {
            week: weekLabel(15),
            weightedAdditions: 3000,
            weightedDeletions: 0,
            excludedAdditions: 0,
            excludedDeletions: 0,
          },
        ],
        contributorProfiles: [makeCoreProfile("dev@example.com", 15, 1.0)],
        weeklySessionHours: [
          ...Array.from({ length: 15 }, (_, i) => ({
            author: "dev@example.com",
            week: weekLabel(i),
            hours: 1,
          })),
          { author: "dev@example.com", week: weekLabel(15), hours: 20 },
        ],
      };

      // Exercise
      const scoreSmall = toMeasurement(smallData).currentScore;
      const scoreLarge = toMeasurement(largeData).currentScore;

      // Verify — small codebase has lower dampening, so the same additions
      // produce a lower attention cost -> lower score
      expect(scoreSmall).toBeLessThan(scoreLarge);
    });
  });

  describe("week gap filling", () => {
    it("maintains cumulative score across provided gap weeks", () => {
      // Setup SUT — weeks with activity, then gap weeks (zero activity),
      // then more activity. Gap weeks are already in the data (preAggregate
      // fills them).
      const weeklyData = [
        ...makeWeeklyCommitData(
          Array.from({ length: 7 }, () => ({
            additions: 800,
            deletions: 0,
          })),
        ),
        {
          week: "2025-W08",
          weightedAdditions: 0,
          weightedDeletions: 0,
          excludedAdditions: 0,
          excludedDeletions: 0,
        },
        {
          week: "2025-W09",
          weightedAdditions: 0,
          weightedDeletions: 0,
          excludedAdditions: 0,
          excludedDeletions: 0,
        },
        {
          week: "2025-W10",
          weightedAdditions: 5000,
          weightedDeletions: 0,
          excludedAdditions: 0,
          excludedDeletions: 0,
        },
      ];

      // Exercise
      const result = runMeasurement(weeklyData, []);

      // Verify
      const scoreW07 = result.history.find((h) => h.week === "2025-W07")!.score;
      const scoreW08 = result.history.find((h) => h.week === "2025-W08")!.score;
      const scoreW09 = result.history.find((h) => h.week === "2025-W09")!.score;
      expect(scoreW08).toBe(scoreW07);
      expect(scoreW09).toBe(scoreW07);
    });
  });

  describe("edge cases", () => {
    it("handles empty weekly data", () => {
      // Exercise
      const result = runMeasurement([], []);

      // Verify
      expect(result.currentScore).toBe(0);
      expect(result.history).toEqual([]);
    });

    it("scores never go below 0", () => {
      // Setup SUT — massive session time relative to additions
      const weeklyData = makeWeeklyCommitData([
        { additions: 100, deletions: 0 },
        { additions: 100, deletions: 0 },
      ]);
      const profiles = [makeCoreProfile("dev@example.com")];
      const sessions = makeSessionHours(["2025-W01", "2025-W02"], 100);

      // Exercise
      const result = runMeasurement(weeklyData, sessions, profiles);

      // Verify
      for (const entry of result.history) {
        expect(entry.score).toBeGreaterThanOrEqual(0);
      }
    });

    it("score never exceeds 1 even with complexity bonus on large codebases", () => {
      // Setup SUT — large codebase where sizeDampening > 1.0
      const weeklyData = makeWeeklyCommitData(
        Array.from({ length: 200 }, () => ({ additions: 5000, deletions: 0 })),
      );

      // Exercise
      const result = runMeasurement(weeklyData, []);

      // Verify
      for (const entry of result.history) {
        expect(entry.score).toBeLessThanOrEqual(1);
      }
    });

    it("returns full history for all weeks", () => {
      // Setup SUT
      const weeklyData = makeWeeklyCommitData(
        Array.from({ length: 20 }, () => ({ additions: 100, deletions: 0 })),
      );

      // Exercise
      const result = runMeasurement(weeklyData, []);

      // Verify
      expect(result.history).toHaveLength(20);
    });
  });

  describe("weeklyDiagnostics", () => {
    it("returns one diagnostics entry per history entry", () => {
      // Setup SUT
      const weeklyData = makeWeeklyCommitData([
        { additions: 1000, deletions: 0 },
        { additions: 2000, deletions: 0 },
        { additions: 500, deletions: 200 },
      ]);

      // Exercise
      const result = runMeasurement(weeklyData, []);

      // Verify
      expect(result.weeklyDiagnostics).toHaveLength(result.history.length);
      for (let i = 0; i < result.history.length; i++) {
        expect(result.weeklyDiagnostics[i]!.week).toBe(result.history[i]!.week);
        expect(result.weeklyDiagnostics[i]!.score).toBe(
          result.history[i]!.score,
        );
      }
    });

    it("populates all intermediate values", () => {
      // Setup SUT
      const weeklyData = [
        ...coreHistoryWeeks(),
        {
          week: "2025-W01",
          weightedAdditions: 3000,
          weightedDeletions: 500,
          excludedAdditions: 0,
          excludedDeletions: 0,
        },
      ];
      const profiles = [makeCoreProfile("dev@example.com")];
      const sessions = makeSessionHours(["2025-W01"], 20);

      // Exercise
      const result = runMeasurement(weeklyData, sessions, profiles);
      const lastWeek =
        result.weeklyDiagnostics[result.weeklyDiagnostics.length - 1]!;

      // Verify — all fields are populated with sensible values
      expect(lastWeek.weightedAdditions).toBe(3000);
      expect(lastWeek.weightedDeletions).toBe(500);
      expect(lastWeek.netAdditions).toBe(2500);
      expect(lastWeek.sizeDampening).toBeGreaterThan(0);
      expect(lastWeek.attentionCost).toBeGreaterThan(0);
      expect(lastWeek.totalEffectiveHours).toBeGreaterThan(0);
      expect(lastWeek.attentionSpent).toBeGreaterThan(0);
      expect(lastWeek.cumulativeRawLines).toBeGreaterThan(0);
      expect(lastWeek.cumulativeDampenedLines).toBeGreaterThan(0);
    });

    it("includes per-contributor breakdown", () => {
      // Setup SUT
      const weeklyData = [
        ...coreHistoryWeeks(),
        {
          week: "2025-W01",
          weightedAdditions: 3000,
          weightedDeletions: 0,
          excludedAdditions: 0,
          excludedDeletions: 0,
        },
      ];
      const profiles = [makeCoreProfile("dev@example.com")];
      const sessions = makeSessionHours(["2025-W01"], 20);

      // Exercise
      const result = runMeasurement(weeklyData, sessions, profiles);
      const lastWeek =
        result.weeklyDiagnostics[result.weeklyDiagnostics.length - 1]!;

      // Verify
      expect(lastWeek.contributors.length).toBeGreaterThan(0);
      const devContrib = lastWeek.contributors.find(
        (c) => c.author === "dev@example.com",
      )!;
      expect(devContrib).toBeDefined();
      expect(devContrib.rawSessionHours).toBeGreaterThan(0);
      expect(devContrib.coreFactor).toBeGreaterThan(0);
      expect(devContrib.cappedHours).toBeGreaterThan(0);
    });

    it("returns empty diagnostics for empty weekly data", () => {
      // Exercise
      const result = runMeasurement([], []);

      // Verify
      expect(result.weeklyDiagnostics).toEqual([]);
    });
  });
});

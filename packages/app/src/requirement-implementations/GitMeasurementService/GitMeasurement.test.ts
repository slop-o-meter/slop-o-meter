import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import type {
  ExcludedHash,
  MeasurementCommit,
  MeasurementSession,
} from "../../requirements/MeasurementService.js";
import toMeasurement from "./GitMeasurement.js";

// --- Helpers ---

let commitCounter = 0;

function makeCommit(
  week: string,
  author: string,
  additions: number,
  deletions = 0,
): MeasurementCommit {
  const dt = DateTime.fromISO(week);
  return {
    hash: `${week}-${author}-${String(additions)}-${String(commitCounter++)}`,
    week,
    timestamp: dt.toISO()!,
    author,
    subject: "",
    weightedAdditions: additions,
    weightedDeletions: deletions,
    fileCount: 0,
    coAuthors: [],
    subCommitCount: 0,
  };
}

function weekLabel(index: number): string {
  return `2025-W${String(index + 1).padStart(2, "0")}`;
}

function weeklyCommits(
  rates: { additions: number; deletions: number }[],
  authors: string[] = ["dev@example.com"],
): MeasurementCommit[] {
  return rates.flatMap((rate, index) =>
    authors.map((author) =>
      makeCommit(
        weekLabel(index),
        author,
        rate.additions / authors.length,
        rate.deletions / authors.length,
      ),
    ),
  );
}

function makeSession(
  week: string,
  author: string,
  durationHours: number,
): MeasurementSession {
  const endTime = DateTime.fromISO(week).plus({ days: 3, hours: 10 });
  const startTime = endTime.minus({ hours: durationHours });
  return {
    author,
    startTime: startTime.toISO()!,
    endTime: endTime.toISO()!,
    durationHours,
  };
}

function weeklySessions(
  weeks: string[],
  hoursPerWeek: number,
  author = "dev@example.com",
): MeasurementSession[] {
  return weeks.map((week) => makeSession(week, author, hoursPerWeek));
}

// Creates background commits to build up contributor profiles
function coreHistory(
  authors: string[],
  options?: { weeks?: number; commitsPerWeek?: number },
): MeasurementCommit[] {
  const weeks = options?.weeks ?? 15;
  const commitsPerWeek = options?.commitsPerWeek ?? 5;
  return authors.flatMap((author) => {
    const commits: MeasurementCommit[] = [];
    for (let w = 1; w <= weeks; w++) {
      for (let c = 0; c < commitsPerWeek; c++) {
        commits.push(
          makeCommit(`2021-W${String(w).padStart(2, "0")}`, author, 100),
        );
      }
    }
    return commits;
  });
}

function runMeasurement(
  commits: MeasurementCommit[],
  sessions: MeasurementSession[],
  excludedHashes?: Set<string>,
) {
  const excluded: ExcludedHash[] = excludedHashes
    ? [...excludedHashes].map((hash) => ({ hash, reason: "auto" as const }))
    : [];
  return toMeasurement({ commits, sessions, excludedHashes: excluded });
}

describe("toMeasurement", () => {
  describe("basic scoring", () => {
    it("returns score 0 for zero activity", () => {
      // Setup SUT
      const commits = [makeCommit("2025-W01", "dev@example.com", 0, 0)];

      // Exercise
      const result = runMeasurement(commits, []);

      // Verify
      expect(result.currentScore).toBe(0);
    });

    it("returns score 0 when session time covers all additions", () => {
      // Setup SUT — 800 additions, 25h session = 1000 LOC capacity.
      // Core history (excluded) builds up contributor profile and codebase
      // size without generating slop.
      const history = coreHistory(["dev@example.com"]);
      const excludedHashes = new Set(history.map((c) => c.hash));
      const commits = [
        ...history,
        ...weeklyCommits([{ additions: 800, deletions: 0 }]),
      ];
      const sessions = weeklySessions(["2025-W01"], 25);

      // Exercise
      const result = runMeasurement(commits, sessions, excludedHashes);

      // Verify
      expect(result.currentScore).toBe(0);
    });

    it("returns positive score when additions exceed session-based attention", () => {
      // Setup SUT — build up codebase past bootstrap, then add a big week
      // with insufficient session time
      const commits = weeklyCommits([
        { additions: 800, deletions: 0 },
        { additions: 800, deletions: 0 },
        { additions: 800, deletions: 0 },
        { additions: 800, deletions: 0 },
        { additions: 800, deletions: 0 },
        { additions: 800, deletions: 0 },
        { additions: 800, deletions: 0 },
        { additions: 3000, deletions: 0 },
      ]);
      const sessions = [
        ...weeklySessions(
          Array.from({ length: 7 }, (_, i) => weekLabel(i)),
          25,
        ),
        makeSession("2025-W08", "dev@example.com", 2), // only 2h = 80 LOC
      ];

      // Exercise
      const result = runMeasurement(commits, sessions);

      // Verify
      expect(result.currentScore).toBeGreaterThan(0);
    });

    it("returns score between 0 and 1", () => {
      // Setup SUT
      const commits = weeklyCommits([
        { additions: 5000, deletions: 0 },
        { additions: 5000, deletions: 0 },
      ]);

      // Exercise
      const result = runMeasurement(commits, []);

      // Verify
      expect(result.currentScore).toBeGreaterThanOrEqual(0);
      expect(result.currentScore).toBeLessThanOrEqual(1);
    });
  });

  describe("session-based attention spent", () => {
    it("more session hours reduce slop", () => {
      // Setup SUT
      const commits = [
        ...coreHistory(["dev@example.com"]),
        ...weeklyCommits([
          { additions: 800, deletions: 0 },
          { additions: 800, deletions: 0 },
          { additions: 800, deletions: 0 },
          { additions: 800, deletions: 0 },
          { additions: 800, deletions: 0 },
          { additions: 800, deletions: 0 },
          { additions: 5000, deletions: 0 },
        ]),
      ];

      const fewHoursSessions = weeklySessions(
        Array.from({ length: 7 }, (_, i) => weekLabel(i)),
        2,
      );
      const manyHoursSessions = weeklySessions(
        Array.from({ length: 7 }, (_, i) => weekLabel(i)),
        40,
      );

      // Exercise
      const scoreFewHours = runMeasurement(
        commits,
        fewHoursSessions,
      ).currentScore;
      const scoreManyHours = runMeasurement(
        commits,
        manyHoursSessions,
      ).currentScore;

      // Verify
      expect(scoreManyHours).toBeLessThan(scoreFewHours);
    });

    it("drive-by contributors' session time is discounted by core factor", () => {
      // Setup SUT — "core" has history, "driveby" does not
      const commits = [
        ...coreHistory(["core@example.com"]),
        ...weeklyCommits([
          { additions: 800, deletions: 0 },
          { additions: 800, deletions: 0 },
          { additions: 800, deletions: 0 },
          { additions: 800, deletions: 0 },
          { additions: 800, deletions: 0 },
          { additions: 800, deletions: 0 },
          { additions: 5000, deletions: 0 },
        ]),
      ];

      const coreSession = [makeSession("2025-W07", "core@example.com", 20)];
      const drivebySession = [
        makeSession("2025-W07", "driveby@example.com", 20),
      ];

      // Exercise
      const scoreCore = runMeasurement(commits, coreSession).currentScore;
      const scoreDriveby = runMeasurement(commits, drivebySession).currentScore;

      // Verify — drive-by has 0 core factor, so their time doesn't count
      expect(scoreDriveby).toBeGreaterThan(scoreCore);
    });
  });

  describe("weekly hour cap", () => {
    it("limits how much a single author can contribute per week", () => {
      // Setup SUT — two scenarios with the same total session time
      // (split across multiple short sessions to stay in the same week).
      // One author with many sessions vs two authors splitting them.
      const history = coreHistory(["a@example.com", "b@example.com"], {
        weeks: 30,
        commitsPerWeek: 5,
      });
      const excludedHashes = new Set(history.map((c) => c.hash));
      const commits = [
        ...history,
        makeCommit("2025-W01", "a@example.com", 10000),
      ];

      // 5 × 30h sessions for one author = 150h effective (after core
      // factor), well above the cap
      const oneAuthorSessions = Array.from({ length: 5 }, () =>
        makeSession("2025-W01", "a@example.com", 30),
      );
      // Split across two authors: each gets 2-3 × 30h sessions
      const twoAuthorSessions = [
        ...Array.from({ length: 3 }, () =>
          makeSession("2025-W01", "a@example.com", 30),
        ),
        ...Array.from({ length: 2 }, () =>
          makeSession("2025-W01", "b@example.com", 30),
        ),
      ];

      // Exercise
      const scoreOne = runMeasurement(
        commits,
        oneAuthorSessions,
        excludedHashes,
      ).currentScore;
      const scoreTwo = runMeasurement(
        commits,
        twoAuthorSessions,
        excludedHashes,
      ).currentScore;

      // Verify — two authors get more total effective hours because
      // each author's cap is applied independently
      expect(scoreTwo).toBeLessThan(scoreOne);
    });
  });

  describe("codebase size dampening", () => {
    it("dampens slop when codebase is small (under bootstrap threshold)", () => {
      // Setup SUT — a single week with 1000 adds and enough commits for
      // a non-zero core factor, plus generous session time. With only
      // 1000 cumulative lines, dampening = 1000/5000 = 0.2, so the
      // attention cost is much lower than the raw line count.
      const coreAuthor = "dev@example.com";
      const commits = Array.from({ length: 15 }, () =>
        makeCommit("2025-W01", coreAuthor, 1000 / 15),
      );
      const sessions = [makeSession("2025-W01", coreAuthor, 5)];

      // Exercise
      const result = runMeasurement(commits, sessions);

      // Verify — score is less than 1 because dampening reduces the
      // attention cost below the raw line count, letting session time
      // cover part of it
      expect(result.currentScore).toBeGreaterThan(0);
      expect(result.currentScore).toBeLessThan(1);
    });

    it("applies lower dampening for small codebase than large one", () => {
      // Setup SUT — two repos get the same 3000-line addition in different
      // weeks, but one has a large pre-existing codebase. Both have enough
      // commits for a non-zero core factor and the same session time for the
      // week under test, so the only difference is codebase-size dampening.
      const coreAuthor = "dev@example.com";

      const smallCommits = Array.from({ length: 15 }, () =>
        makeCommit(weekLabel(0), coreAuthor, 200),
      );
      const smallSessions = [makeSession(weekLabel(0), coreAuthor, 20)];

      const rampUpCommits = Array.from({ length: 15 }, (_, weekIndex) =>
        makeCommit(weekLabel(weekIndex), coreAuthor, 800),
      );
      const largeCommits = [
        ...rampUpCommits,
        makeCommit(weekLabel(15), coreAuthor, 3000),
      ];
      const largeSessions = [
        ...rampUpCommits.map((_, weekIndex) =>
          makeSession(weekLabel(weekIndex), coreAuthor, 1),
        ),
        makeSession(weekLabel(15), coreAuthor, 20),
      ];

      // Exercise
      const scoreSmall = runMeasurement(
        smallCommits,
        smallSessions,
      ).currentScore;
      const scoreLarge = runMeasurement(
        largeCommits,
        largeSessions,
      ).currentScore;

      // Verify — small codebase has lower dampening, so the same additions
      // produce a lower attention cost → lower score
      expect(scoreSmall).toBeLessThan(scoreLarge);
    });
  });

  describe("week gap filling", () => {
    it("fills inactive weeks between active weeks", () => {
      // Setup SUT
      const commits = [
        makeCommit("2025-W01", "dev@example.com", 2000),
        makeCommit("2025-W04", "dev@example.com", 2000),
      ];

      // Exercise
      const result = runMeasurement(commits, []);

      // Verify
      expect(result.history).toHaveLength(4);
      expect(result.history[0]!.week).toBe("2025-W01");
      expect(result.history[1]!.week).toBe("2025-W02");
      expect(result.history[2]!.week).toBe("2025-W03");
      expect(result.history[3]!.week).toBe("2025-W04");
    });

    it("gap weeks maintain cumulative score", () => {
      // Setup SUT
      const commits = [
        ...weeklyCommits(
          Array.from({ length: 7 }, () => ({
            additions: 800,
            deletions: 0,
          })),
        ),
        makeCommit("2025-W07", "dev@example.com", 5000),
        // Gap at W08, W09
        makeCommit("2025-W10", "dev@example.com", 5000),
      ];

      // Exercise
      const result = runMeasurement(commits, []);

      // Verify
      const scoreW07 = result.history.find((h) => h.week === "2025-W07")!.score;
      const scoreW08 = result.history.find((h) => h.week === "2025-W08")!.score;
      const scoreW09 = result.history.find((h) => h.week === "2025-W09")!.score;
      expect(scoreW08).toBe(scoreW07);
      expect(scoreW09).toBe(scoreW07);
    });
  });

  describe("edge cases", () => {
    it("handles empty commit list", () => {
      // Exercise
      const result = runMeasurement([], []);

      // Verify
      expect(result.currentScore).toBe(0);
      expect(result.history).toEqual([]);
    });

    it("handles bot-only commits gracefully", () => {
      // Setup SUT
      const commits = [
        makeCommit(
          "2025-W01",
          "27856297+dependabot[bot]@users.noreply.github.com",
          2000,
        ),
      ];

      // Exercise
      const result = runMeasurement(commits, []);

      // Verify
      expect(Number.isFinite(result.currentScore)).toBe(true);
    });

    it("scores never go below 0", () => {
      // Setup SUT — massive session time relative to additions
      const commits = weeklyCommits([
        { additions: 100, deletions: 0 },
        { additions: 100, deletions: 0 },
      ]);
      const sessions = weeklySessions(["2025-W01", "2025-W02"], 100);

      // Exercise
      const result = runMeasurement(commits, sessions);

      // Verify
      for (const entry of result.history) {
        expect(entry.score).toBeGreaterThanOrEqual(0);
      }
    });

    it("score never exceeds 1 even with complexity bonus on large codebases", () => {
      // Setup SUT — large codebase where sizeDampening > 1.0
      const commits = weeklyCommits(
        Array.from({ length: 200 }, () => ({ additions: 5000, deletions: 0 })),
      );

      // Exercise
      const result = runMeasurement(commits, []);

      // Verify
      for (const entry of result.history) {
        expect(entry.score).toBeLessThanOrEqual(1);
      }
    });

    it("returns full history for all weeks", () => {
      // Setup SUT
      const commits = weeklyCommits(
        Array.from({ length: 20 }, () => ({ additions: 100, deletions: 0 })),
      );

      // Exercise
      const result = runMeasurement(commits, []);

      // Verify
      expect(result.history).toHaveLength(20);
    });
  });

  describe("weeklyDiagnostics", () => {
    it("returns one diagnostics entry per history entry", () => {
      // Setup SUT
      const commits = weeklyCommits([
        { additions: 1000, deletions: 0 },
        { additions: 2000, deletions: 0 },
        { additions: 500, deletions: 200 },
      ]);

      // Exercise
      const result = runMeasurement(commits, []);

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
      const history = coreHistory(["dev@example.com"]);
      const excludedHashes = new Set(history.map((c) => c.hash));
      const commits = [
        ...history,
        ...weeklyCommits([{ additions: 3000, deletions: 500 }]),
      ];
      const sessions = [makeSession("2025-W01", "dev@example.com", 20)];

      // Exercise
      const result = runMeasurement(commits, sessions, excludedHashes);
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
      const history = coreHistory(["dev@example.com"]);
      const excludedHashes = new Set(history.map((c) => c.hash));
      const commits = [
        ...history,
        ...weeklyCommits([{ additions: 3000, deletions: 0 }]),
      ];
      const sessions = [makeSession("2025-W01", "dev@example.com", 20)];

      // Exercise
      const result = runMeasurement(commits, sessions, excludedHashes);
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

    it("returns empty diagnostics for empty commits", () => {
      // Exercise
      const result = runMeasurement([], []);

      // Verify
      expect(result.weeklyDiagnostics).toEqual([]);
    });
  });
});

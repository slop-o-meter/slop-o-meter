import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import toMeasurement from "./GitMeasurement.js";
import type { Session } from "./sessions.js";
import type Commit from "./types.js";

// --- Helpers ---

function makeCommit(
  week: string,
  author: string,
  additions: number,
  deletions = 0,
): Commit {
  const dt = DateTime.fromISO(week);
  return {
    hash: `${week}-${author}-${String(additions)}`,
    week,
    timestamp: dt.toISO()!,
    author,
    subject: "",
    additions,
    deletions,
    fileStats: [],
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
): Commit[] {
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
): Session {
  const endTime = DateTime.fromISO(week).plus({ days: 3, hours: 10 });
  const startTime = endTime.minus({ hours: durationHours });
  return { author, startTime, endTime, durationHours };
}

function weeklySessions(
  weeks: string[],
  hoursPerWeek: number,
  author = "dev@example.com",
): Session[] {
  return weeks.map((week) => makeSession(week, author, hoursPerWeek));
}

// Creates background commits to build up contributor profiles
function coreHistory(
  authors: string[],
  options?: { weeks?: number; commitsPerWeek?: number },
): Commit[] {
  const weeks = options?.weeks ?? 15;
  const commitsPerWeek = options?.commitsPerWeek ?? 5;
  return authors.flatMap((author) => {
    const commits: Commit[] = [];
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

describe("toMeasurement", () => {
  describe("basic scoring", () => {
    it("returns score 0 for zero activity", () => {
      // Setup SUT
      const commits = [makeCommit("2025-W01", "dev@example.com", 0, 0)];

      // Exercise
      const result = toMeasurement(commits, []);

      // Verify
      expect(result.currentScore).toBe(0);
    });

    it("returns score 0 when session time covers all additions", () => {
      // Setup SUT — 800 additions, 25h session = 1000 LOC capacity
      const commits = weeklyCommits([{ additions: 800, deletions: 0 }]);
      const sessions = weeklySessions(["2025-W01"], 25);

      // Exercise
      const result = toMeasurement(commits, sessions);

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
      const result = toMeasurement(commits, sessions);

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
      const result = toMeasurement(commits, []);

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
      const scoreFewHours = toMeasurement(
        commits,
        fewHoursSessions,
      ).currentScore;
      const scoreManyHours = toMeasurement(
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
      const scoreCore = toMeasurement(commits, coreSession).currentScore;
      const scoreDriveby = toMeasurement(commits, drivebySession).currentScore;

      // Verify — drive-by has 0 core factor, so their time doesn't count
      expect(scoreDriveby).toBeGreaterThan(scoreCore);
    });
  });

  describe("codebase size dampening", () => {
    it("dampens slop when codebase is small (under bootstrap threshold)", () => {
      // Setup SUT — first week at 0 cumulative lines, dampening starts at 0
      const commits = weeklyCommits([
        { additions: 3000, deletions: 0 },
        { additions: 3000, deletions: 0 },
        { additions: 3000, deletions: 0 },
      ]);

      // Exercise
      const result = toMeasurement(commits, []);

      // Verify — first week has 0 slop (dampening = 0 at 0 lines)
      expect(result.history[0]!.score).toBe(0);
      expect(result.currentScore).toBeGreaterThan(0);
    });

    it("uses sqrt curve for bootstrap dampening", () => {
      // Setup SUT — compare dampened vs undampened by providing large baseline
      const smallCodebase = weeklyCommits([{ additions: 3000, deletions: 0 }]);
      const largeCodebase = [
        // Build up 10k lines first (past bootstrap threshold)
        ...weeklyCommits(
          Array.from({ length: 12 }, () => ({
            additions: 800,
            deletions: 0,
          })),
        ),
        makeCommit("2025-W13", "dev@example.com", 3000),
      ];

      // Exercise
      const scoreSmall = toMeasurement(smallCodebase, []).currentScore;
      const scoreLarge = toMeasurement(largeCodebase, []).currentScore;

      // Verify — small codebase should have less slop due to dampening
      // (even though it has fewer total lines, the dampening reduces excess)
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
      const result = toMeasurement(commits, []);

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
      const result = toMeasurement(commits, []);

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
      const result = toMeasurement([], []);

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
      const result = toMeasurement(commits, []);

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
      const result = toMeasurement(commits, sessions);

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
      const result = toMeasurement(commits, []);

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
      const result = toMeasurement(commits, []);

      // Verify
      expect(result.history).toHaveLength(20);
    });
  });
});

import { DateTime } from "luxon";
import aggregateCommits, {
  type ContributorProfile,
  type WeeklyData,
} from "./aggregation.js";
import type { Session } from "./sessions.js";
import type Commit from "./types.js";

// --- Constants ---

const BOOTSTRAP_THRESHOLD = 5_000;
const COMPLEXITY_WEIGHT = 0.05;
const LINES_PER_HOUR = 40;
const CORE_RAMP_START = 10;
const CORE_RAMP_END = 60;
const WEEKLY_HOURS_FULL = 40;
const WEEKLY_HOURS_CAP = 80;

// --- Main Entry Point ---

export default function toMeasurement(
  commits: Commit[],
  sessions: Session[],
  excludedHashes: Set<string> = new Set(),
): { currentScore: number; history: { week: string; score: number }[] } {
  const { weeklyData, contributorProfiles } = aggregateCommits(
    commits,
    excludedHashes,
  );
  const completeWeeklyData = fillWeekGaps(weeklyData);

  if (completeWeeklyData.length === 0) {
    return { currentScore: 0, history: [] };
  }

  // Pre-compute session hours per week, weighted by contributor core factor
  const weeklyEffectiveHours = computeWeeklyEffectiveHours(
    sessions,
    contributorProfiles,
  );

  let cumulativeSlop = 0;
  let cumulativeRawLines = 0;
  let cumulativeDampenedLines = 0;

  const history = completeWeeklyData.map((weekData) => {
    // Total additions/deletions include both normal and excluded commits.
    // Excluded commits contribute to codebase size but not to excess.
    const totalAdditions =
      weekData.weightedAdditions + weekData.excludedAdditions;
    const totalDeletions =
      weekData.weightedDeletions + weekData.excludedDeletions;

    // Step 1: Update cumulative raw lines so this week's own additions
    // factor into the dampening. Without this, a repo whose entire
    // history lands in a single week would have dampening=0 and always
    // score 0.
    cumulativeRawLines = Math.max(
      0,
      cumulativeRawLines + totalAdditions - totalDeletions,
    );

    // Step 2: Apply codebase size dampening to compute attention cost.
    const sizeDampening = computeSizeDampening(cumulativeRawLines);
    const netAdditions = Math.max(
      0,
      weekData.weightedAdditions - weekData.weightedDeletions,
    );
    const attentionCost = netAdditions * sizeDampening;

    // Step 3: Compute attention spent from session time
    const effectiveHours = weeklyEffectiveHours.get(weekData.week) ?? 0;
    const attentionSpent = effectiveHours * LINES_PER_HOUR;

    // Step 4: Compute excess (slop for this week)
    const excess = Math.max(0, attentionCost - attentionSpent);

    // Step 5: Update remaining cumulative totals
    cumulativeDampenedLines = Math.max(
      0,
      cumulativeDampenedLines +
        Math.max(0, totalAdditions - totalDeletions) * sizeDampening,
    );
    cumulativeSlop = Math.max(0, cumulativeSlop + excess);

    // Step 6: Compute score as ratio (0 to 1).
    // Use dampened lines as denominator so the ratio stays consistent:
    // both numerator (slop) and denominator (total cost) include dampening.
    const score =
      cumulativeDampenedLines > 0
        ? cumulativeSlop / cumulativeDampenedLines
        : 0;

    return { week: weekData.week, score };
  });

  const currentScore =
    history.length > 0 ? history[history.length - 1]!.score : 0;

  return { currentScore, history };
}

// --- Codebase Size Dampening ---

function computeSizeDampening(cumulativeWeightedLines: number): number {
  const bootstrap = Math.min(1, cumulativeWeightedLines / BOOTSTRAP_THRESHOLD);
  const complexityBonus =
    COMPLEXITY_WEIGHT * Math.log2(1 + cumulativeWeightedLines / 100_000);
  return bootstrap + complexityBonus;
}

// --- Effective Hours (Session Time × Core Factor) ---

function computeWeeklyEffectiveHours(
  sessions: Session[],
  contributorProfiles: Map<string, ContributorProfile>,
): Map<string, number> {
  // First, accumulate raw effective hours per author per week
  const authorWeekHours = new Map<string, Map<string, number>>();

  for (const session of sessions) {
    const week = `${String(session.startTime.weekYear)}-W${String(session.startTime.weekNumber).padStart(2, "0")}`;
    const coreFactor = computeCoreFactor(
      contributorProfiles.get(session.author),
    );
    const effectiveHours = session.durationHours * coreFactor;

    let weekMap = authorWeekHours.get(session.author);
    if (!weekMap) {
      weekMap = new Map();
      authorWeekHours.set(session.author, weekMap);
    }
    weekMap.set(week, (weekMap.get(week) ?? 0) + effectiveHours);
  }

  // Then, apply per-author weekly cap and sum across authors
  const weekHours = new Map<string, number>();

  for (const [, weekMap] of authorWeekHours) {
    for (const [week, rawHours] of weekMap) {
      const cappedHours = capWeeklyHours(rawHours);
      weekHours.set(week, (weekHours.get(week) ?? 0) + cappedHours);
    }
  }

  return weekHours;
}

/**
 * Caps a single contributor's weekly effective hours. The first
 * WEEKLY_HOURS_FULL hours count fully; hours between WEEKLY_HOURS_FULL
 * and WEEKLY_HOURS_CAP degrade linearly to zero; hours above
 * WEEKLY_HOURS_CAP contribute nothing.
 */
function capWeeklyHours(hours: number): number {
  if (hours <= WEEKLY_HOURS_FULL) {
    return hours;
  }
  if (hours >= WEEKLY_HOURS_CAP) {
    return WEEKLY_HOURS_FULL + (WEEKLY_HOURS_CAP - WEEKLY_HOURS_FULL) / 2;
  }
  const overageRatio =
    (hours - WEEKLY_HOURS_FULL) / (WEEKLY_HOURS_CAP - WEEKLY_HOURS_FULL);
  const overageHours = hours - WEEKLY_HOURS_FULL;
  return WEEKLY_HOURS_FULL + overageHours * (1 - overageRatio);
}

// --- Core Factor ---

function computeCoreFactor(profile: ContributorProfile | undefined): number {
  if (!profile) {
    return 0;
  }

  const ramp = Math.min(
    1,
    Math.max(
      0,
      (profile.totalCommits - CORE_RAMP_START) /
        (CORE_RAMP_END - CORE_RAMP_START),
    ),
  );

  const veteranMultiplier = 1 + 0.25 * profile.commitShare;

  return ramp * veteranMultiplier;
}

// --- Week Gap Filling ---

const EMPTY_WEEK: Omit<WeeklyData, "week"> = {
  weightedAdditions: 0,
  weightedDeletions: 0,
  excludedAdditions: 0,
  excludedDeletions: 0,
  activeContributors: [],
};

function fillWeekGaps(weeklyData: WeeklyData[]): WeeklyData[] {
  if (weeklyData.length <= 1) {
    return weeklyData;
  }

  const firstWeek = weeklyData[0]!.week;
  const lastWeek = weeklyData[weeklyData.length - 1]!.week;
  const allWeeks = generateIsoWeekRange(firstWeek, lastWeek);

  const dataByWeek = new Map<string, WeeklyData>();
  for (const week of weeklyData) {
    dataByWeek.set(week.week, week);
  }

  return allWeeks.map(
    (week) => dataByWeek.get(week) ?? { ...EMPTY_WEEK, week },
  );
}

function generateIsoWeekRange(startWeek: string, endWeek: string): string[] {
  const weeks: string[] = [];
  let current = DateTime.fromISO(startWeek);
  const end = DateTime.fromISO(endWeek);
  while (current <= end) {
    weeks.push(
      `${String(current.weekYear)}-W${String(current.weekNumber).padStart(2, "0")}`,
    );
    current = current.plus({ weeks: 1 });
  }
  return weeks;
}

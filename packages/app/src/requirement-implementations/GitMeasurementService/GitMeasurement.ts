import { DateTime } from "luxon";
import type {
  ContributorWeekDiagnostics,
  MeasurementData,
  MeasurementDiagnostics,
  MeasurementSession,
  WeeklyDiagnostics,
} from "../../requirements/MeasurementService.js";
import aggregateCommits, {
  type ContributorProfile,
  type WeeklyData,
} from "./aggregation.js";
import { computeSessions, type Session } from "./sessions.js";
import type { Signal } from "./signals.js";

// --- Constants ---

const BOOTSTRAP_THRESHOLD = 5_000;
const COMPLEXITY_WEIGHT = 0.05;
const LINES_PER_HOUR = 40;
const CORE_RAMP_START = 10;
const CORE_RAMP_END = 60;
const WEEKLY_HOURS_FULL = 40;
const WEEKLY_HOURS_CAP = 80;

// --- Types ---

interface AuthorWeekDetail {
  rawSessionHours: number;
  coreFactor: number;
  effectiveHours: number;
  cappedHours: number;
}

interface WeeklyEffectiveHoursResult {
  weekTotals: Map<string, number>;
  authorWeekDetail: Map<string, Map<string, AuthorWeekDetail>>;
}

// --- Main Entry Point ---

export type WeeklyCapMode = "linear-ramp" | "cosine" | "concave";

export interface MeasurementOptions {
  humanLinesPerHour?: number;
  overtimeCurve?: WeeklyCapMode;
  fullCreditHoursPerWeek?: number;
  maxHoursPerWeek?: number;
  minCommitsForCredit?: number;
  commitsForFullCredit?: number;
  smallRepoThreshold?: number;
  largeRepoComplexityBonus?: number;
}

export interface MeasurementOutput {
  currentScore: number;
  history: { week: string; score: number }[];
  diagnostics: MeasurementDiagnostics;
}

export default function toMeasurement(
  data: Pick<MeasurementData, "commits" | "signals" | "excludedHashes">,
  options?: MeasurementOptions,
): MeasurementOutput {
  const excludedHashSet = new Set(data.excludedHashes.map((eh) => eh.hash));
  const { weeklyData, contributorProfiles } = aggregateCommits(
    data.commits,
    excludedHashSet,
  );
  const completeWeeklyData = fillWeekGaps(weeklyData);

  if (completeWeeklyData.length === 0) {
    return {
      currentScore: 0,
      history: [],
      diagnostics: { sessions: [], weeklyDiagnostics: [] },
    };
  }

  const linesPerHour = options?.humanLinesPerHour ?? LINES_PER_HOUR;
  const weeklyCapMode = options?.overtimeCurve ?? "concave";
  const bootstrapThreshold = options?.smallRepoThreshold ?? BOOTSTRAP_THRESHOLD;
  const complexityWeight =
    options?.largeRepoComplexityBonus ?? COMPLEXITY_WEIGHT;
  const coreRampStart = options?.minCommitsForCredit ?? CORE_RAMP_START;
  const coreRampEnd = options?.commitsForFullCredit ?? CORE_RAMP_END;
  const weeklyHoursFull = options?.fullCreditHoursPerWeek ?? WEEKLY_HOURS_FULL;
  const weeklyHoursCap = options?.maxHoursPerWeek ?? WEEKLY_HOURS_CAP;

  // Derive sessions from signals
  const signalObjects: Signal[] = data.signals.map((signal) => ({
    timestamp: signal.timestamp,
    author: signal.author,
    neighborhoodHours: signal.neighborhoodHours,
  }));
  const sessions = computeSessions(signalObjects);
  const serializedSessions: MeasurementSession[] = sessions.map((session) => ({
    author: session.author,
    startTime: session.startTime.toISO()!,
    endTime: session.endTime.toISO()!,
    durationHours: session.durationHours,
  }));

  // Pre-compute session hours per week, weighted by contributor core factor
  const { weekTotals: weeklyEffectiveHours, authorWeekDetail } =
    computeWeeklyEffectiveHours(sessions, contributorProfiles, weeklyCapMode, {
      coreRampStart,
      coreRampEnd,
      weeklyHoursFull,
      weeklyHoursCap,
    });

  let cumulativeSlop = 0;
  let cumulativeRawLines = 0;
  let cumulativeDampenedLines = 0;

  const weeklyDiagnostics: WeeklyDiagnostics[] = [];

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
    const sizeDampening = computeSizeDampening(
      cumulativeRawLines,
      bootstrapThreshold,
      complexityWeight,
    );
    const netAdditions = Math.max(
      0,
      weekData.weightedAdditions - weekData.weightedDeletions,
    );
    const attentionCost = netAdditions * sizeDampening;

    // Step 3: Compute attention spent from session time
    const totalEffectiveHours = weeklyEffectiveHours.get(weekData.week) ?? 0;
    const attentionSpent = totalEffectiveHours * linesPerHour;

    // Step 4: Compute excess (slop for this week)
    const weeklyExcess = Math.max(0, attentionCost - attentionSpent);

    // Step 5: Update remaining cumulative totals
    cumulativeDampenedLines = Math.max(
      0,
      cumulativeDampenedLines +
        Math.max(0, totalAdditions - totalDeletions) * sizeDampening,
    );
    cumulativeSlop = Math.max(0, cumulativeSlop + weeklyExcess);

    // Step 6: Compute score as ratio (0 to 1).
    // Use dampened lines as denominator so the ratio stays consistent:
    // both numerator (slop) and denominator (total cost) include dampening.
    const score =
      cumulativeDampenedLines > 0
        ? cumulativeSlop / cumulativeDampenedLines
        : 0;

    // Collect per-contributor breakdown for this week
    const contributors = buildContributorDiagnostics(
      weekData.week,
      authorWeekDetail,
    );

    weeklyDiagnostics.push({
      week: weekData.week,
      score,
      weightedAdditions: weekData.weightedAdditions,
      weightedDeletions: weekData.weightedDeletions,
      excludedAdditions: weekData.excludedAdditions,
      excludedDeletions: weekData.excludedDeletions,
      cumulativeRawLines,
      sizeDampening,
      netAdditions,
      attentionCost,
      contributors,
      totalEffectiveHours,
      attentionSpent,
      weeklyExcess,
      cumulativeSlop,
      cumulativeDampenedLines,
    });

    return { week: weekData.week, score };
  });

  const currentScore =
    history.length > 0 ? history[history.length - 1]!.score : 0;

  return {
    currentScore,
    history,
    diagnostics: {
      sessions: serializedSessions,
      weeklyDiagnostics,
    },
  };
}

// --- Per-Contributor Diagnostics ---

function buildContributorDiagnostics(
  week: string,
  authorWeekDetail: Map<string, Map<string, AuthorWeekDetail>>,
): ContributorWeekDiagnostics[] {
  const contributors: ContributorWeekDiagnostics[] = [];

  for (const [author, weekMap] of authorWeekDetail) {
    const detail = weekMap.get(week);
    if (detail && detail.cappedHours > 0) {
      contributors.push({
        author,
        rawSessionHours: detail.rawSessionHours,
        coreFactor: detail.coreFactor,
        effectiveHours: detail.effectiveHours,
        cappedHours: detail.cappedHours,
      });
    }
  }

  return contributors.sort((a, b) => b.cappedHours - a.cappedHours);
}

// --- Codebase Size Dampening ---

function computeSizeDampening(
  cumulativeWeightedLines: number,
  bootstrapThreshold: number,
  complexityWeight: number,
): number {
  const bootstrap = Math.min(1, cumulativeWeightedLines / bootstrapThreshold);
  const complexityBonus =
    complexityWeight * Math.log2(1 + cumulativeWeightedLines / 100_000);
  return bootstrap + complexityBonus;
}

// --- Effective Hours (Session Time × Core Factor) ---

interface EffectiveHoursParams {
  coreRampStart: number;
  coreRampEnd: number;
  weeklyHoursFull: number;
  weeklyHoursCap: number;
}

function computeWeeklyEffectiveHours(
  sessions: Session[],
  contributorProfiles: Map<string, ContributorProfile>,
  weeklyCapMode: WeeklyCapMode,
  params: EffectiveHoursParams,
): WeeklyEffectiveHoursResult {
  // Accumulate raw session hours and effective hours per author per week
  const authorWeekRaw = new Map<string, Map<string, number>>();
  const authorCoreFactors = new Map<string, number>();

  for (const session of sessions) {
    const week = `${String(session.startTime.weekYear)}-W${String(session.startTime.weekNumber).padStart(2, "0")}`;
    const coreFactor = computeCoreFactor(
      contributorProfiles.get(session.author),
      params.coreRampStart,
      params.coreRampEnd,
    );
    authorCoreFactors.set(session.author, coreFactor);

    let weekMap = authorWeekRaw.get(session.author);
    if (!weekMap) {
      weekMap = new Map();
      authorWeekRaw.set(session.author, weekMap);
    }
    weekMap.set(week, (weekMap.get(week) ?? 0) + session.durationHours);
  }

  // Apply per-author weekly cap and build detail maps
  const weekTotals = new Map<string, number>();
  const authorWeekDetail = new Map<string, Map<string, AuthorWeekDetail>>();

  for (const [author, weekMap] of authorWeekRaw) {
    const coreFactor = authorCoreFactors.get(author) ?? 0;
    const detailMap = new Map<string, AuthorWeekDetail>();
    authorWeekDetail.set(author, detailMap);

    for (const [week, rawSessionHours] of weekMap) {
      const effectiveHours = rawSessionHours * coreFactor;
      const cappedHours = capWeeklyHours(
        effectiveHours,
        weeklyCapMode,
        params.weeklyHoursFull,
        params.weeklyHoursCap,
      );

      detailMap.set(week, {
        rawSessionHours,
        coreFactor,
        effectiveHours,
        cappedHours,
      });

      weekTotals.set(week, (weekTotals.get(week) ?? 0) + cappedHours);
    }
  }

  return { weekTotals, authorWeekDetail };
}

/**
 * Caps a single contributor's weekly effective hours using one of three
 * marginal-rate curves. All curves reach zero marginal value at
 * WEEKLY_HOURS_CAP hours.
 *
 * "linear-ramp": flat at 1.0 until WEEKLY_HOURS_FULL, then linear
 *   decline to 0 at WEEKLY_HOURS_CAP. (Original behavior.)
 * "cosine": S-curve from hour 0, marginal = (1 + cos(πh/cap)) / 2.
 *   Integral at cap = cap/2.
 * "concave": gentle early decline, steep late, marginal = 1 - (h/cap)².
 *   Integral at cap = 2*cap/3.
 */
function capWeeklyHours(
  hours: number,
  mode: WeeklyCapMode,
  weeklyHoursFull: number,
  weeklyHoursCap: number,
): number {
  const capped = Math.min(hours, weeklyHoursCap);

  switch (mode) {
    case "linear-ramp": {
      if (capped <= weeklyHoursFull) {
        return capped;
      }
      const overageRatio =
        (capped - weeklyHoursFull) / (weeklyHoursCap - weeklyHoursFull);
      const overageHours = capped - weeklyHoursFull;
      return weeklyHoursFull + overageHours * (1 - overageRatio);
    }
    case "cosine": {
      return (
        capped / 2 +
        (weeklyHoursCap / (2 * Math.PI)) *
          Math.sin((Math.PI * capped) / weeklyHoursCap)
      );
    }
    case "concave": {
      return capped - capped ** 3 / (3 * weeklyHoursCap ** 2);
    }
  }
}

// --- Core Factor ---

function computeCoreFactor(
  profile: ContributorProfile | undefined,
  coreRampStart: number,
  coreRampEnd: number,
): number {
  if (!profile) {
    return 0;
  }

  const ramp = Math.min(
    1,
    Math.max(
      0,
      (profile.totalCommits - coreRampStart) / (coreRampEnd - coreRampStart),
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

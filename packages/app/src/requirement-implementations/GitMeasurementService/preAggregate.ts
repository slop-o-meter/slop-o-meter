import { DateTime } from "luxon";
import type {
  GithubEvent,
  MeasurementData,
  MeasurementSession,
  PreAggregatedData,
  WeeklyCommitData,
  WeeklySessionHoursEntry,
} from "../../requirements/MeasurementService.js";
import aggregateCommits from "./aggregation.js";
import { isBotContributor } from "./aggregation.js";
import { computeSessions } from "./sessions.js";
import type { Signal } from "./signals.js";

// --- Constants ---

const BASE_NEIGHBORHOOD = 1;
const MARGINAL_HOURS_PER_SUBCOMMIT = 1;
const AI_CO_AUTHOR_ATTENTION_WEIGHT = 0.8;
const CO_AUTHOR_WEIGHTS = [0.5, 0.25, 0.125];

// --- Main Entry Point ---

export interface PreAggregateResult {
  preAggregatedData: PreAggregatedData;
  sessions: MeasurementSession[];
}

export default function preAggregate(
  data: MeasurementData,
): PreAggregateResult {
  // Step 1: Generate signals from raw data
  const signals = generateSignals(data);

  // Step 2: Compute sessions from signals
  const sessions = computeSessions(signals);
  const serializedSessions: MeasurementSession[] = sessions.map((session) => ({
    author: session.author,
    startTime: session.startTime.toISO()!,
    endTime: session.endTime.toISO()!,
    durationHours: session.durationHours,
  }));

  // Step 3: Aggregate sessions to per-author-per-week hours
  const weeklySessionHours = aggregateSessionHours(sessions);

  // Step 4: Aggregate commits by week
  const excludedHashSet = new Set(data.excludedHashes.map((eh) => eh.hash));
  const { weeklyData, contributorProfiles } = aggregateCommits(
    data.commits,
    excludedHashSet,
  );
  const weeklyCommitData = fillWeekGaps(
    weeklyData.map((week) => ({
      week: week.week,
      weightedAdditions: week.weightedAdditions,
      weightedDeletions: week.weightedDeletions,
      excludedAdditions: week.excludedAdditions,
      excludedDeletions: week.excludedDeletions,
    })),
  );

  // Step 5: Serialize contributor profiles
  const contributorProfileEntries = Array.from(
    contributorProfiles.entries(),
  ).map(([author, profile]) => ({
    author,
    totalCommits: profile.totalCommits,
    commitShare: profile.commitShare,
  }));

  return {
    preAggregatedData: {
      weeklyCommitData,
      contributorProfiles: contributorProfileEntries,
      weeklySessionHours,
    },
    sessions: serializedSessions,
  };
}

// --- Signal Generation ---

function generateSignals(data: MeasurementData): Signal[] {
  const commitSignals: Signal[] = data.commits
    .filter((commit) => !isBotContributor(commit.author))
    .map((commit) => {
      const hasAiCoAuthor = commit.coAuthors.some((coAuthor) =>
        isBotContributor(coAuthor),
      );
      return {
        timestamp: commit.timestamp,
        author: commit.author,
        neighborhoodHours:
          computeCommitNeighborhood(commit.subCommitCount) *
          (hasAiCoAuthor ? AI_CO_AUTHOR_ATTENTION_WEIGHT : 1),
      };
    });

  const coAuthorSignals: Signal[] = data.commits.flatMap((commit) =>
    (commit.coAuthors ?? [])
      .filter((coAuthor) => !isBotContributor(coAuthor))
      .map((coAuthor, index) => ({
        timestamp: commit.timestamp,
        author: coAuthor,
        neighborhoodHours:
          BASE_NEIGHBORHOOD *
          (CO_AUTHOR_WEIGHTS[index] ??
            CO_AUTHOR_WEIGHTS[CO_AUTHOR_WEIGHTS.length - 1]!),
      })),
  );

  const githubEventSignals: Signal[] = data.githubEvents
    .filter((event) => !isBotContributor(event.author))
    .map((event: GithubEvent) => ({
      timestamp: event.timestamp,
      author: event.author,
      neighborhoodHours: BASE_NEIGHBORHOOD,
    }));

  return [...commitSignals, ...coAuthorSignals, ...githubEventSignals];
}

function computeCommitNeighborhood(subCommitCount: number): number {
  if (subCommitCount >= 2) {
    return BASE_NEIGHBORHOOD + subCommitCount * MARGINAL_HOURS_PER_SUBCOMMIT;
  }
  return BASE_NEIGHBORHOOD;
}

// --- Session Aggregation ---

function aggregateSessionHours(
  sessions: { author: string; startTime: DateTime; durationHours: number }[],
): WeeklySessionHoursEntry[] {
  const authorWeekHours = new Map<string, Map<string, number>>();

  for (const session of sessions) {
    const week = `${String(session.startTime.weekYear)}-W${String(session.startTime.weekNumber).padStart(2, "0")}`;
    let weekMap = authorWeekHours.get(session.author);
    if (!weekMap) {
      weekMap = new Map();
      authorWeekHours.set(session.author, weekMap);
    }
    weekMap.set(week, (weekMap.get(week) ?? 0) + session.durationHours);
  }

  const entries: WeeklySessionHoursEntry[] = [];
  for (const [author, weekMap] of authorWeekHours) {
    for (const [week, hours] of weekMap) {
      entries.push({ author, week, hours });
    }
  }
  return entries;
}

// --- Week Gap Filling ---

const EMPTY_WEEK: Omit<WeeklyCommitData, "week"> = {
  weightedAdditions: 0,
  weightedDeletions: 0,
  excludedAdditions: 0,
  excludedDeletions: 0,
};

function fillWeekGaps(weeklyData: WeeklyCommitData[]): WeeklyCommitData[] {
  if (weeklyData.length <= 1) {
    return weeklyData;
  }

  const firstWeek = weeklyData[0]!.week;
  const lastWeek = weeklyData[weeklyData.length - 1]!.week;
  const allWeeks = generateIsoWeekRange(firstWeek, lastWeek);

  const dataByWeek = new Map<string, WeeklyCommitData>();
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

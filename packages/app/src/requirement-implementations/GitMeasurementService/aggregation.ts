import type { MeasurementCommit } from "../../requirements/MeasurementService.js";

export interface WeeklyData {
  week: string;
  weightedAdditions: number;
  weightedDeletions: number;
  excludedAdditions: number;
  excludedDeletions: number;
  activeContributors: string[];
}

export interface ContributorProfile {
  totalCommits: number;
  commitShare: number;
}

export default function aggregateCommits(
  allCommits: MeasurementCommit[],
  excludedHashes: Set<string> = new Set(),
): {
  weeklyData: WeeklyData[];
  contributorProfiles: Map<string, ContributorProfile>;
} {
  if (allCommits.length === 0) {
    return { weeklyData: [], contributorProfiles: new Map() };
  }

  // Count non-bot commits per author for contributor profiles.
  // Co-authors count the same as the primary author.
  const nonBotCommits = allCommits.filter(
    (commit) => !isBotContributor(commit.author),
  );
  const commitCounts = new Map<string, number>();
  let totalNonBotContributions = 0;
  for (const commit of nonBotCommits) {
    commitCounts.set(commit.author, (commitCounts.get(commit.author) ?? 0) + 1);
    totalNonBotContributions++;
    const coAuthors = commit.coAuthors ?? [];
    for (const coAuthor of coAuthors) {
      if (!isBotContributor(coAuthor)) {
        commitCounts.set(coAuthor, (commitCounts.get(coAuthor) ?? 0) + 1);
        totalNonBotContributions++;
      }
    }
  }

  // Build weekly buckets
  const weekMap = new Map<
    string,
    {
      weightedAdditions: number;
      weightedDeletions: number;
      excludedAdditions: number;
      excludedDeletions: number;
      activeContributors: Set<string>;
    }
  >();

  const ensureWeek = (week: string) => {
    if (!weekMap.has(week)) {
      weekMap.set(week, {
        weightedAdditions: 0,
        weightedDeletions: 0,
        excludedAdditions: 0,
        excludedDeletions: 0,
        activeContributors: new Set(),
      });
    }
    return weekMap.get(week)!;
  };

  for (const commit of allCommits) {
    const isBot = isBotContributor(commit.author);
    const isExcluded = excludedHashes.has(commit.hash);

    const bucket = ensureWeek(commit.week);
    if (isExcluded) {
      bucket.excludedAdditions += commit.weightedAdditions;
      bucket.excludedDeletions += commit.weightedDeletions;
    } else {
      bucket.weightedAdditions += commit.weightedAdditions;
      bucket.weightedDeletions += commit.weightedDeletions;
    }

    // Non-bot authors and their co-authors count as active contributors
    if (!isBot) {
      bucket.activeContributors.add(commit.author);

      const coAuthors = commit.coAuthors ?? [];
      for (const coAuthor of coAuthors) {
        if (!isBotContributor(coAuthor)) {
          bucket.activeContributors.add(coAuthor);
        }
      }
    }
  }

  const weeklyData: WeeklyData[] = Array.from(weekMap.entries())
    .map(([week, data]) => ({
      week,
      weightedAdditions: data.weightedAdditions,
      weightedDeletions: data.weightedDeletions,
      excludedAdditions: data.excludedAdditions,
      excludedDeletions: data.excludedDeletions,
      activeContributors: Array.from(data.activeContributors),
    }))
    .sort((a, b) => a.week.localeCompare(b.week));

  // Build contributor profiles for non-bot authors
  const contributorProfiles = new Map<string, ContributorProfile>();
  for (const [author, count] of commitCounts) {
    contributorProfiles.set(author, {
      totalCommits: count,
      commitShare:
        totalNonBotContributions > 0 ? count / totalNonBotContributions : 0,
    });
  }

  return { weeklyData, contributorProfiles };
}

// --- Bot Detection ---

const BOT_NAMES = new Set([
  "dependabot[bot]",
  "renovate[bot]",
  "greenkeeper[bot]",
  "snyk-bot",
  "pyup-bot",
  "github-actions[bot]",
  "github-merge-queue[bot]",
  "codecov[bot]",
  "sonarcloud[bot]",
  "mergify[bot]",
  "semantic-release-bot",
  "devin[bot]",
  "copilot[bot]",
]);

const BOT_EMAIL_PATTERNS = [
  /\[bot\]@users\.noreply\.github\.com$/,
  /^noreply@/,
  /^codex@/,
  /^claude@/,
  /^devin@/,
  /^copilot@/,
  /^aider@/,
  /^cursoragent@/,
];

export function isBotContributor(nameOrEmail: string): boolean {
  const lower = nameOrEmail.toLowerCase();
  if (lower.endsWith("[bot]")) {
    return true;
  }
  for (const botName of BOT_NAMES) {
    if (lower.includes(botName)) {
      return true;
    }
  }
  for (const pattern of BOT_EMAIL_PATTERNS) {
    if (pattern.test(lower)) {
      return true;
    }
  }
  return false;
}

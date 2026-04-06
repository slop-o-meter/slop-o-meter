import { exec as execCb } from "node:child_process";
import { promisify } from "node:util";
import type {
  ExcludedHash,
  MeasurementData,
  MeasurementSignal,
  OutlierClassificationEntry,
} from "../../requirements/MeasurementService.js";
import { isBotContributor } from "./aggregation.js";
import fetchGithubEventSignals from "./githubEvents.js";
import { getCommand, parseCommits, shellEscape } from "./gitLog.js";
import toMeasurement from "./GitMeasurement.js";
import buildIgnore from "./ignorePatterns.js";
import type { ClassifiedCommit } from "./outlierClassifier.js";
import OutlierClassifier from "./outlierClassifier.js";
import { detectOutlierCommits } from "./outlierCommits.js";
import { computeSessions } from "./sessions.js";
import type { Signal } from "./signals.js";
import type Commit from "./types.js";

const BASE_NEIGHBORHOOD = 1;
const MARGINAL_HOURS_PER_SUBCOMMIT = 1;

export type ProgressPhase =
  | "cloning"
  | "parsing"
  | "classifying_outliers"
  | "scoring";

interface GitMeasurementOptions {
  onProgress?: (
    phase: ProgressPhase,
    progress?: { current: number; total: number },
  ) => void | Promise<void>;
  outlierClassifier?: OutlierClassifier;
  minimumCommits?: number;
  githubToken?: string;
}

interface GitMeasurementResult {
  currentScore: number;
  history: { week: string; score: number }[];
  measurementData: MeasurementData;
}

interface GitMeasurement {
  measure(
    repoUrl: string,
    workDir: string,
    owner: string,
    repo: string,
  ): Promise<GitMeasurementResult>;
}

export default function createGitMeasurement(
  options?: GitMeasurementOptions,
): GitMeasurement {
  const onProgress = options?.onProgress;

  return {
    async measure(repoUrl, workDir, owner, repo) {
      await onProgress?.("cloning");
      await exec(
        `git clone --single-branch --no-tags --quiet ${shellEscape(repoUrl)} ${shellEscape(workDir)}`,
      );

      await onProgress?.("parsing");
      const toolIgnore = await buildIgnore(workDir);
      const gitLogOutput = await exec(getCommand(workDir));
      const allCommits = parseCommits(gitLogOutput, toolIgnore);

      if (
        options?.minimumCommits !== undefined &&
        allCommits.length < options.minimumCommits
      ) {
        throw new Error(
          `Not enough commits: repository has ${allCommits.length} commits but the minimum is ${options.minimumCommits}`,
        );
      }

      // Detect outlier commits
      let outlierClassifications: ClassifiedCommit[] = [];
      const { outlierCommits } = detectOutlierCommits(allCommits);

      // Auto-exclude first two commits if they are outliers
      const chronologicalCommits = [...allCommits].sort((a, b) =>
        a.timestamp.localeCompare(b.timestamp),
      );
      const firstTwoHashes = new Set(
        chronologicalCommits.slice(0, 2).map((c) => c.hash),
      );
      const autoExcludedHashes = new Set(
        outlierCommits
          .filter((c) => firstTwoHashes.has(c.hash))
          .map((c) => c.hash),
      );

      const allOutlierCandidates = outlierCommits.filter(
        (c) => !autoExcludedHashes.has(c.hash),
      );

      // Pre-2022 outlier commits get an automatic non-slop pass, since
      // AI-generated code was not a thing before then.
      const PRE_AI_CUTOFF = "2022-01-01";
      const preAiHashes = new Set(
        allOutlierCandidates
          .filter((c) => c.timestamp < PRE_AI_CUTOFF)
          .map((c) => c.hash),
      );
      const outlierCandidates = allOutlierCandidates.filter(
        (c) => !preAiHashes.has(c.hash),
      );

      // Track excluded hashes with reasons
      const excludedHashMap = new Map<string, ExcludedHash["reason"]>();
      for (const hash of autoExcludedHashes) {
        excludedHashMap.set(hash, "auto");
      }
      for (const hash of preAiHashes) {
        excludedHashMap.set(hash, "pre-ai");
      }

      if (outlierCandidates.length > 0 && options?.outlierClassifier) {
        await onProgress?.("classifying_outliers", {
          current: 0,
          total: outlierCandidates.length,
        });

        outlierClassifications =
          await options.outlierClassifier.classifyCommits(
            outlierCandidates,
            allCommits,
          );

        for (const result of outlierClassifications) {
          if (!result.classification.isSlop) {
            excludedHashMap.set(result.commit.hash, "classified");
          }
        }
      }

      // Build signals from all commits (excluded commits still generate sessions)
      const commitSignals: Signal[] = allCommits
        .filter((commit) => !isBotContributor(commit.author))
        .map((commit) => ({
          timestamp: commit.timestamp,
          author: commit.author,
          neighborhoodHours: computeCommitNeighborhood(commit.subCommitCount),
        }));

      // Build signals from co-authors. Each co-author gets a reduced
      // neighborhood: 0.5×, 0.25×, then 0.125× for all subsequent.
      // This reflects that co-authorship indicates contribution but not
      // necessarily active work at the commit's exact timestamp.
      const CO_AUTHOR_WEIGHTS = [0.5, 0.25, 0.125];
      const coAuthorSignals: Signal[] = allCommits.flatMap((commit) =>
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

      // Fetch GitHub event signals
      let githubSignals: Signal[] = [];
      try {
        githubSignals = await fetchGithubEventSignals({
          owner,
          repo,
          neighborhoodHours: BASE_NEIGHBORHOOD,
          commits: allCommits,
          githubToken: options?.githubToken,
        });
      } catch {
        // GitHub events are optional; continue without them
      }

      const allSignals = [
        ...commitSignals,
        ...coAuthorSignals,
        ...githubSignals.filter((signal) => !isBotContributor(signal.author)),
      ];
      const sessions = computeSessions(allSignals);

      await onProgress?.("scoring");
      const measurementData = buildMeasurementData(
        allCommits,
        allSignals,
        sessions,
        excludedHashMap,
        outlierClassifications,
      );

      const measurement = toMeasurement(measurementData);
      measurementData.weeklyDiagnostics = measurement.weeklyDiagnostics;

      return { ...measurement, measurementData };
    },
  };
}

function buildMeasurementData(
  allCommits: Commit[],
  allSignals: Signal[],
  sessions: import("./sessions.js").Session[],
  excludedHashMap: Map<string, ExcludedHash["reason"]>,
  outlierClassifications: ClassifiedCommit[],
): MeasurementData {
  const commits = allCommits.map((commit) => ({
    hash: commit.hash,
    week: commit.week,
    timestamp: commit.timestamp,
    author: commit.author,
    subject: commit.subject,
    weightedAdditions: Math.round(commit.additions),
    weightedDeletions: Math.round(commit.deletions),
    fileCount: commit.fileStats.length,
    coAuthors: commit.coAuthors ?? [],
    subCommitCount: commit.subCommitCount,
  }));

  const signals: MeasurementSignal[] = allSignals.map((signal) => ({
    timestamp: signal.timestamp,
    author: signal.author,
    neighborhoodHours: signal.neighborhoodHours,
  }));

  const serializedSessions = sessions.map((session) => ({
    author: session.author,
    startTime: session.startTime.toISO()!,
    endTime: session.endTime.toISO()!,
    durationHours: session.durationHours,
  }));

  const excludedHashes: ExcludedHash[] = [...excludedHashMap.entries()].map(
    ([hash, reason]) => ({ hash, reason }),
  );

  const classifications: OutlierClassificationEntry[] =
    outlierClassifications.map((c) => ({
      hash: c.commit.hash,
      isSlop: c.classification.isSlop,
      reason: c.classification.reason,
    }));

  return {
    commits,
    signals,
    sessions: serializedSessions,
    excludedHashes,
    outlierClassifications: classifications,
    weeklyDiagnostics: [],
  };
}

function computeCommitNeighborhood(subCommitCount: number): number {
  if (subCommitCount >= 2) {
    return BASE_NEIGHBORHOOD + subCommitCount * MARGINAL_HOURS_PER_SUBCOMMIT;
  }
  return BASE_NEIGHBORHOOD;
}

const execPromise = promisify(execCb);

async function exec(command: string): Promise<string> {
  const { stdout } = await execPromise(command, {
    encoding: "utf-8",
    maxBuffer: 50 * 1024 * 1024,
  });
  return stdout;
}

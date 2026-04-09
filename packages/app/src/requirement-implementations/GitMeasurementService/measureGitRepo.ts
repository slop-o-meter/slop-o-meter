import { exec as execCb } from "node:child_process";
import { promisify } from "node:util";
import type {
  ExcludedHash,
  GithubEvent,
  MeasurementData,
  MeasurementDiagnostics,
  OutlierClassificationEntry,
  PreAggregatedData,
} from "../../requirements/MeasurementService.js";
import { isBotContributor } from "./aggregation.js";
import fetchGithubEvents from "./githubEvents.js";
import { getCommand, parseCommits, shellEscape } from "./gitLog.js";
import toMeasurement from "./GitMeasurement.js";
import buildIgnore from "./ignorePatterns.js";
import type { ClassifiedCommit } from "./outlierClassifier.js";
import OutlierClassifier from "./outlierClassifier.js";
import { detectOutlierCommits } from "./outlierCommits.js";
import preAggregate from "./preAggregate.js";
import type Commit from "./types.js";

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
  preAggregatedData: PreAggregatedData;
  diagnostics: MeasurementDiagnostics;
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

      // Fetch GitHub events (raw data, no signal computation)
      let githubEvents: GithubEvent[] = [];
      try {
        githubEvents = await fetchGithubEvents({
          owner,
          repo,
          commits: allCommits,
          githubToken: options?.githubToken,
        });
        githubEvents = githubEvents.filter(
          (event) => !isBotContributor(event.author),
        );
      } catch {
        // GitHub events are optional; continue without them
      }

      await onProgress?.("scoring");
      const measurementData = buildMeasurementData(
        allCommits,
        githubEvents,
        excludedHashMap,
        outlierClassifications,
      );

      // Phase 2a: pre-aggregate raw data into compact form
      const { preAggregatedData, sessions } = preAggregate(measurementData);

      // Phase 2b: compute scores from pre-aggregated data
      const measurement = toMeasurement(preAggregatedData);

      return {
        currentScore: measurement.currentScore,
        history: measurement.history,
        measurementData,
        preAggregatedData,
        diagnostics: {
          sessions,
          weeklyDiagnostics: measurement.weeklyDiagnostics,
        },
      };
    },
  };
}

function buildMeasurementData(
  allCommits: Commit[],
  githubEvents: GithubEvent[],
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
    githubEvents,
    excludedHashes,
    outlierClassifications: classifications,
  };
}

const execPromise = promisify(execCb);

async function exec(command: string): Promise<string> {
  const { stdout } = await execPromise(command, {
    encoding: "utf-8",
    maxBuffer: 50 * 1024 * 1024,
  });
  return stdout;
}

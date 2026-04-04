import { exec as execCb } from "node:child_process";
import { promisify } from "node:util";
import type {
  AnalysisData,
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
}

interface GitMeasurementResult {
  currentScore: number;
  history: { week: string; score: number }[];
  analysisData: AnalysisData;
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

      const excludedHashes = new Set([...autoExcludedHashes, ...preAiHashes]);

      if (outlierCandidates.length > 0 && options?.outlierClassifier) {
        await onProgress?.("classifying_outliers", {
          current: 0,
          total: outlierCandidates.length,
        });
        console.log(
          `Classifying ${outlierCandidates.length} outlier commits...`,
        );

        outlierClassifications =
          await options.outlierClassifier.classifyCommits(
            outlierCandidates,
            allCommits,
          );

        for (const result of outlierClassifications) {
          if (!result.classification.isSlop) {
            excludedHashes.add(result.commit.hash);
          }
          const label = result.classification.isSlop
            ? "SLOP"
            : `NOT_SLOP: ${result.classification.reason}`;
          console.log(
            `  ${result.commit.hash.substring(0, 8)} (+${Math.round(result.commit.additions)}): ${label} - ${result.commit.subject.substring(0, 60)}`,
          );
        }

        const slopCount = outlierClassifications.filter(
          (c) => c.classification.isSlop,
        ).length;
        console.log(
          `  ${excludedHashes.size} excluded (${autoExcludedHashes.size} auto + ${excludedHashes.size - autoExcludedHashes.size} classified), ${slopCount} kept as slop`,
        );
      } else if (outlierCandidates.length > 0) {
        console.log(
          `${outlierCandidates.length} outlier commits detected but no classifier configured, keeping all`,
        );
      }

      // Build signals from all commits (excluded commits still generate sessions)
      const commitSignals: Signal[] = allCommits
        .filter((commit) => !isBotContributor(commit.author))
        .map((commit) => ({
          timestamp: commit.timestamp,
          author: commit.author,
          neighborhoodHours: computeCommitNeighborhood(commit.subCommitCount),
        }));

      // Build signals from co-authors (they get a signal at the same timestamp)
      const coAuthorSignals: Signal[] = allCommits.flatMap((commit) =>
        (commit.coAuthors ?? [])
          .filter((coAuthor) => !isBotContributor(coAuthor))
          .map((coAuthor) => ({
            timestamp: commit.timestamp,
            author: coAuthor,
            neighborhoodHours: BASE_NEIGHBORHOOD,
          })),
      );

      // Fetch GitHub event signals
      let githubSignals: Signal[] = [];
      try {
        githubSignals = await fetchGithubEventSignals(
          owner,
          repo,
          BASE_NEIGHBORHOOD,
        );
      } catch {
        // GitHub events are optional; continue without them
      }

      const allSignals = [
        ...commitSignals,
        ...coAuthorSignals,
        ...githubSignals,
      ];
      const sessions = computeSessions(allSignals);

      await onProgress?.("scoring");
      const measurement = toMeasurement(allCommits, sessions, excludedHashes);

      const analysisData = buildAnalysisData(
        allCommits,
        outlierClassifications,
        githubSignals.length,
      );

      return { ...measurement, analysisData };
    },
  };
}

function buildAnalysisData(
  allCommits: Commit[],
  outlierClassifications: ClassifiedCommit[],
  githubEventCount: number,
): AnalysisData {
  const commits = allCommits.map((commit) => ({
    hash: commit.hash,
    timestamp: commit.timestamp,
    author: commit.author,
    subject: commit.subject,
    weightedAdditions: Math.round(commit.additions),
    weightedDeletions: Math.round(commit.deletions),
    fileCount: commit.fileStats.length,
  }));

  const classifications: OutlierClassificationEntry[] =
    outlierClassifications.map((c) => ({
      hash: c.commit.hash,
      isSlop: c.classification.isSlop,
      reason: c.classification.reason,
    }));

  return {
    commits,
    outlierClassifications: classifications,
    githubEventCount,
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

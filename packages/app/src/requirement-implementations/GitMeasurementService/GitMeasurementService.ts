import { lstat, mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type {
  MeasurementResult,
  MeasurementService,
} from "../../requirements/MeasurementService.js";
import createGitMeasurement, { type ProgressPhase } from "./measureGitRepo.js";
import OutlierClassifier from "./outlierClassifier.js";

export type { ProgressPhase };

const SAFE_PATH_SEGMENT = /^[a-zA-Z0-9._-]+$/;

export default class GitMeasurementService implements MeasurementService {
  constructor(
    private options: {
      githubToken: string;
      openrouterApiKey: string;
      openrouterModel: string;
      openrouterBaseUrl: string;
      minimumCommits?: number;
      onProgress?: (
        phase: ProgressPhase,
        progress?: { current: number; total: number },
      ) => void | Promise<void>;
      onRepoMeta?: (meta: { sizeKb: number }) => void | Promise<void>;
    },
  ) {}

  async measure(owner: string, repo: string): Promise<MeasurementResult> {
    for (const segment of [owner, repo]) {
      if (!SAFE_PATH_SEGMENT.test(segment)) {
        throw new Error(`Invalid path segment: ${segment}`);
      }
    }

    try {
      const repoSizeKb = await this.fetchRepoSizeKb(owner, repo);
      await this.options.onRepoMeta?.({ sizeKb: repoSizeKb });
    } catch {
      // Size check is best-effort; continue without it
    }

    const repoPath = join(tmpdir(), owner, repo);
    const cloneUrl = `https://x-access-token:${this.options.githubToken}@github.com/${owner}/${repo}.git`;

    try {
      await rm(repoPath, { recursive: true, force: true });
      await mkdir(dirname(repoPath), { recursive: true });

      const outlierClassifier = new OutlierClassifier({
        apiKey: this.options.openrouterApiKey,
        model: this.options.openrouterModel,
        baseUrl: this.options.openrouterBaseUrl,
        onProgress: async (current, total) => {
          await this.options.onProgress?.("classifying_outliers", {
            current,
            total,
          });
        },
      });

      const gitMeasurement = createGitMeasurement({
        onProgress: this.options.onProgress,
        outlierClassifier,
        minimumCommits: this.options.minimumCommits,
      });
      const result = await gitMeasurement.measure(
        cloneUrl,
        repoPath,
        owner,
        repo,
      );

      let readmeExcerpt = "";
      try {
        const readmePath = `${repoPath}/README.md`;
        const readmeStat = await lstat(readmePath);
        if (readmeStat.isFile()) {
          readmeExcerpt = await readFile(readmePath, "utf-8");
        }
      } catch {
        // No README found
      }

      return { ...result, readmeExcerpt };
    } finally {
      try {
        await rm(repoPath, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  private async fetchRepoSizeKb(owner: string, repo: string): Promise<number> {
    const url = `https://api.github.com/repos/${owner}/${repo}`;
    const baseHeaders = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "slop-o-meter",
    };

    // Try authenticated first (higher rate limit), fall back to
    // unauthenticated for orgs that block the token (e.g. PAT lifetime
    // policies on public repos).
    let response = await fetch(url, {
      headers: {
        ...baseHeaders,
        Authorization: `Bearer ${this.options.githubToken}`,
      },
    });
    if (response.status === 403) {
      response = await fetch(url, { headers: baseHeaders });
    }

    if (!response.ok) {
      throw new Error(
        `GitHub API request failed (${response.status}): ${response.statusText}`,
      );
    }
    const data = (await response.json()) as { size: number };
    return data.size;
  }
}

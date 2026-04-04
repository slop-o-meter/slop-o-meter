import getConfig from "../config.js";
import GitMeasurementService, {
  type ProgressPhase,
} from "../requirement-implementations/GitMeasurementService/GitMeasurementService.js";
import OpenRouterCommentService from "../requirement-implementations/OpenrouterCommentService/OpenrouterCommentService.js";
import type { ProjectRepository } from "../requirements/ProjectRepository.js";
import type { MeasurementPhase } from "../types.js";

const LARGE_REPO_THRESHOLD_KB = 100 * 1024; // 100 MB
const MINIMUM_COMMITS_THRESHOLD = 50;

const PHASE_MAP: Record<ProgressPhase, MeasurementPhase> = {
  cloning: "CloningRepo",
  parsing: "MeasuringSlopScore",
  classifying_outliers: "InspectingSuspiciousCommits",
  scoring: "MeasuringSlopScore",
};

export default async function runMeasurement(
  projectRepository: ProjectRepository,
  owner: string,
  repo: string,
): Promise<void> {
  try {
    const config = await getConfig();

    const gitMeasurement = new GitMeasurementService({
      githubToken: config.githubToken,
      openrouterApiKey: config.openrouterApiKey,
      openrouterModel: config.openrouterModel,
      openrouterBaseUrl: config.openrouterBaseUrl,
      minimumCommits: MINIMUM_COMMITS_THRESHOLD,
      onProgress: async (phase, progress) => {
        await projectRepository.setPhase(
          owner,
          repo,
          PHASE_MAP[phase]!,
          progress ?? null,
        );
      },
      onRepoMeta: async (meta) => {
        await projectRepository.setRepoMeta(owner, repo, {
          isLargeRepo: meta.sizeKb > LARGE_REPO_THRESHOLD_KB,
        });
      },
    });

    const measurement = await gitMeasurement.measure(owner, repo);

    await projectRepository.setPhase(owner, repo, "InterpretingResults");
    const commentService = new OpenRouterCommentService({
      apiKey: config.openrouterApiKey,
      model: config.openrouterModel,
      baseUrl: config.openrouterBaseUrl,
    });
    const comment = await commentService.generateComment({
      repoOwner: owner,
      repoName: repo,
      readmeExcerpt: measurement.readmeExcerpt,
      currentScore: measurement.currentScore,
    });

    const { analysisData, ...measurementWithoutAnalysis } = measurement;
    const measurementJson = JSON.stringify({
      ...measurementWithoutAnalysis,
      comment,
    });
    const analysisJson = JSON.stringify(analysisData);
    await projectRepository.setComplete(
      owner,
      repo,
      measurementJson,
      new Date().toISOString(),
      analysisJson,
    );
  } catch (error) {
    console.error("Measurement failed", { owner, repo, error });
    await projectRepository.setError(owner, repo, classifyError(error));
  }
}

function classifyError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (lower.includes("not enough commits")) {
    return "The repo has too few commits";
  }
  if (lower.includes("repository not found") || lower.includes("not found")) {
    return "Repository not found";
  }
  if (
    lower.includes("authentication failed") ||
    lower.includes("403") ||
    lower.includes("could not read from remote")
  ) {
    return "Private or inaccessible repository";
  }
  if (lower.includes("fatal:") && lower.includes("clone")) {
    return "Clone failed";
  }
  if (lower.includes("openrouter")) {
    return "Inspection failed";
  }
  if (
    lower.includes("enotfound") ||
    lower.includes("etimedout") ||
    lower.includes("fetch failed")
  ) {
    return "Network error";
  }

  return "Measurement failed";
}

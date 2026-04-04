import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { ProjectRepository } from "../../requirements/ProjectRepository.js";
import type { Measurement, Project } from "../../types.js";

export default class FilesystemProjectRepository implements ProjectRepository {
  constructor(private dataDirectory: string) {}

  async getProject(owner: string, repo: string): Promise<Project | null> {
    return this.readProject(owner, repo);
  }

  async getProjects(
    keys: { owner: string; repo: string }[],
  ): Promise<Project[]> {
    const results: Project[] = [];
    for (const key of keys) {
      const project = this.readProject(key.owner, key.repo);
      if (project) {
        results.push(project);
      }
    }
    return results;
  }

  async setRunning(owner: string, repo: string, phase: string): Promise<void> {
    const project =
      this.readProject(owner, repo) ?? this.defaultProject(owner, repo);
    project.measurementStatus = "Running";
    project.measurementPhase = phase as Project["measurementPhase"];
    project.measurementPhaseProgress = null;
    project.isLargeRepo = null;
    project.errorReason = null;
    this.writeProject(project);
  }

  async setPhase(
    owner: string,
    repo: string,
    phase: string,
    progress?: { current: number; total: number } | null,
  ): Promise<void> {
    const project =
      this.readProject(owner, repo) ?? this.defaultProject(owner, repo);
    project.measurementPhase = phase as Project["measurementPhase"];
    project.measurementPhaseProgress = progress ?? null;
    this.writeProject(project);
  }

  async setRepoMeta(
    owner: string,
    repo: string,
    meta: { isLargeRepo: boolean },
  ): Promise<void> {
    const project =
      this.readProject(owner, repo) ?? this.defaultProject(owner, repo);
    project.isLargeRepo = meta.isLargeRepo;
    this.writeProject(project);
  }

  async setComplete(
    owner: string,
    repo: string,
    measurementJson: string,
    lastMeasuredAt: string,
    analysisJson?: string,
  ): Promise<void> {
    const project =
      this.readProject(owner, repo) ?? this.defaultProject(owner, repo);
    project.measurementStatus = "Idle";
    project.measurementPhase = null;
    project.measurementPhaseProgress = null;
    project.isLargeRepo = null;
    project.errorReason = null;
    project.measurement = JSON.parse(measurementJson) as Measurement;
    project.lastMeasuredAt = lastMeasuredAt;
    this.writeProject(project);

    if (analysisJson) {
      this.writeAnalysis(owner, repo, analysisJson);
    }
  }

  async setError(owner: string, repo: string, reason?: string): Promise<void> {
    const project =
      this.readProject(owner, repo) ?? this.defaultProject(owner, repo);
    project.measurementStatus = "Error";
    project.measurementPhase = null;
    project.measurementPhaseProgress = null;
    project.errorReason = reason ?? null;
    this.writeProject(project);
  }

  private storageKey(owner: string, repo: string): string {
    return `projects/${owner}/${repo}.json`;
  }

  private defaultProject(owner: string, repo: string): Project {
    return {
      owner,
      repo,
      measurementStatus: "Idle",
      measurementPhase: null,
      measurementPhaseProgress: null,
      isLargeRepo: null,
      errorReason: null,
      measurement: null,
      lastMeasuredAt: null,
    };
  }

  private readProject(owner: string, repo: string): Project | null {
    const filePath = join(this.dataDirectory, this.storageKey(owner, repo));
    if (!existsSync(filePath)) {
      return null;
    }
    return JSON.parse(readFileSync(filePath, "utf-8")) as Project;
  }

  private writeProject(project: Project): void {
    const filePath = join(
      this.dataDirectory,
      this.storageKey(project.owner, project.repo),
    );
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, JSON.stringify(project), "utf-8");
  }

  private writeAnalysis(
    owner: string,
    repo: string,
    analysisJson: string,
  ): void {
    const filePath = join(
      this.dataDirectory,
      `projects/${owner}/${repo}.analysis.json`,
    );
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, analysisJson, "utf-8");
  }
}

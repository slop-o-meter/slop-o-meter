import type { MeasurementPhase, Project } from "../types.js";

interface ProjectKey {
  owner: string;
  repo: string;
}

export interface ProjectRepository {
  getProject(owner: string, repo: string): Promise<Project | null>;
  getProjects(keys: ProjectKey[]): Promise<Project[]>;
  setRunning(
    owner: string,
    repo: string,
    phase: MeasurementPhase,
  ): Promise<void>;
  setPhase(
    owner: string,
    repo: string,
    phase: MeasurementPhase,
    progress?: { current: number; total: number } | null,
  ): Promise<void>;
  setRepoMeta(
    owner: string,
    repo: string,
    meta: { isLargeRepo: boolean },
  ): Promise<void>;
  setComplete(
    owner: string,
    repo: string,
    measurementJson: string,
    lastMeasuredAt: string,
    analysisJson?: string,
  ): Promise<void>;
  setError(owner: string, repo: string, reason?: string): Promise<void>;
}

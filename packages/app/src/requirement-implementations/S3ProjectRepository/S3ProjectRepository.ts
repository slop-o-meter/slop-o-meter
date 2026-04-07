import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { ProjectRepository } from "../../requirements/ProjectRepository.js";
import type { Measurement, Project } from "../../types.js";

export default class S3ProjectRepository implements ProjectRepository {
  private s3Client = new S3Client({});

  constructor(private bucketName: string) {}

  async getProject(owner: string, repo: string): Promise<Project | null> {
    return this.readProject(owner, repo);
  }

  async getProjects(
    keys: { owner: string; repo: string }[],
  ): Promise<Project[]> {
    const results: Project[] = [];
    for (const key of keys) {
      const project = await this.readProject(key.owner, key.repo);
      if (project) {
        results.push(project);
      }
    }
    return results;
  }

  async setRunning(owner: string, repo: string, phase: string): Promise<void> {
    const project =
      (await this.readProject(owner, repo)) ?? this.defaultProject(owner, repo);
    project.measurementStatus = "Running";
    project.measurementPhase = phase as Project["measurementPhase"];
    project.measurementPhaseProgress = null;
    project.isLargeRepo = null;
    project.errorReason = null;
    await this.writeProject(project);
  }

  async setPhase(
    owner: string,
    repo: string,
    phase: string,
    progress?: { current: number; total: number } | null,
  ): Promise<void> {
    const project =
      (await this.readProject(owner, repo)) ?? this.defaultProject(owner, repo);
    project.measurementPhase = phase as Project["measurementPhase"];
    project.measurementPhaseProgress = progress ?? null;
    await this.writeProject(project);
  }

  async setRepoMeta(
    owner: string,
    repo: string,
    meta: { isLargeRepo: boolean },
  ): Promise<void> {
    const project =
      (await this.readProject(owner, repo)) ?? this.defaultProject(owner, repo);
    project.isLargeRepo = meta.isLargeRepo;
    await this.writeProject(project);
  }

  async setComplete(
    owner: string,
    repo: string,
    measurementJson: string,
    lastMeasuredAt: string,
    measurementDataJson?: string,
    measurementDiagnosticsJson?: string,
  ): Promise<void> {
    const project =
      (await this.readProject(owner, repo)) ?? this.defaultProject(owner, repo);
    project.measurementStatus = "Idle";
    project.measurementPhase = null;
    project.measurementPhaseProgress = null;
    project.isLargeRepo = null;
    project.errorReason = null;
    project.measurement = JSON.parse(measurementJson) as Measurement;
    project.lastMeasuredAt = lastMeasuredAt;
    await this.writeProject(project);

    if (measurementDataJson) {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: `projects/${owner}/${repo}.measurement-data.json`,
          Body: measurementDataJson,
          ContentType: "application/json",
        }),
      );
    }
    if (measurementDiagnosticsJson) {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: `projects/${owner}/${repo}.measurement-diagnostics.json`,
          Body: measurementDiagnosticsJson,
          ContentType: "application/json",
        }),
      );
    }
  }

  async setError(owner: string, repo: string, reason?: string): Promise<void> {
    const project =
      (await this.readProject(owner, repo)) ?? this.defaultProject(owner, repo);
    project.measurementStatus = "Error";
    project.measurementPhase = null;
    project.measurementPhaseProgress = null;
    project.errorReason = reason ?? null;
    await this.writeProject(project);
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

  private async readProject(
    owner: string,
    repo: string,
  ): Promise<Project | null> {
    try {
      const result = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: this.storageKey(owner, repo),
        }),
      );
      const text = await result.Body!.transformToString();
      return JSON.parse(text) as Project;
    } catch (error: any) {
      if (error.name === "NoSuchKey") {
        return null;
      }
      throw error;
    }
  }

  private async writeProject(project: Project): Promise<void> {
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: this.storageKey(project.owner, project.repo),
        Body: JSON.stringify(project),
        ContentType: "application/json",
      }),
    );
  }
}

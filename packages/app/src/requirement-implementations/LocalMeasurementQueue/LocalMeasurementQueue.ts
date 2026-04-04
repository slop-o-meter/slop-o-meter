import type {
  MeasurementMessage,
  MeasurementQueue,
} from "../../requirements/MeasurementQueue.js";
import type { ProjectRepository } from "../../requirements/ProjectRepository.js";

export default class LocalMeasurementQueue implements MeasurementQueue {
  constructor(private projectRepository: ProjectRepository) {}

  async send(message: MeasurementMessage): Promise<void> {
    const { owner, repo } = message;
    console.log(`[local] Running measurement for ${owner}/${repo}`);

    const { default: runMeasurement } =
      await import("../../worker/runMeasurement.js");
    runMeasurement(this.projectRepository, owner, repo).then(
      () => console.log(`[local] Measurement complete for ${owner}/${repo}`),
      (error: unknown) =>
        console.error(`[local] Measurement failed for ${owner}/${repo}`, error),
    );
  }
}

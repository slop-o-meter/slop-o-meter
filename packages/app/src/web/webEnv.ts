import type { MeasurementQueue } from "../requirements/MeasurementQueue.js";
import type { ProjectRepository } from "../requirements/ProjectRepository.js";

export default interface WebEnv {
  Variables: {
    projectRepository: ProjectRepository;
    measurementQueue: MeasurementQueue;
  };
}

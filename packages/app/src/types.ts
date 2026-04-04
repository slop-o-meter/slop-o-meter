export type { MeasurementResult } from "./requirements/MeasurementService.js";
import type { MeasurementResult } from "./requirements/MeasurementService.js";

type MeasurementStatus = "Idle" | "Running" | "Error";

export type MeasurementPhase =
  | "CloningRepo"
  | "InspectingSuspiciousCommits"
  | "MeasuringSlopScore"
  | "InterpretingResults";

export interface Measurement extends MeasurementResult {
  comment: string;
}

export interface Project {
  owner: string;
  repo: string;
  measurementStatus: MeasurementStatus;
  measurementPhase: MeasurementPhase | null;
  measurementPhaseProgress: { current: number; total: number } | null;
  isLargeRepo: boolean | null;
  errorReason: string | null;
  measurement: Measurement | null;
  lastMeasuredAt: string | null;
}

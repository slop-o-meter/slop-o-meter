export interface MeasurementResult {
  currentScore: number;
  history: { week: string; score: number }[];
  readmeExcerpt: string;
  analysisData: AnalysisData;
}

export interface AnalysisData {
  commits: AnalysisCommit[];
  outlierClassifications: OutlierClassificationEntry[];
  githubEventCount: number;
}

export interface AnalysisCommit {
  hash: string;
  timestamp: string;
  author: string;
  subject: string;
  weightedAdditions: number;
  weightedDeletions: number;
  fileCount: number;
}

export interface OutlierClassificationEntry {
  hash: string;
  isSlop: boolean;
  reason: string;
}

export interface MeasurementService {
  measure(owner: string, repo: string): Promise<MeasurementResult>;
}

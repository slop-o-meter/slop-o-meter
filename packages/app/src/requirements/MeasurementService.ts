export interface MeasurementResult {
  currentScore: number;
  history: { week: string; score: number }[];
  readmeExcerpt: string;
  measurementData: MeasurementData;
  diagnostics: MeasurementDiagnostics;
}

// --- MeasurementData: raw inputs captured during measurement ---

export interface MeasurementData {
  commits: MeasurementCommit[];
  signals: MeasurementSignal[];
  excludedHashes: ExcludedHash[];
  outlierClassifications: OutlierClassificationEntry[];
}

// --- MeasurementDiagnostics: derived output for inspection ---

export interface MeasurementDiagnostics {
  sessions: MeasurementSession[];
  weeklyDiagnostics: WeeklyDiagnostics[];
}

export interface MeasurementCommit {
  hash: string;
  week: string;
  timestamp: string;
  author: string;
  subject: string;
  weightedAdditions: number;
  weightedDeletions: number;
  fileCount: number;
  coAuthors: string[];
  subCommitCount: number;
}

export interface MeasurementSignal {
  timestamp: string;
  author: string;
  neighborhoodHours: number;
}

export interface MeasurementSession {
  author: string;
  startTime: string;
  endTime: string;
  durationHours: number;
}

export interface ExcludedHash {
  hash: string;
  reason: "auto" | "pre-ai" | "classified";
}

export interface OutlierClassificationEntry {
  hash: string;
  isSlop: boolean;
  reason: string;
}

// --- Per-week diagnostics ---

export interface WeeklyDiagnostics {
  week: string;
  score: number;

  weightedAdditions: number;
  weightedDeletions: number;
  excludedAdditions: number;
  excludedDeletions: number;

  cumulativeRawLines: number;
  sizeDampening: number;
  netAdditions: number;
  attentionCost: number;

  contributors: ContributorWeekDiagnostics[];
  totalEffectiveHours: number;
  attentionSpent: number;

  weeklyExcess: number;
  cumulativeSlop: number;
  cumulativeDampenedLines: number;
}

export interface ContributorWeekDiagnostics {
  author: string;
  rawSessionHours: number;
  coreFactor: number;
  effectiveHours: number;
  cappedHours: number;
}

export interface MeasurementService {
  measure(owner: string, repo: string): Promise<MeasurementResult>;
}

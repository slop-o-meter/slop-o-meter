/**
 * A Signal represents a timestamped event that indicates human activity on a
 * project. Signals are used to estimate attention spent by computing work
 * sessions from overlapping neighborhoods.
 */
export interface Signal {
  timestamp: string;
  author: string;
  neighborhoodHours: number;
}

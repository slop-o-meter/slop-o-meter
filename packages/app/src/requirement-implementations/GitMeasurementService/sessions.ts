import { DateTime } from "luxon";
import type { Signal } from "./signals.js";

export interface Session {
  author: string;
  startTime: DateTime;
  endTime: DateTime;
  durationHours: number;
}

/**
 * Computes work sessions from a list of signals. Each signal defines a
 * neighborhood (window of active work before the signal timestamp).
 * Overlapping neighborhoods from the same author are merged into sessions.
 */
export function computeSessions(signals: Signal[]): Session[] {
  if (signals.length === 0) {
    return [];
  }

  const signalsByAuthor = new Map<string, Signal[]>();
  for (const signal of signals) {
    const authorSignals = signalsByAuthor.get(signal.author);
    if (authorSignals) {
      authorSignals.push(signal);
    } else {
      signalsByAuthor.set(signal.author, [signal]);
    }
  }

  const sessions: Session[] = [];

  for (const [author, authorSignals] of signalsByAuthor) {
    const neighborhoods = authorSignals
      .map((signal) => {
        const endTime = DateTime.fromISO(signal.timestamp);
        const startTime = endTime.minus({ hours: signal.neighborhoodHours });
        return { startTime, endTime };
      })
      .sort((a, b) => a.startTime.toMillis() - b.startTime.toMillis());

    let currentStart = neighborhoods[0]!.startTime;
    let currentEnd = neighborhoods[0]!.endTime;

    for (let i = 1; i < neighborhoods.length; i++) {
      const neighborhood = neighborhoods[i]!;
      if (neighborhood.startTime <= currentEnd) {
        if (neighborhood.endTime > currentEnd) {
          currentEnd = neighborhood.endTime;
        }
      } else {
        sessions.push(makeSession(author, currentStart, currentEnd));
        currentStart = neighborhood.startTime;
        currentEnd = neighborhood.endTime;
      }
    }

    sessions.push(makeSession(author, currentStart, currentEnd));
  }

  return sessions;
}

function makeSession(
  author: string,
  startTime: DateTime,
  endTime: DateTime,
): Session {
  const durationHours = endTime.diff(startTime, "hours").hours;
  return { author, startTime, endTime, durationHours };
}

/**
 * Groups sessions by ISO week and sums the total duration per week.
 * Returns a map from week string (e.g. "2025-W01") to total hours.
 */
export function sessionHoursByWeek(sessions: Session[]): Map<string, number> {
  const weekHours = new Map<string, number>();

  for (const session of sessions) {
    const week = `${String(session.startTime.weekYear)}-W${String(session.startTime.weekNumber).padStart(2, "0")}`;
    weekHours.set(week, (weekHours.get(week) ?? 0) + session.durationHours);
  }

  return weekHours;
}

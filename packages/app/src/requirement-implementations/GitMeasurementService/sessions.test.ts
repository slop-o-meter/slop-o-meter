import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { computeSessions, sessionHoursByWeek } from "./sessions.js";
import type { Signal } from "./signals.js";

describe("computeSessions", () => {
  it("returns empty array for empty input", () => {
    // Exercise
    const sessions = computeSessions([]);

    // Verify
    expect(sessions).toEqual([]);
  });

  it("creates a single session from one signal", () => {
    // Setup SUT
    const signals: Signal[] = [
      {
        timestamp: "2025-01-06T10:00:00Z",
        author: "alice",
        neighborhoodHours: 1,
      },
    ];

    // Exercise
    const sessions = computeSessions(signals);

    // Verify
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.author).toBe("alice");
    expect(sessions[0]!.durationHours).toBe(1);
  });

  it("merges overlapping neighborhoods from the same author", () => {
    // Setup SUT — two signals 30 min apart, each with 1h neighborhood
    const signals: Signal[] = [
      {
        timestamp: "2025-01-06T10:00:00Z",
        author: "alice",
        neighborhoodHours: 1,
      },
      {
        timestamp: "2025-01-06T10:30:00Z",
        author: "alice",
        neighborhoodHours: 1,
      },
    ];

    // Exercise
    const sessions = computeSessions(signals);

    // Verify — merged into one session from 09:00 to 10:30 = 1.5h
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.durationHours).toBeCloseTo(1.5);
  });

  it("keeps separate sessions for non-overlapping neighborhoods", () => {
    // Setup SUT — two signals 3 hours apart, each with 1h neighborhood
    const signals: Signal[] = [
      {
        timestamp: "2025-01-06T10:00:00Z",
        author: "alice",
        neighborhoodHours: 1,
      },
      {
        timestamp: "2025-01-06T14:00:00Z",
        author: "alice",
        neighborhoodHours: 1,
      },
    ];

    // Exercise
    const sessions = computeSessions(signals);

    // Verify
    expect(sessions).toHaveLength(2);
    expect(sessions[0]!.durationHours).toBe(1);
    expect(sessions[1]!.durationHours).toBe(1);
  });

  it("keeps separate sessions for different authors", () => {
    // Setup SUT — same timestamp, different authors
    const signals: Signal[] = [
      {
        timestamp: "2025-01-06T10:00:00Z",
        author: "alice",
        neighborhoodHours: 1,
      },
      {
        timestamp: "2025-01-06T10:00:00Z",
        author: "bob",
        neighborhoodHours: 1,
      },
    ];

    // Exercise
    const sessions = computeSessions(signals);

    // Verify
    expect(sessions).toHaveLength(2);
  });

  it("handles squash commits with larger neighborhoods", () => {
    // Setup SUT — squash commit with 10 sub-commits: 1 + 10*0.5 = 6h neighborhood
    const signals: Signal[] = [
      {
        timestamp: "2025-01-06T10:00:00Z",
        author: "alice",
        neighborhoodHours: 6,
      },
    ];

    // Exercise
    const sessions = computeSessions(signals);

    // Verify
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.durationHours).toBe(6);
  });
});

describe("sessionHoursByWeek", () => {
  it("groups session hours by ISO week", () => {
    // Setup SUT
    const sessions = [
      {
        author: "alice",
        startTime: DateTime.fromISO("2025-01-06T09:00:00Z"),
        endTime: DateTime.fromISO("2025-01-06T11:00:00Z"),
        durationHours: 2,
      },
      {
        author: "alice",
        startTime: DateTime.fromISO("2025-01-06T14:00:00Z"),
        endTime: DateTime.fromISO("2025-01-06T16:00:00Z"),
        durationHours: 2,
      },
    ];

    // Exercise
    const result = sessionHoursByWeek(sessions);

    // Verify
    expect(result.get("2025-W02")).toBe(4);
  });
});

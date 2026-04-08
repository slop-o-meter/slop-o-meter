/**
 * Replays stored measurement data with different algorithm options.
 *
 * Usage: yarn tsx src/scripts/replayWithLinesPerHour.ts <linesPerHour> [capMode]
 *   capMode: linear-ramp (default), cosine, concave
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import toMeasurement, {
  type WeeklyCapMode,
} from "../requirement-implementations/GitMeasurementService/GitMeasurement.js";
import type { MeasurementData } from "../requirements/MeasurementService.js";

const linesPerHour = Number(process.argv[2]);
if (!linesPerHour || Number.isNaN(linesPerHour)) {
  console.error(
    "Usage: yarn tsx src/scripts/replayWithLinesPerHour.ts <linesPerHour> [capMode]",
  );
  process.exit(1);
}

const weeklyCapMode = (process.argv[3] as WeeklyCapMode) ?? "linear-ramp";

const dataDir = join(import.meta.dirname, "../../.data/projects");

const results: { project: string; score: number }[] = [];

for (const owner of readdirSync(dataDir)) {
  const ownerDir = join(dataDir, owner);
  if (!statSync(ownerDir).isDirectory()) {
    continue;
  }
  for (const file of readdirSync(ownerDir)) {
    if (!file.endsWith(".measurement-data.json")) {
      continue;
    }
    const repo = file.replace(".measurement-data.json", "");
    const data = JSON.parse(
      readFileSync(join(ownerDir, file), "utf-8"),
    ) as MeasurementData;

    const result = toMeasurement(data, {
      humanLinesPerHour: linesPerHour,
      overtimeCurve: weeklyCapMode,
    });
    results.push({
      project: `${owner}/${repo}`,
      score: result.currentScore,
    });
  }
}

results.sort((a, b) => b.score - a.score);

console.log(`LINES_PER_HOUR=${String(linesPerHour)}  cap=${weeklyCapMode}\n`);
for (const { project, score } of results) {
  console.log(`  ${project.padEnd(30)} ${(score * 100).toFixed(1)}%`);
}

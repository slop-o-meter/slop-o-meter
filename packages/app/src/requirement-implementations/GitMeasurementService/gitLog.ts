import { type Ignore } from "ignore";
import { DateTime } from "luxon";
import type Commit from "./types.js";

export function shellEscape(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

export function getCommand(repoPath: string): string {
  return [
    "git",
    `-C ${shellEscape(repoPath)}`,
    "log",
    "--numstat",
    "--no-renames",
    "--format='COMMIT %H %aI %ae%nSUBJECT %s%nBODY_START%n%b%nBODY_END'",
    "--no-merges",
    "--",
    ".",
    "':!*.lock'",
    "':!*-lock.json'",
    "':!*-lock.yaml'",
    "':!go.sum'",
  ].join(" ");
}

export function parseCommits(output: string, toolIgnore?: Ignore): Commit[] {
  const commits: Commit[] = [];
  let current: Commit | null = null;
  let inBody = false;
  let bodyLines: string[] = [];

  for (const line of output.split("\n")) {
    const commitMatch = line.match(/^COMMIT (\S+) (\S+) (.+)$/);
    if (commitMatch) {
      if (current) {
        applyBodyData(current, bodyLines);
        commits.push(current);
      }
      const hash = commitMatch[1]!;
      const timestamp = commitMatch[2]!;
      current = {
        hash,
        week: isoTimestampToWeek(timestamp),
        timestamp,
        author: commitMatch[3]!,
        subject: "",
        additions: 0,
        deletions: 0,
        fileStats: [],
        coAuthors: [],
        subCommitCount: 0,
      };
      inBody = false;
      bodyLines = [];
      continue;
    }

    if (current !== null) {
      const subjectMatch = line.match(/^SUBJECT (.*)$/);
      if (subjectMatch) {
        current.subject = subjectMatch[1]!;
        continue;
      }
    }

    if (line === "BODY_START") {
      inBody = true;
      continue;
    }

    if (line === "BODY_END") {
      inBody = false;
      continue;
    }

    if (inBody) {
      bodyLines.push(line);
      continue;
    }

    if (current !== null) {
      const statsMatch = line.match(/^(\d+)\t(\d+)\t(.+)$/);
      if (statsMatch) {
        const fileAdditions = Number.parseInt(statsMatch[1]!, 10);
        const fileDeletions = Number.parseInt(statsMatch[2]!, 10);
        const filePath = statsMatch[3]!;

        current.fileStats.push({
          filePath,
          additions: fileAdditions,
          deletions: fileDeletions,
        });

        const weight = getFileWeight(filePath, toolIgnore);
        current.additions += fileAdditions * weight;
        current.deletions += fileDeletions * weight;
      }
    }
  }
  if (current) {
    applyBodyData(current, bodyLines);
    commits.push(current);
  }

  return commits;
}

function isoTimestampToWeek(timestamp: string): string {
  const dt = DateTime.fromISO(timestamp);
  return `${String(dt.weekYear)}-W${String(dt.weekNumber).padStart(2, "0")}`;
}

function applyBodyData(commit: Commit, bodyLines: string[]): void {
  commit.coAuthors = extractCoAuthors(bodyLines);
  commit.subCommitCount = countSubCommits(bodyLines);
}

function extractCoAuthors(bodyLines: string[]): string[] {
  const coAuthors: string[] = [];
  for (const line of bodyLines) {
    const match = line.match(/^Co-authored-by:\s*.+<([^>]+)>/i);
    if (match) {
      coAuthors.push(match[1]!);
    }
  }
  return coAuthors;
}

function countSubCommits(bodyLines: string[]): number {
  let count = 0;
  for (const line of bodyLines) {
    if (/^\* .+/.test(line)) {
      count++;
    }
  }
  return count >= 2 ? count : 0;
}

// --- File Weighting ---

const FILE_WEIGHTS: Record<string, number> = {
  ts: 1.0,
  js: 1.0,
  mjs: 1.0,
  cjs: 1.0,
  py: 1.0,
  go: 1.0,
  rs: 1.0,
  java: 1.0,
  kt: 1.0,
  kts: 1.0,
  swift: 1.0,
  c: 1.0,
  cpp: 1.0,
  cc: 1.0,
  cxx: 1.0,
  h: 1.0,
  hpp: 1.0,
  cs: 1.0,
  rb: 1.0,
  php: 1.0,
  ex: 1.0,
  exs: 1.0,
  erl: 1.0,
  hrl: 1.0,
  hs: 1.0,
  ml: 1.0,
  mli: 1.0,
  scala: 1.0,
  clj: 1.0,
  cljs: 1.0,
  cljc: 1.0,
  dart: 1.0,
  lua: 1.0,
  r: 1.0,
  jl: 1.0,
  nim: 1.0,
  zig: 1.0,
  sh: 1.0,
  bash: 1.0,
  sql: 0.8,
  tsx: 0.5,
  jsx: 0.5,
  vue: 0.5,
  svelte: 0.5,
  html: 0.5,
  htm: 0.5,
  css: 0.3,
  scss: 0.3,
  sass: 0.3,
  less: 0.3,
};

function getFileWeight(filePath: string, toolIgnore?: Ignore): number {
  const extension = getExtension(filePath);
  const baseWeight = FILE_WEIGHTS[extension] ?? 0;
  if (baseWeight === 0) {
    return 0;
  }
  if (isNonProductionFile(filePath)) {
    return 0;
  }
  if (isVendoredFile(filePath)) {
    return 0;
  }
  if (toolIgnore && toolIgnore.ignores(filePath)) {
    return 0;
  }
  return baseWeight;
}

function getExtension(filePath: string): string {
  const fileName = filePath.split("/").pop() ?? "";
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex <= 0) {
    return "";
  }
  return fileName.substring(dotIndex + 1).toLowerCase();
}

export function parseBaselineDiffOutput(
  output: string,
  toolIgnore?: Ignore,
): number {
  let totalWeightedLines = 0;

  for (const line of output.split("\n")) {
    const match = line.match(/^(\d+)\t(\d+)\t(.+)$/);
    if (!match) {
      continue;
    }

    const additions = Number.parseInt(match[1]!, 10);
    const filePath = match[3]!;

    const weight = getFileWeight(filePath, toolIgnore);
    totalWeightedLines += additions * weight;
  }

  return totalWeightedLines;
}

// --- File Classification ---

function isNonProductionFile(filePath: string): boolean {
  const lowerPath = filePath.toLowerCase();

  // Test files by name pattern
  if (/\.(test|spec|stories)\.[^.]+$/.test(lowerPath)) {
    return true;
  }
  if (/_test\.[^.]+$/.test(lowerPath)) {
    return true;
  }
  const fileName = lowerPath.split("/").pop() ?? "";
  if (fileName.startsWith("test_")) {
    return true;
  }

  // Test and example directories
  if (
    /(^|\/)(__tests__|tests?|specs?|__mocks__|__fixtures__|fixtures|examples?|demos?|samples?)\//.test(
      lowerPath,
    )
  ) {
    return true;
  }

  return false;
}

function isVendoredFile(filePath: string): boolean {
  const lowerPath = filePath.toLowerCase();

  // Vendored/third-party directories
  if (
    /(^|\/)(_?vendor|node_modules|third[_-]?party|external|deps)\//.test(
      lowerPath,
    )
  ) {
    return true;
  }

  // Minified, bundled, or generated files
  const fileName = lowerPath.split("/").pop() ?? "";
  if (/\.(min|bundle)\.[^.]+$/.test(fileName)) {
    return true;
  }

  // Source maps and declaration files
  if (/\.(map|d\.ts)$/.test(fileName)) {
    return true;
  }

  return false;
}

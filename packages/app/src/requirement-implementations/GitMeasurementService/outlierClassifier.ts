import type {
  InputMessageItem,
  OpenRouterRequest,
  OpenRouterResponse,
} from "../OpenrouterCommentService/types.js";
import type Commit from "./types.js";

const BATCH_SIZE = 4;

export interface OutlierClassification {
  isSlop: boolean;
  reason: string;
}

export interface ClassifiedCommit {
  commit: Commit;
  classification: OutlierClassification;
}

interface OutlierClassifierOptions {
  apiKey: string;
  model: string;
  baseUrl: string;
  onProgress?: (current: number, total: number) => void | Promise<void>;
}

export default class OutlierClassifier {
  constructor(private options: OutlierClassifierOptions) {}

  async classifyCommits(
    outlierCommits: Commit[],
    allCommits: Commit[],
  ): Promise<ClassifiedCommit[]> {
    const results: ClassifiedCommit[] = [];

    for (let i = 0; i < outlierCommits.length; i += BATCH_SIZE) {
      const batch = outlierCommits.slice(i, i + BATCH_SIZE);
      const batchResults = await this.classifyBatchWithRetry(batch, allCommits);
      results.push(...batchResults);
      await this.options.onProgress?.(
        Math.min(i + BATCH_SIZE, outlierCommits.length),
        outlierCommits.length,
      );
    }

    return results;
  }

  private async classifyBatchWithRetry(
    batch: Commit[],
    allCommits: Commit[],
  ): Promise<ClassifiedCommit[]> {
    try {
      return await this.classifyBatch(batch, allCommits);
    } catch (firstError) {
      console.warn("Outlier classification batch failed, retrying once", {
        hashes: batch.map((c) => c.hash.substring(0, 8)),
        error: firstError,
      });
      return await this.classifyBatch(batch, allCommits);
    }
  }

  private async classifyBatch(
    batch: Commit[],
    allCommits: Commit[],
  ): Promise<ClassifiedCommit[]> {
    const messages: InputMessageItem[] = [
      { type: "message", role: "system", content: buildSystemPrompt() },
      {
        type: "message",
        role: "user",
        content: buildBatchUserPrompt(batch, allCommits),
      },
    ];

    const response = await this.generateCompletion(messages);
    const classifications = parseBatchClassification(response, batch.length);

    return batch.map((commit, index) => ({
      commit,
      classification: classifications[index]!,
    }));
  }

  private async generateCompletion(
    messages: InputMessageItem[],
  ): Promise<string> {
    const requestBody: OpenRouterRequest = {
      model: this.options.model,
      input: messages,
      stream: false,
    };

    const response = await fetch(this.options.baseUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.options.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `OpenRouter request failed (${response.status}): ${body}`,
      );
    }

    const json = (await response.json()) as OpenRouterResponse;
    return json.output_text ?? extractTextFromOutput(json) ?? "";
  }
}

function extractTextFromOutput(response: OpenRouterResponse): string | null {
  if (!response.output) {
    return null;
  }
  for (const item of response.output) {
    if (item.type === "message" && item.content) {
      for (const content of item.content) {
        if (content.type === "output_text" && content.text) {
          return content.text;
        }
      }
    }
  }
  return null;
}

function buildSystemPrompt(): string {
  return `You analyze large commits in a git repository to determine if they are AI-generated slop.

A commit is **slop** if it looks like bulk AI-generated code that was not meaningfully produced or reviewed by a human. Examples: an AI coding agent generating thousands of lines in one shot, bulk-generated boilerplate, auto-scaffolded projects with no human editing.

A commit is **not slop** if the large diff is explained by a structural change that naturally produces many additions without requiring proportional human effort. Examples:
- Code drop: importing code from another repo, vendoring a dependency
- Migration: monorepo restructuring, moving code between packages
- Restructuring: renaming/moving files, reorganizing directories
- Verbose file types: changes to naturally verbose files (configs, schemas, test fixtures)

A large feature implementation is NOT a valid reason to classify as not slop. If someone added thousands of lines of feature code, that is exactly what we want to measure.

You will receive one or more commits to classify. For each commit, reply on a separate line in exactly this format:

<hash>: SLOP
or
<hash>: NOT_SLOP: <short reason>

Use the short commit hash (first 8 characters) provided in each commit block. One line per commit, in the same order as presented.`;
}

function buildBatchUserPrompt(batch: Commit[], allCommits: Commit[]): string {
  return batch
    .map((commit) => buildCommitBlock(commit, allCommits))
    .join("\n\n---\n\n");
}

function buildCommitBlock(commit: Commit, allCommits: Commit[]): string {
  const codebaseSizeAtCommit = computeCodebaseSizeAtCommit(commit, allCommits);
  const projectAgeAtCommit = computeProjectAgeAtCommit(commit, allCommits);
  const surroundingCommits = getSurroundingCommits(commit, allCommits, 3);
  const topFiles = getTopFiles(commit, 20);

  const parts: string[] = [];

  parts.push(`<commit>`);
  parts.push(`Hash: ${commit.hash.substring(0, 8)}`);
  parts.push(`Date: ${commit.timestamp}`);
  parts.push(`Author: ${commit.author}`);
  parts.push(`Subject: ${commit.subject}`);
  parts.push(`Weighted additions: ${Math.round(commit.additions)}`);
  parts.push(`Weighted deletions: ${Math.round(commit.deletions)}`);
  parts.push(`Total files changed: ${commit.fileStats.length}`);
  parts.push(`</commit>`);

  parts.push(``);
  parts.push(`<context>`);
  parts.push(
    `Codebase size at time of commit: ~${Math.round(codebaseSizeAtCommit)} weighted lines`,
  );
  parts.push(`Project age at time of commit: ${projectAgeAtCommit}`);
  parts.push(`</context>`);

  parts.push(``);
  parts.push(`<files>`);
  for (const file of topFiles) {
    parts.push(`  +${file.additions} -${file.deletions}\t${file.filePath}`);
  }
  if (commit.fileStats.length > 20) {
    parts.push(`  ... and ${commit.fileStats.length - 20} more files`);
  }
  parts.push(`</files>`);

  if (surroundingCommits.before.length > 0) {
    parts.push(``);
    parts.push(`<commits-before>`);
    for (const c of surroundingCommits.before) {
      parts.push(
        `  ${c.timestamp} ${c.author} (+${Math.round(c.additions)}) ${c.subject}`,
      );
    }
    parts.push(`</commits-before>`);
  }

  if (surroundingCommits.after.length > 0) {
    parts.push(``);
    parts.push(`<commits-after>`);
    for (const c of surroundingCommits.after) {
      parts.push(
        `  ${c.timestamp} ${c.author} (+${Math.round(c.additions)}) ${c.subject}`,
      );
    }
    parts.push(`</commits-after>`);
  }

  return parts.join("\n");
}

function computeCodebaseSizeAtCommit(
  commit: Commit,
  allCommits: Commit[],
): number {
  let cumulativeLines = 0;
  for (const c of allCommits) {
    if (c.timestamp > commit.timestamp) {
      break;
    }
    cumulativeLines += c.additions - c.deletions;
  }
  return Math.max(0, cumulativeLines);
}

function computeProjectAgeAtCommit(
  commit: Commit,
  allCommits: Commit[],
): string {
  if (allCommits.length === 0) {
    return "unknown";
  }
  const firstTimestamp = allCommits[0]!.timestamp;
  const firstDate = new Date(firstTimestamp);
  const commitDate = new Date(commit.timestamp);
  const diffMs = commitDate.getTime() - firstDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 7) {
    return `${diffDays} days`;
  }
  if (diffDays < 365) {
    return `${Math.floor(diffDays / 7)} weeks`;
  }
  const years = (diffDays / 365).toFixed(1);
  return `${years} years`;
}

function getSurroundingCommits(
  commit: Commit,
  allCommits: Commit[],
  count: number,
): { before: Commit[]; after: Commit[] } {
  const index = allCommits.findIndex((c) => c.hash === commit.hash);
  if (index === -1) {
    return { before: [], after: [] };
  }

  const before = allCommits.slice(Math.max(0, index - count), index);
  const after = allCommits.slice(index + 1, index + 1 + count);
  return { before, after };
}

function getTopFiles(
  commit: Commit,
  count: number,
): { filePath: string; additions: number; deletions: number }[] {
  return [...commit.fileStats]
    .sort((a, b) => b.additions - a.additions)
    .slice(0, count);
}

function parseBatchClassification(
  response: string,
  expectedCount: number,
): OutlierClassification[] {
  const lines = response
    .trim()
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const classifications: OutlierClassification[] = [];

  for (const line of lines) {
    // Parse "hash: SLOP" or "hash: NOT_SLOP: reason"
    const match = line.match(/^[a-f0-9]+:\s*(.*)/i);
    const content = match ? match[1]! : line;

    classifications.push(parseSingleClassification(content));
  }

  // Pad with default if model returned fewer lines than expected
  while (classifications.length < expectedCount) {
    classifications.push({ isSlop: false, reason: "classification missing" });
  }

  return classifications.slice(0, expectedCount);
}

function parseSingleClassification(content: string): OutlierClassification {
  const trimmed = content.trim();
  if (trimmed.startsWith("NOT_SLOP")) {
    const reason = trimmed.replace(/^NOT_SLOP:?\s*/, "").trim() || "not slop";
    return { isSlop: false, reason };
  }
  if (trimmed.startsWith("SLOP")) {
    return { isSlop: true, reason: "AI-generated slop" };
  }
  // Fuzzy matching
  const lower = trimmed.toLowerCase();
  if (lower.includes("not_slop") || lower.includes("not slop")) {
    return { isSlop: false, reason: trimmed };
  }
  // Default to not slop (conservative)
  return { isSlop: false, reason: trimmed };
}

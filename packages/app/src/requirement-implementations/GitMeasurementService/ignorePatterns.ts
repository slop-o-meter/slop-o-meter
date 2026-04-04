import { readFile } from "node:fs/promises";
import { join } from "node:path";
import ignore, { type Ignore } from "ignore";
import { parse as parseToml } from "smol-toml";
import { parse as parseYaml } from "yaml";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Extractor = (parsed: Record<string, unknown>) => unknown;

interface TextIgnoreSource {
  type: "text";
  files: string[];
}

interface StructuredIgnoreSource {
  type: "json" | "toml" | "yaml";
  files: string[];
  extract: Extractor;
}

type IgnoreSource = TextIgnoreSource | StructuredIgnoreSource;

// ---------------------------------------------------------------------------
// Ignore source definitions
// ---------------------------------------------------------------------------

function deepGet(object: Record<string, unknown>, ...keys: string[]): unknown {
  let current: unknown = object;
  for (const key of keys) {
    if (current == null || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

const IGNORE_SOURCES: IgnoreSource[] = [
  // Plain-text gitignore-format files
  { type: "text", files: [".prettierignore"] },
  { type: "text", files: [".eslintignore"] },
  { type: "text", files: [".stylelintignore"] },

  // JSON config files
  {
    type: "json",
    files: ["biome.json", "biome.jsonc"],
    extract: (j) => deepGet(j, "files", "ignore"),
  },
  {
    type: "json",
    files: [".oxlintrc.json"],
    extract: (j) => j?.ignorePatterns,
  },
  {
    type: "json",
    files: [".oxfmtrc.json"],
    extract: (j) => j?.ignorePatterns,
  },
  {
    type: "json",
    files: ["tsconfig.json"],
    extract: (j) => j?.exclude,
  },
  {
    type: "json",
    files: ["deno.json"],
    extract: (j) => j?.exclude,
  },

  // TOML config files
  {
    type: "toml",
    files: ["ruff.toml"],
    extract: (t) => [
      ...toStringArray(t?.exclude),
      ...toStringArray(t?.["extend-exclude"]),
    ],
  },
  {
    type: "toml",
    files: ["pyproject.toml"],
    extract: (t) => {
      const ruff = deepGet(t, "tool", "ruff") as
        | Record<string, unknown>
        | undefined;
      if (!ruff) {
        return [];
      }
      return [
        ...toStringArray(ruff.exclude),
        ...toStringArray(ruff["extend-exclude"]),
      ];
    },
  },
  {
    type: "toml",
    files: ["rustfmt.toml", ".rustfmt.toml"],
    extract: (t) => t?.ignore,
  },

  // YAML config files
  {
    type: "yaml",
    files: [".golangci.yml", ".golangci.yaml"],
    extract: (y) => {
      const run = y?.run as Record<string, unknown> | undefined;
      if (!run) {
        return [];
      }
      return [
        ...toStringArray(run["skip-dirs"]),
        ...toStringArray(run["skip-files"]),
      ];
    },
  },
  {
    type: "yaml",
    files: [".rubocop.yml"],
    extract: (y) => deepGet(y, "AllCops", "Exclude"),
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

function stripJsonComments(text: string): string {
  return text.replace(/^\s*\/\/.*$/gm, "");
}

function splitIgnoreFileLines(content: string): string[] {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

async function readFirstFound(
  repoDir: string,
  filenames: string[],
): Promise<string | undefined> {
  for (const filename of filenames) {
    try {
      return await readFile(join(repoDir, filename), "utf-8");
    } catch {
      // File not found, try next
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Source readers
// ---------------------------------------------------------------------------

async function readTextSource(
  repoDir: string,
  source: TextIgnoreSource,
): Promise<string[]> {
  try {
    const content = await readFirstFound(repoDir, source.files);
    if (!content) {
      return [];
    }
    return splitIgnoreFileLines(content);
  } catch {
    return [];
  }
}

async function readJsonSource(
  repoDir: string,
  source: StructuredIgnoreSource,
): Promise<string[]> {
  try {
    const content = await readFirstFound(repoDir, source.files);
    if (!content) {
      return [];
    }
    const parsed = JSON.parse(stripJsonComments(content));
    return toStringArray(source.extract(parsed));
  } catch {
    return [];
  }
}

async function readTomlSource(
  repoDir: string,
  source: StructuredIgnoreSource,
): Promise<string[]> {
  try {
    const content = await readFirstFound(repoDir, source.files);
    if (!content) {
      return [];
    }
    const parsed = parseToml(content) as Record<string, unknown>;
    return toStringArray(source.extract(parsed));
  } catch {
    return [];
  }
}

async function readYamlSource(
  repoDir: string,
  source: StructuredIgnoreSource,
): Promise<string[]> {
  try {
    const content = await readFirstFound(repoDir, source.files);
    if (!content) {
      return [];
    }
    const parsed = parseYaml(content) as Record<string, unknown>;
    return toStringArray(source.extract(parsed));
  } catch {
    return [];
  }
}

async function readSource(
  repoDir: string,
  source: IgnoreSource,
): Promise<string[]> {
  switch (source.type) {
    case "text":
      return readTextSource(repoDir, source);
    case "json":
      return readJsonSource(repoDir, source);
    case "toml":
      return readTomlSource(repoDir, source);
    case "yaml":
      return readYamlSource(repoDir, source);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function readToolIgnorePatterns(
  repoDir: string,
): Promise<string[]> {
  const results = await Promise.all(
    IGNORE_SOURCES.map((source) => readSource(repoDir, source)),
  );
  return results.flat();
}

export default async function buildIgnore(
  repoDir: string,
): Promise<Ignore | undefined> {
  const toolPatterns = await readToolIgnorePatterns(repoDir);
  if (toolPatterns.length === 0) {
    return undefined;
  }

  const ig = ignore();
  ig.add(toolPatterns);
  return ig;
}

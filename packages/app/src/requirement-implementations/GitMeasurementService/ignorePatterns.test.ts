import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import buildIgnore, { readToolIgnorePatterns } from "./ignorePatterns.js";

function createTempDir() {
  return mkdtemp(join(tmpdir(), "ignore-test-"));
}

describe("readToolIgnorePatterns", () => {
  let tempDir: string;

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("returns empty array when no ignore files exist", async () => {
    // Setup SUT
    tempDir = await createTempDir();

    // Exercise
    const patterns = await readToolIgnorePatterns(tempDir);

    // Verify
    expect(patterns).toEqual([]);
  });

  it("reads .prettierignore", async () => {
    // Setup SUT
    tempDir = await createTempDir();
    await writeFile(
      join(tempDir, ".prettierignore"),
      "dist\ncoverage\n# comment\n\nnode_modules\n",
    );

    // Exercise
    const patterns = await readToolIgnorePatterns(tempDir);

    // Verify
    expect(patterns).toEqual(["dist", "coverage", "node_modules"]);
  });

  it("reads .eslintignore", async () => {
    // Setup SUT
    tempDir = await createTempDir();
    await writeFile(join(tempDir, ".eslintignore"), "build\n*.min.js\n");

    // Exercise
    const patterns = await readToolIgnorePatterns(tempDir);

    // Verify
    expect(patterns).toEqual(["build", "*.min.js"]);
  });

  it("reads .stylelintignore", async () => {
    // Setup SUT
    tempDir = await createTempDir();
    await writeFile(join(tempDir, ".stylelintignore"), "dist/**/*.css\n");

    // Exercise
    const patterns = await readToolIgnorePatterns(tempDir);

    // Verify
    expect(patterns).toEqual(["dist/**/*.css"]);
  });

  it("reads biome.json files.ignore", async () => {
    // Setup SUT
    tempDir = await createTempDir();
    await writeFile(
      join(tempDir, "biome.json"),
      JSON.stringify({ files: { ignore: ["dist", "coverage"] } }),
    );

    // Exercise
    const patterns = await readToolIgnorePatterns(tempDir);

    // Verify
    expect(patterns).toEqual(["dist", "coverage"]);
  });

  it("reads biome.jsonc with comments", async () => {
    // Setup SUT
    tempDir = await createTempDir();
    await writeFile(
      join(tempDir, "biome.jsonc"),
      '// This is a comment\n{ "files": { "ignore": ["generated/**"] } }\n',
    );

    // Exercise
    const patterns = await readToolIgnorePatterns(tempDir);

    // Verify
    expect(patterns).toEqual(["generated/**"]);
  });

  it("prefers biome.json over biome.jsonc", async () => {
    // Setup SUT
    tempDir = await createTempDir();
    await writeFile(
      join(tempDir, "biome.json"),
      JSON.stringify({ files: { ignore: ["from-json"] } }),
    );
    await writeFile(
      join(tempDir, "biome.jsonc"),
      JSON.stringify({ files: { ignore: ["from-jsonc"] } }),
    );

    // Exercise
    const patterns = await readToolIgnorePatterns(tempDir);

    // Verify
    expect(patterns).toEqual(["from-json"]);
  });

  it("reads .oxlintrc.json ignorePatterns", async () => {
    // Setup SUT
    tempDir = await createTempDir();
    await writeFile(
      join(tempDir, ".oxlintrc.json"),
      JSON.stringify({ ignorePatterns: ["vendor/**"] }),
    );

    // Exercise
    const patterns = await readToolIgnorePatterns(tempDir);

    // Verify
    expect(patterns).toEqual(["vendor/**"]);
  });

  it("reads .oxfmtrc.json ignorePatterns", async () => {
    // Setup SUT
    tempDir = await createTempDir();
    await writeFile(
      join(tempDir, ".oxfmtrc.json"),
      JSON.stringify({ ignorePatterns: ["generated/**"] }),
    );

    // Exercise
    const patterns = await readToolIgnorePatterns(tempDir);

    // Verify
    expect(patterns).toEqual(["generated/**"]);
  });

  it("reads tsconfig.json exclude", async () => {
    // Setup SUT
    tempDir = await createTempDir();
    await writeFile(
      join(tempDir, "tsconfig.json"),
      JSON.stringify({ exclude: ["node_modules", "dist"] }),
    );

    // Exercise
    const patterns = await readToolIgnorePatterns(tempDir);

    // Verify
    expect(patterns).toEqual(["node_modules", "dist"]);
  });

  it("reads deno.json exclude", async () => {
    // Setup SUT
    tempDir = await createTempDir();
    await writeFile(
      join(tempDir, "deno.json"),
      JSON.stringify({ exclude: ["npm/", "vendor/"] }),
    );

    // Exercise
    const patterns = await readToolIgnorePatterns(tempDir);

    // Verify
    expect(patterns).toEqual(["npm/", "vendor/"]);
  });

  it("reads ruff.toml exclude and extend-exclude", async () => {
    // Setup SUT
    tempDir = await createTempDir();
    await writeFile(
      join(tempDir, "ruff.toml"),
      'exclude = ["migrations"]\nextend-exclude = ["generated"]\n',
    );

    // Exercise
    const patterns = await readToolIgnorePatterns(tempDir);

    // Verify
    expect(patterns).toEqual(["migrations", "generated"]);
  });

  it("reads pyproject.toml [tool.ruff] section", async () => {
    // Setup SUT
    tempDir = await createTempDir();
    await writeFile(
      join(tempDir, "pyproject.toml"),
      '[tool.ruff]\nexclude = ["migrations"]\nextend-exclude = ["*.pyi"]\n',
    );

    // Exercise
    const patterns = await readToolIgnorePatterns(tempDir);

    // Verify
    expect(patterns).toEqual(["migrations", "*.pyi"]);
  });

  it("reads rustfmt.toml ignore", async () => {
    // Setup SUT
    tempDir = await createTempDir();
    await writeFile(
      join(tempDir, "rustfmt.toml"),
      'ignore = ["src/generated"]\n',
    );

    // Exercise
    const patterns = await readToolIgnorePatterns(tempDir);

    // Verify
    expect(patterns).toEqual(["src/generated"]);
  });

  it("reads .rustfmt.toml as fallback", async () => {
    // Setup SUT
    tempDir = await createTempDir();
    await writeFile(
      join(tempDir, ".rustfmt.toml"),
      'ignore = ["target/generated"]\n',
    );

    // Exercise
    const patterns = await readToolIgnorePatterns(tempDir);

    // Verify
    expect(patterns).toEqual(["target/generated"]);
  });

  it("reads .golangci.yml skip-dirs and skip-files", async () => {
    // Setup SUT
    tempDir = await createTempDir();
    await writeFile(
      join(tempDir, ".golangci.yml"),
      "run:\n  skip-dirs:\n    - vendor\n    - third_party\n  skip-files:\n    - '.*_test.go'\n",
    );

    // Exercise
    const patterns = await readToolIgnorePatterns(tempDir);

    // Verify
    expect(patterns).toEqual(["vendor", "third_party", ".*_test.go"]);
  });

  it("reads .rubocop.yml AllCops.Exclude", async () => {
    // Setup SUT
    tempDir = await createTempDir();
    await writeFile(
      join(tempDir, ".rubocop.yml"),
      "AllCops:\n  Exclude:\n    - 'db/schema.rb'\n    - 'vendor/**/*'\n",
    );

    // Exercise
    const patterns = await readToolIgnorePatterns(tempDir);

    // Verify
    expect(patterns).toEqual(["db/schema.rb", "vendor/**/*"]);
  });

  it("merges patterns from multiple sources", async () => {
    // Setup SUT
    tempDir = await createTempDir();
    await writeFile(join(tempDir, ".prettierignore"), "dist\n");
    await writeFile(
      join(tempDir, "biome.json"),
      JSON.stringify({ files: { ignore: ["coverage"] } }),
    );
    await writeFile(
      join(tempDir, "tsconfig.json"),
      JSON.stringify({ exclude: ["node_modules"] }),
    );

    // Exercise
    const patterns = await readToolIgnorePatterns(tempDir);

    // Verify
    expect(patterns).toContain("dist");
    expect(patterns).toContain("coverage");
    expect(patterns).toContain("node_modules");
  });

  it("silently skips malformed JSON", async () => {
    // Setup SUT
    tempDir = await createTempDir();
    await writeFile(join(tempDir, "biome.json"), "{ broken json !!!");

    // Exercise
    const patterns = await readToolIgnorePatterns(tempDir);

    // Verify
    expect(patterns).toEqual([]);
  });

  it("silently skips malformed TOML", async () => {
    // Setup SUT
    tempDir = await createTempDir();
    await writeFile(join(tempDir, "ruff.toml"), "= = = broken toml");

    // Exercise
    const patterns = await readToolIgnorePatterns(tempDir);

    // Verify
    expect(patterns).toEqual([]);
  });

  it("silently skips malformed YAML", async () => {
    // Setup SUT
    tempDir = await createTempDir();
    await writeFile(
      join(tempDir, ".golangci.yml"),
      "run:\n  skip-dirs:\n  - : invalid\n    broken: [",
    );

    // Exercise
    const patterns = await readToolIgnorePatterns(tempDir);

    // Verify
    expect(patterns).toEqual([]);
  });

  it("skips JSON configs with missing fields", async () => {
    // Setup SUT
    tempDir = await createTempDir();
    await writeFile(
      join(tempDir, "biome.json"),
      JSON.stringify({ linter: { enabled: true } }),
    );

    // Exercise
    const patterns = await readToolIgnorePatterns(tempDir);

    // Verify
    expect(patterns).toEqual([]);
  });
});

describe("buildIgnore", () => {
  let tempDir: string;

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("returns undefined when no ignore sources exist", async () => {
    // Setup SUT
    tempDir = await createTempDir();

    // Exercise
    const result = await buildIgnore(tempDir);

    // Verify
    expect(result).toBeUndefined();
  });

  it("works with only tool patterns", async () => {
    // Setup SUT
    tempDir = await createTempDir();
    await writeFile(join(tempDir, ".prettierignore"), "dist\ncoverage\n");

    // Exercise
    const result = await buildIgnore(tempDir);

    // Verify
    expect(result).toBeDefined();
    expect(result!.ignores("dist/index.js")).toBe(true);
    expect(result!.ignores("coverage/lcov.info")).toBe(true);
    expect(result!.ignores("src/main.ts")).toBe(false);
  });
});

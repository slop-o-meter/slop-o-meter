import { describe, expect, it } from "vitest";
import { parseBaselineDiffOutput, parseCommits } from "./gitLog.js";

function makeGitOutput(commits: string[]): string {
  return commits.join("\n");
}

let commitCounter = 0;

function commitBlock(
  timestamp: string,
  author: string,
  files: string[],
  body: string[] = [],
  options?: { hash?: string; subject?: string },
): string {
  const hash =
    options?.hash ?? `fake${String(++commitCounter).padStart(36, "0")}`;
  const subject = options?.subject ?? "test commit";
  const lines = [
    `COMMIT ${hash} ${timestamp} ${author}`,
    `SUBJECT ${subject}`,
    "BODY_START",
    ...body,
    "BODY_END",
    ...files,
  ];
  return lines.join("\n");
}

describe("parseCommits", () => {
  it("parses a single commit with weighted additions and deletions", () => {
    // Setup SUT
    const output = makeGitOutput([
      commitBlock("2025-01-06T10:00:00+00:00", "alice@example.com", [
        "10\t5\tsrc/foo.ts",
        "3\t1\tsrc/bar.ts",
      ]),
    ]);

    // Exercise
    const commits = parseCommits(output);

    // Verify
    expect(commits).toHaveLength(1);
    expect(commits[0]!.week).toBe("2025-W02");
    expect(commits[0]!.timestamp).toBe("2025-01-06T10:00:00+00:00");
    expect(commits[0]!.author).toBe("alice@example.com");
    expect(commits[0]!.subject).toBe("test commit");
    expect(commits[0]!.additions).toBe(13);
    expect(commits[0]!.deletions).toBe(6);
    expect(commits[0]!.coAuthors).toEqual([]);
    expect(commits[0]!.subCommitCount).toBe(0);
    expect(commits[0]!.fileStats).toHaveLength(2);
  });

  it("parses multiple commits", () => {
    // Setup SUT
    const output = makeGitOutput([
      commitBlock("2025-01-06T10:00:00+00:00", "alice@example.com", [
        "10\t5\tsrc/foo.ts",
      ]),
      "",
      commitBlock("2025-01-13T10:00:00+00:00", "bob@example.com", [
        "20\t3\tsrc/bar.ts",
      ]),
    ]);

    // Exercise
    const commits = parseCommits(output);

    // Verify
    expect(commits).toHaveLength(2);
    expect(commits[0]!.week).toBe("2025-W02");
    expect(commits[0]!.additions).toBe(10);
    expect(commits[1]!.week).toBe("2025-W03");
    expect(commits[1]!.additions).toBe(20);
  });

  it("returns empty array for empty output", () => {
    // Exercise
    const commits = parseCommits("");

    // Verify
    expect(commits).toEqual([]);
  });

  it("preserves bot commits", () => {
    // Setup SUT
    const output = makeGitOutput([
      commitBlock(
        "2025-01-06T10:00:00+00:00",
        "27856297+dependabot[bot]@users.noreply.github.com",
        ["100\t0\tsrc/deps.ts"],
      ),
    ]);

    // Exercise
    const commits = parseCommits(output);

    // Verify
    expect(commits).toHaveLength(1);
    expect(commits[0]!.author).toContain("dependabot");
  });

  it("derives ISO week from timestamp", () => {
    // Setup SUT — 2025-01-06 is in week 2 of 2025
    const output = makeGitOutput([
      commitBlock("2025-01-06T10:00:00+00:00", "alice@example.com", [
        "5\t0\tsrc/foo.ts",
      ]),
    ]);

    // Exercise
    const commits = parseCommits(output);

    // Verify
    expect(commits[0]!.week).toBe("2025-W02");
    expect(commits[0]!.timestamp).toBe("2025-01-06T10:00:00+00:00");
  });

  it("extracts co-authors from commit body", () => {
    // Setup SUT
    const output = makeGitOutput([
      commitBlock(
        "2025-01-06T10:00:00+00:00",
        "alice@example.com",
        ["10\t0\tsrc/foo.ts"],
        [
          "Some commit message",
          "",
          "Co-authored-by: Bob <bob@example.com>",
          "Co-authored-by: Carol <carol@example.com>",
        ],
      ),
    ]);

    // Exercise
    const commits = parseCommits(output);

    // Verify
    expect(commits[0]!.coAuthors).toEqual([
      "bob@example.com",
      "carol@example.com",
    ]);
  });

  it("counts sub-commits from bullet points in body", () => {
    // Setup SUT
    const output = makeGitOutput([
      commitBlock(
        "2025-01-06T10:00:00+00:00",
        "alice@example.com",
        ["10\t0\tsrc/foo.ts"],
        ["* first commit", "* second commit", "* third commit"],
      ),
    ]);

    // Exercise
    const commits = parseCommits(output);

    // Verify
    expect(commits[0]!.subCommitCount).toBe(3);
  });

  it("does not detect squash merge with fewer than 2 bullet points", () => {
    // Setup SUT
    const output = makeGitOutput([
      commitBlock(
        "2025-03-03T10:00:00+00:00",
        "alice@example.com",
        ["100\t0\tsrc/feature.ts"],
        ["* only one bullet"],
      ),
    ]);

    // Exercise
    const commits = parseCommits(output);

    // Verify
    expect(commits[0]!.subCommitCount).toBe(0);
  });

  it("ignores binary file markers", () => {
    // Setup SUT
    const output = makeGitOutput([
      commitBlock("2025-01-06T10:00:00+00:00", "alice@example.com", [
        "10\t5\tsrc/code.ts",
        "-\t-\tsrc/image.png",
      ]),
    ]);

    // Exercise
    const commits = parseCommits(output);

    // Verify
    expect(commits[0]!.additions).toBe(10);
    expect(commits[0]!.deletions).toBe(5);
  });

  describe("file weighting", () => {
    it("gives full weight to core code files", () => {
      // Setup SUT
      const output = makeGitOutput([
        commitBlock("2025-01-06T10:00:00+00:00", "alice@example.com", [
          "100\t20\tsrc/main.ts",
        ]),
      ]);

      // Exercise
      const commits = parseCommits(output);

      // Verify
      expect(commits[0]!.additions).toBe(100);
      expect(commits[0]!.deletions).toBe(20);
    });

    it("ignores non-code files like JSON, YAML, and markdown", () => {
      // Setup SUT
      const output = makeGitOutput([
        commitBlock("2025-01-06T10:00:00+00:00", "alice@example.com", [
          "100\t20\tsrc/main.ts",
          "500\t0\tdata/fixtures.json",
          "200\t0\tREADME.md",
          "50\t10\tconfig.yaml",
        ]),
      ]);

      // Exercise
      const commits = parseCommits(output);

      // Verify
      expect(commits[0]!.additions).toBe(100);
      expect(commits[0]!.deletions).toBe(20);
    });

    it("applies reduced weight to CSS files", () => {
      // Setup SUT
      const output = makeGitOutput([
        commitBlock("2025-01-06T10:00:00+00:00", "alice@example.com", [
          "100\t0\tstyles/main.css",
        ]),
      ]);

      // Exercise
      const commits = parseCommits(output);

      // Verify
      expect(commits[0]!.additions).toBeCloseTo(30); // 100 * 0.3
    });

    it("applies reduced weight to TSX files", () => {
      // Setup SUT
      const output = makeGitOutput([
        commitBlock("2025-01-06T10:00:00+00:00", "alice@example.com", [
          "100\t0\tsrc/Component.tsx",
        ]),
      ]);

      // Exercise
      const commits = parseCommits(output);

      // Verify
      expect(commits[0]!.additions).toBeCloseTo(50); // 100 * 0.5
    });

    it("gives half weight to test files", () => {
      // Setup SUT
      const output = makeGitOutput([
        commitBlock("2025-01-06T10:00:00+00:00", "alice@example.com", [
          "100\t0\tsrc/main.test.ts",
        ]),
      ]);

      // Exercise
      const commits = parseCommits(output);

      // Verify
      expect(commits[0]!.additions).toBeCloseTo(50); // 100 * 1.0 * 0.5
    });

    it("gives half weight to test files in test directories", () => {
      // Setup SUT
      const output = makeGitOutput([
        commitBlock("2025-01-06T10:00:00+00:00", "alice@example.com", [
          "100\t0\t__tests__/helper.ts",
        ]),
      ]);

      // Exercise
      const commits = parseCommits(output);

      // Verify
      expect(commits[0]!.additions).toBeCloseTo(50); // 100 * 1.0 * 0.5
    });

    it("gives half weight to Go test files", () => {
      // Setup SUT
      const output = makeGitOutput([
        commitBlock("2025-01-06T10:00:00+00:00", "alice@example.com", [
          "100\t0\tpkg/handler_test.go",
        ]),
      ]);

      // Exercise
      const commits = parseCommits(output);

      // Verify
      expect(commits[0]!.additions).toBeCloseTo(50); // 100 * 1.0 * 0.5
    });

    it("gives half weight to Python test files with test_ prefix", () => {
      // Setup SUT
      const output = makeGitOutput([
        commitBlock("2025-01-06T10:00:00+00:00", "alice@example.com", [
          "100\t0\ttests/test_handler.py",
        ]),
      ]);

      // Exercise
      const commits = parseCommits(output);

      // Verify
      expect(commits[0]!.additions).toBeCloseTo(50); // 100 * 1.0 * 0.5
    });

    it("gives zero weight to files in vendor directories", () => {
      // Setup SUT
      const output = makeGitOutput([
        commitBlock("2025-01-06T10:00:00+00:00", "alice@example.com", [
          "100\t0\tsrc/main.ts",
          "500\t0\tvendor/lib/utils.js",
          "300\t0\tapp/vendor/sdk/client.ts",
          "200\t0\tnode_modules/lodash/index.js",
          "400\t0\tthird_party/proto/generated.ts",
        ]),
      ]);

      // Exercise
      const commits = parseCommits(output);

      // Verify
      expect(commits[0]!.additions).toBe(100);
    });

    it("gives zero weight to minified and bundled files", () => {
      // Setup SUT
      const output = makeGitOutput([
        commitBlock("2025-01-06T10:00:00+00:00", "alice@example.com", [
          "100\t0\tsrc/main.ts",
          "5000\t0\tdist/app.min.js",
          "8000\t0\tdist/webchat.bundle.js",
        ]),
      ]);

      // Exercise
      const commits = parseCommits(output);

      // Verify
      expect(commits[0]!.additions).toBe(100);
    });

    it("gives zero weight to source map and declaration files", () => {
      // Setup SUT
      const output = makeGitOutput([
        commitBlock("2025-01-06T10:00:00+00:00", "alice@example.com", [
          "100\t0\tsrc/main.ts",
          "200\t0\tsrc/main.js.map",
          "50\t0\tsrc/types.d.ts",
        ]),
      ]);

      // Exercise
      const commits = parseCommits(output);

      // Verify
      expect(commits[0]!.additions).toBe(100);
    });

    it("tracks additions and deletions separately for all files", () => {
      // Setup SUT
      const output = makeGitOutput([
        commitBlock("2025-01-06T10:00:00+00:00", "alice@example.com", [
          "200\t0\tsrc/new-feature.ts",
          "0\t500\tsrc/old-module.ts",
          "80\t20\tsrc/refactored.ts",
        ]),
      ]);

      // Exercise
      const commits = parseCommits(output);

      // Verify
      expect(commits[0]!.additions).toBe(280); // 200 + 0 + 80
      expect(commits[0]!.deletions).toBe(520); // 0 + 500 + 20
    });
  });
});

describe("parseBaselineDiffOutput", () => {
  it("computes weighted line count from numstat output", () => {
    // Setup SUT
    const output = [
      "100\t0\tsrc/main.ts",
      "200\t0\tsrc/utils.go",
      "50\t0\tstyles/app.css",
    ].join("\n");

    // Exercise
    const result = parseBaselineDiffOutput(output);

    // Verify — ts=1.0, go=1.0, css=0.3
    expect(result).toBeCloseTo(100 + 200 + 50 * 0.3);
  });

  it("ignores non-code files", () => {
    // Setup SUT
    const output = [
      "100\t0\tsrc/main.ts",
      "500\t0\tREADME.md",
      "300\t0\tdata/config.json",
    ].join("\n");

    // Exercise
    const result = parseBaselineDiffOutput(output);

    // Verify
    expect(result).toBe(100);
  });

  it("gives half weight to test files", () => {
    // Setup SUT
    const output = [
      "100\t0\tsrc/main.ts",
      "200\t0\tsrc/main.test.ts",
      "150\t0\t__tests__/helper.ts",
    ].join("\n");

    // Exercise
    const result = parseBaselineDiffOutput(output);

    // Verify
    expect(result).toBe(275); // 100 + (200 * 0.5) + (150 * 0.5)
  });

  it("returns 0 for empty output", () => {
    // Exercise
    const result = parseBaselineDiffOutput("");

    // Verify
    expect(result).toBe(0);
  });

  it("only counts additions, ignoring the deletions column", () => {
    // Setup SUT — deletions column is present but irrelevant for baseline
    const output = "100\t50\tsrc/main.ts";

    // Exercise
    const result = parseBaselineDiffOutput(output);

    // Verify
    expect(result).toBe(100);
  });
});

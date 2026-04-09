# Slop Score Algorithm

The slop score measures the gap between two quantities:

- **Attention cost**: how much human attention the codebase demands, derived
  from counting weighted lines of code.
- **Attention spent**: how much human attention the project has actually
  received, derived from the capacity of active human contributors over time.

When more code is added than humans could have meaningfully produced or
reviewed, the excess is **slop**. The slop score is the ratio of slop lines to
total lines in the codebase.

## Measuring Attention Cost

Attention cost is the amount of human attention it would take to have
meaningfully produced and reviewed the codebase. It's measured indirectly from
the total lines of code count, with weights applied to account for line "type"
(e.g., a line of CSS requires less attention than a line of JavaScript) and line
"age" (e.g., a line in a new project requires less attention than a line in a 5
year old project).

### File Weighting

Not all files contribute equally to attention cost. Lines are weighted by file
type before aggregation:

- **Core logic (1.0):** `.ts`, `.rs`, etc.
- **SQL (0.8):** `.sql`
- **UI code (0.5):** `.tsx`, `.vue`, `.html`, etc.
- **Styling (0.3):** `.css`, `.scss`, etc.
- **Test and example files (`NON_PRODUCTION_WEIGHT` ×):** `.test.ts`,
  `.spec.js`, `_test.go`, files in `__tests__/`, `tests/`, `examples/`,
  `demos/`, `samples/`, etc. These are weighted at half their base type weight
  (e.g. a `.test.ts` file scores 0.5 instead of 1.0). Tests still require human
  attention to write and review, but less than production code.
- **Non-code (0.0):** `.json`, `.yaml`, `.md`, `.svg`, etc. These are completely
  excluded from line counts.

### Other Ignored Files

#### Linter/Formatter Ignore Lists

Files excluded by common linters and formatters are also excluded from
measurement (weight **0**). The logic is: if a project configures a tool to
ignore certain paths, those paths are very likely not human-authored source code
(generated, vendored, build output, etc.).

Patterns from all detected sources are merged together. Missing or malformed
config files are silently skipped.

Known limitation: tools that use regex-based excludes (Black, mypy, Pylint,
Flake8) or require JavaScript execution (`eslint.config.js`) are not supported.

#### Vendored and Generated Files

Files in vendored or third-party directories (`vendor/`, `node_modules/`,
`third_party/`, `external/`, `deps/`) have their weight set to **0**. These are
dependencies checked into the repo, not human-authored project code.

Minified files (`*.min.js`, `*.min.css`), bundled files (`*.bundle.js`), source
maps (`*.map`), and TypeScript declaration files (`*.d.ts`) are also excluded.

#### Outlier Files

Files are flagged as outliers using the **IQR method**: any file with a line
count above `Q3 + 1.5 × IQR` (where `IQR = Q3 − Q1` of file sizes across the
project) is considered statistically anomalous.

However, a statistically large file isn't necessarily noise. It may be where
most of the project's logic lives. An outlier file is only excluded if it
represents less than its "fair share" of the codebase, defined as
`totalLines / numberOfFiles`. If the file is larger than the fair-share
threshold, it's kept despite being a statistical outlier.

### Outlier Commit Detection

Some commits add a disproportionate number of lines in a single shot: code
drops, large migrations, vendored imports, monorepo restructuring, etc. These
inflate the slop score because the session time around a single commit can't
possibly cover thousands of lines.

The top `4 * projectAgeInYears` outlier commits (by net weighted additions) are
flagged for AI analysis: we ask an LLM to judge whether or not they are slop,
passing it (for each commit) context like the commit message, the file list, the
codebase size and age at the time, etc.

The model classifies each commit as either:

- **Slop** (AI-generated bulk code): the commit's additions are kept in the
  score.
- **Not slop**, with a reason (code drop, restructuring, vendor import, etc.):
  the commit's additions are excluded from excess but still contribute to
  codebase size.

The first two commits of a repository are always considered non-slop, if they
are outliers (they represent initial project setup).

### Codebase Size Dampening

The weight of a line depends on how large the codebase is when that line is
added. This captures two effects:

1. **Bootstrap grace**: every project starts with scaffolding (boilerplate,
   initial architecture, setup code) that is legitimately high-volume even for a
   human author. Early lines should carry less weight.
2. **Complexity scaling**: adding a line to a large codebase is harder than
   adding a line to a small one, because there's more context to navigate and
   more surface area to review. Lines added to larger codebases should carry
   slightly more weight.

The dampening factor is computed from the cumulative weighted line count
**including** the current week's additions:

```js
bootstrap = Math.min(1, cumulativeWeightedLines / BOOTSTRAP_THRESHOLD);
complexityBonus =
  COMPLEXITY_WEIGHT * Math.log2(1 + cumulativeWeightedLines / 100_000);
sizeDampening = bootstrap + complexityBonus;
```

The bootstrap factor uses a linear ramp from 0 to 1.0 at `BOOTSTRAP_THRESHOLD`
lines.

The complexity bonus grows logarithmically with no cap, but very slowly. At 100k
lines it adds ~0.05, at 1M lines ~0.17. This reflects the marginal difficulty of
working in a larger codebase without dramatically inflating scores.

## Measuring Attention Spent

Attention spent is the cumulative human attention that has been invested in the
project. Attention spent is estimated from observable signals of human activity:
git commits, PR comments, issue comments, and other GitHub events. Each signal
implies a window of active work around it. These windows are merged into
sessions, and the total session time is converted into lines of code attended
to.

### Signals

The following signals are used to estimate human activity:

- **Git commits**: the primary signal. Each commit generates a neighborhood of
  `BASE_NEIGHBORHOOD` hours before the commit timestamp. If the commit has an AI
  co-author (detected via bot patterns), the neighborhood is scaled down by
  `AI_CO_AUTHOR_ATTENTION_WEIGHT` (0.8×), reflecting that AI-assisted commits
  require less human attention.
- **Co-authors**: detected via `Co-authored-by` trailers. Each human co-author
  generates a signal at the commit's timestamp with a reduced neighborhood:
  first co-author gets `BASE_NEIGHBORHOOD × CO_AUTHOR_WEIGHTS[0]` (0.5×), second
  gets `CO_AUTHOR_WEIGHTS[1]` (0.25×), third and beyond get
  `CO_AUTHOR_WEIGHTS[2]` (0.125×). Co-authorship indicates contribution but not
  necessarily active work at the commit's exact timestamp, so the smaller window
  limits session inflation.
- **Squash commits**: detected by embedded sub-commit lists in the commit body.
  The neighborhood size scales with the number of sub-commits (see Squash Merge
  Detection below).
- **GitHub events**: PR comments, issue comments, and PR reviews. Each generates
  a neighborhood of `BASE_NEIGHBORHOOD` hours. GitHub events use login names
  (e.g. `octocat`) while git commits use emails (e.g. `octocat@example.com`). To
  match them, logins are resolved to git emails via two strategies:
  1. Extract logins from noreply-format emails (`{id}+{login}@...`) in the
     commit history.
  2. For remaining logins, query the GitHub commits API to find commits by that
     author and extract the email.

Bot-generated signals are excluded (see Bot Detection below).

### Sessions

Signals from the same contributor whose neighborhoods overlap are merged into
**sessions**. A session's duration is the union of its merged neighborhoods. The
total attention time for a contributor in a given week is the sum of their
session durations that fall within that week.

### Bot Detection

Bot authors are identified but **not removed** from the commit history. Their
code changes count toward attention cost like any other commit, but their
signals don't generate sessions. Detection uses two approaches:

1. **Known bot names**: accounts like `dependabot[bot]` and `renovate[bot]`, and
   AI coding agents like `devin[bot]` and `copilot[bot]`.
2. **Email patterns**: addresses matching `[bot]@users.noreply.github.com`,
   `noreply@*`, and AI agent prefixes (`codex@`, `claude@`, etc.).

### Contributor Weighting

Not all contributors' time counts equally. Drive-by contributors (typo fixers,
one-off PRs) are not deeply familiar with the codebase, so their time is less
effective at "attending to" code. Each contributor's session time is scaled by a
**core factor** before it counts toward attention spent.

The core factor is a smooth ramp based on commit activity:

```js
ramp = clamp(
  (commits - CORE_RAMP_START) / (CORE_RAMP_END - CORE_RAMP_START),
  0,
  1,
);
coreFactor = ramp * (1 + 0.25 * commitShare);
```

Contributors with fewer than `CORE_RAMP_START` commits have a core factor of 0
(their time doesn't count). The factor reaches 1.0 at `CORE_RAMP_END` commits.
The veteran multiplier (up to 1.25x) rewards deep codebase familiarity,
proportional to the contributor's share of total commits.

### Weekly Attention Spent

For each week, the effective time is computed per contributor and converted to
lines of code:

```js
effectiveTime = sessionDuration * coreFactor;
cappedTime = capWeeklyHours(effectiveTime);
attentionSpentThisWeek = totalCappedTime * LINES_PER_HOUR;
```

#### Per-Author Weekly Hour Cap

A single contributor's effective hours are capped per week to prevent inflated
session time (e.g. from co-author signals or dense commit activity) from
dominating the score. Hours above `WEEKLY_HOURS_CAP` are ignored entirely. Hours
below the cap are discounted according to one of three selectable overtime
curves:

- **Concave** (default): gentle early decline, steep late. Marginal rate
  `1 - (h / WEEKLY_HOURS_CAP)²`. Integral:
  `effectiveHours(H) = H - H³ / (3 × WEEKLY_HOURS_CAP²)`. At 20 raw hours a
  contributor gets ~19.6 effective hours. At 40 hours: ~36.7. At 80 hours (the
  cap): ~53.3.
- **Linear ramp**: hours up to `WEEKLY_HOURS_FULL` count at full value. Beyond
  that, marginal value declines linearly to zero at `WEEKLY_HOURS_CAP`.
- **Cosine**: S-shaped curve where marginal rate is
  `(1 + cos(π × h / WEEKLY_HOURS_CAP)) / 2`.

Attention spent is not capped at net additions. In weeks where contributors
spend significant time refactoring, reviewing, or debugging without producing
net new lines, the attention still counts. This also allows the estimate to
self-correct over time: overestimates in some weeks balance out underestimates
in others (e.g. from squash commits whose true work duration is hard to
reconstruct).

## Slop Score Computation

The slop score is computed by walking through the project's weekly history
chronologically, comparing each week's attention cost against the available
attention.

### 1. Weekly Excess

For each week, compare net weighted additions (from all contributors, including
bots) against the weekly attention capacity:

```
netAdditions = max(0, weightedAdditions - weightedDeletions)
excess = max(0, netAdditions - weeklyCapacity)
```

If net additions are within the weekly capacity, excess is 0 (all code was
attended to). If they exceed it, the excess lines are slop.

### 2. Final Score

The slop score is a **ratio** of cumulative slop to cumulative attention cost:

```
score = cumulativeSlop / cumulativeTotalWeightedLines
```

This produces a value between 0 and 1. A score of 0 means all code was within
the capacity of its human contributors: the project's attention cost is fully
covered. A score of 0.8 means 80% of the codebase's weighted lines were added
beyond what humans could have reasonably produced or reviewed.

## Constants

| Constant                        | Value            | Purpose                                                       |
| ------------------------------- | ---------------- | ------------------------------------------------------------- |
| `BOOTSTRAP_THRESHOLD`           | 5,000            | Cumulative lines at which bootstrap dampening reaches 1       |
| `COMPLEXITY_WEIGHT`             | 0.05             | Scaling factor for the logarithmic complexity bonus           |
| `BASE_NEIGHBORHOOD`             | 1                | Hours of work implied by a single signal                      |
| `MARGINAL_HOURS_PER_SUBCOMMIT`  | 1                | Additional hours per sub-commit in a squash merge             |
| `NON_PRODUCTION_WEIGHT`         | 0.5              | Weight multiplier for test and example files                  |
| `AI_CO_AUTHOR_ATTENTION_WEIGHT` | 0.8              | Neighborhood multiplier for AI co-author signals              |
| `CO_AUTHOR_WEIGHTS`             | 0.5, 0.25, 0.125 | Neighborhood multiplier for 1st, 2nd, 3rd+ human co-authors   |
| `LINES_PER_HOUR`                | 40               | Weighted LOC one contributor can attend to per hour           |
| `CORE_RAMP_START`               | 10               | Commits below which core factor is 0                          |
| `CORE_RAMP_END`                 | 60               | Commits at which core factor reaches 1.0                      |
| `WEEKLY_HOURS_FULL`             | 40               | Weekly hours that count at full value (linear-ramp mode only) |
| `WEEKLY_HOURS_CAP`              | 80               | Weekly hours per author at which marginal value reaches 0     |
| `OUTLIER_MIN_ADDITIONS`         | 2,000            | Minimum net weighted additions to flag a commit as outlier    |

## Score Interpretation

| Level | Name                | Score Range |
| ----- | ------------------- | ----------- |
| 1     | Buttered Noodles    | 0 to 0.2    |
| 2     | Spaghetti Bolognese | 0.2 to 0.4  |
| 3     | Lasagna             | 0.4 to 0.6  |
| 4     | Sloppy Joe          | 0.6 to 0.8  |
| 5     | Just The Slop       | 0.8 to 1    |

## Examples

**Solo dev, steady work, moderate output:** A developer commits regularly,
generating enough session time to cover their weekly additions. No excess any
week. Score: Buttered Noodles.

**Solo dev, high output with consistent commits:** A developer adds 3,000
weighted lines per week but commits frequently throughout the day, generating
substantial session time. If sessions cover all additions, score stays low.

**Weekend slop project, 50,000 lines in 2 days:** A few commits over a weekend
generate limited session time. The vast majority of lines are excess. Score
close to 1. Just The Slop.

**Active team with reviews and discussion:** Five contributors committing,
reviewing PRs, and commenting on issues. The combined session time easily covers
the weekly additions. Score: Buttered Noodles.

---

## Notes

### Squash Merge Detection

Squash merges collapse a feature branch into a single commit. The algorithm
detects them by looking for embedded sub-commit lists (bullet points in the
commit body) and `Co-authored-by` trailers.

When a squash merge is detected, its neighborhood is scaled by the number of
sub-commits:
`BASE_NEIGHBORHOOD + subCommitCount * MARGINAL_HOURS_PER_SUBCOMMIT`. Co-authors
generate their own signals for that commit's timestamp, so their time counts
toward attention spent as well.

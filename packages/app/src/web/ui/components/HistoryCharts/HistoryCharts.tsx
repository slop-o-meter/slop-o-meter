import { cx } from "hono/css";
import componentAsset from "../../componentAsset.js";
import scaleItems from "../../data/scaleItems.js";
import { scoreToDisplay } from "../../utils/scoring.js";
import {
  changeChartBarNegativeClass,
  changeChartBarPositiveClass,
  changeChartBarSpacerClass,
  changeChartBarWrapperClass,
  changeChartGridClass,
  changeLabelClass,
  changeLabelSpacerClass,
  changeYAxisClass,
  chartGridlineClass,
  chartGridlineZeroClass,
  chartGridlinesClass,
  chartLabelClass,
  chartMilestoneClass,
  chartMilestoneLabelClass,
  chartMilestoneLineClass,
  chartMilestoneLogoClass,
  chartTooltipClass,
  chartTooltipImageClass,
  chartTooltipScoreClass,
  chartTooltipTextClass,
  chartTooltipWeekClass,
  contentClass,
  historyChartsClass,
  monthMarkerLabelClass,
  monthMarkerNotchClass,
  monthMarkerRowClass,
  monthMarkerSegmentClass,
  scoreChartBarClass,
  scoreChartBarColumnClass,
  scoreChartGridClass,
  scoreLabelClass,
  scoreLabelSpacerClass,
  scoreYAxisClass,
  scrollAreaClass,
  scrollContentClass,
  yAxisClass,
  yAxisInnerClass,
} from "./HistoryCharts.styles.js";

// --- Helpers ---

interface HistoryEntry {
  week: string;
  score: number;
}

interface ChangeEntry {
  week: string;
  change: number;
}

interface WeekMarker {
  notchPosition: number;
  segmentStart: number;
  segmentEnd: number;
  label: string;
}

function scoreLevel(score: number): number {
  const display = scoreToDisplay(score);
  return Math.min(5, Math.max(1, Math.ceil(display)));
}

function getBarColorVar(score: number): string {
  return `var(--level-${String(scoreLevel(score))})`;
}

function formatWeekLabel(week: string): string {
  const [, weekNum] = week.split("-W");
  const date = weekToDate(week);
  const monthName = SHORT_MONTHS[date.getMonth()] ?? "";
  return `Week ${weekNum}, ${monthName} ${String(date.getFullYear())}`;
}

function getLevelImage(score: number): string {
  const level = scoreLevel(score);
  const item = scaleItems.find((scaleItem) => scaleItem.level === level);
  return item?.image ?? "";
}

function weekToDate(week: string): Date {
  const [yearStr, weekStr] = week.split("-W");
  const year = Number(yearStr);
  const weekNum = Number(weekStr);
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - dayOfWeek + 1 + (weekNum - 1) * 7);
  return monday;
}

function computeChanges(entries: HistoryEntry[]): ChangeEntry[] {
  return entries.slice(1).map((entry, i) => ({
    week: entry.week,
    change: scoreToDisplay(entry.score) - scoreToDisplay(entries[i]!.score),
  }));
}

const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

type MarkerGranularity = "year" | "quarter" | "month";

function pickGranularity(entryCount: number): MarkerGranularity {
  if (entryCount > 104) {
    return "year";
  }
  if (entryCount > 27) {
    return "quarter";
  }
  return "month";
}

const QUARTER_MONTHS = new Set([0, 3, 6, 9]);

function isBoundary(
  granularity: MarkerGranularity,
  month: number,
  year: number,
  lastMonth: number,
  lastYear: number,
): boolean {
  if (granularity === "year") {
    return year !== lastYear;
  }
  if (granularity === "quarter") {
    return (
      (year !== lastYear || month !== lastMonth) && QUARTER_MONTHS.has(month)
    );
  }
  return year !== lastYear || month !== lastMonth;
}

function boundaryDate(
  granularity: MarkerGranularity,
  month: number,
  year: number,
): Date {
  if (granularity === "year") {
    return new Date(year, 0, 1);
  }
  return new Date(year, month, 1);
}

function boundaryLabel(
  granularity: MarkerGranularity,
  month: number,
  year: number,
): string {
  const shortYear = `'${String(year).slice(-2)}`;
  if (granularity === "year") {
    return String(year);
  }
  if (granularity === "quarter") {
    const startMonth = SHORT_MONTHS[month] ?? "";
    const endMonth = SHORT_MONTHS[month + 2] ?? "";
    return `${startMonth}\u2013${endMonth} ${shortYear}`;
  }
  const monthName = SHORT_MONTHS[month] ?? "";
  return `${monthName} ${shortYear}`;
}

function computeWeekMarkers(entries: { week: string }[]): WeekMarker[] {
  if (entries.length < 2) {
    return [];
  }

  const granularity = pickGranularity(entries.length);
  const boundaries: { notchPosition: number; label: string }[] = [];
  let lastMonth = -1;
  let lastYear = -1;

  for (let i = 0; i < entries.length; i++) {
    const date = weekToDate(entries[i]!.week);
    const month = date.getMonth();
    const year = date.getFullYear();

    if (isBoundary(granularity, month, year, lastMonth, lastYear)) {
      const target = boundaryDate(granularity, month, year);
      const daysDiff =
        (target.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
      const notchPosition = Math.max(0, (i + daysDiff / 7) / entries.length);
      boundaries.push({
        notchPosition,
        label: boundaryLabel(granularity, month, year),
      });
      lastMonth = month;
      lastYear = year;
    }
  }

  return boundaries.map((boundary, i) => {
    const nextNotch =
      i + 1 < boundaries.length ? boundaries[i + 1]!.notchPosition : 1;
    return {
      notchPosition: boundary.notchPosition,
      segmentStart: boundary.notchPosition,
      segmentEnd: nextNotch,
      label: boundary.label,
    };
  });
}

function WeekMarkerRow({ markers }: { markers: WeekMarker[] }) {
  return (
    <div class={monthMarkerRowClass}>
      {markers.map((marker) => (
        <div>
          <div
            class={monthMarkerNotchClass}
            style={`left: ${String(marker.notchPosition * 100)}%`}
          />
          <div
            class={monthMarkerSegmentClass}
            data-marker-segment
            style={`left: ${String(marker.segmentStart * 100)}%; width: ${String((marker.segmentEnd - marker.segmentStart) * 100)}%`}
          >
            <span class={monthMarkerLabelClass} data-marker-label>
              {marker.label}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

interface Milestone {
  date: Date;
  label: string;
  logo: string;
}

const MILESTONES: Milestone[] = [
  { date: new Date(2022, 5, 21), label: "Copilot", logo: "/copilot-logo.svg" },
  { date: new Date(2023, 2, 14), label: "GPT-4", logo: "/gpt-logo.svg" },
  {
    date: new Date(2024, 5, 20),
    label: "Sonnet 3.5",
    logo: "/claude-logo.svg",
  },
  {
    date: new Date(2025, 10, 24),
    label: "Opus 4.5",
    logo: "/claude-logo.svg",
  },
];

interface PositionedMilestone {
  position: number;
  label: string;
  logo: string;
}

function computeMilestones(entries: { week: string }[]): PositionedMilestone[] {
  if (entries.length < 2) {
    return [];
  }

  const firstDate = weekToDate(entries[0]!.week);
  const lastDate = weekToDate(entries[entries.length - 1]!.week);
  const totalMs = lastDate.getTime() - firstDate.getTime();

  if (totalMs <= 0) {
    return [];
  }

  return MILESTONES.filter(
    (milestone) => milestone.date >= firstDate && milestone.date <= lastDate,
  ).map((milestone) => ({
    position: (milestone.date.getTime() - firstDate.getTime()) / totalMs,
    label: milestone.label,
    logo: milestone.logo,
  }));
}

// --- Component ---

interface Props {
  history: HistoryEntry[];
}

const BAR_SLOT = 7;
const MAX_VISIBLE_WEEKS = 130;

export default function HistoryCharts({ history }: Props) {
  const changes = computeChanges(history);
  const weekMarkers = computeWeekMarkers(history);
  const milestones = computeMilestones(history);
  const hasChanges = changes.length > 0;
  const maxAbsChange = Math.max(0.5, ...changes.map((c) => Math.abs(c.change)));
  const scrollable = history.length > MAX_VISIBLE_WEEKS;
  const contentWidth = scrollable
    ? `${String(history.length * BAR_SLOT)}px`
    : undefined;

  return (
    <div class={historyChartsClass} data-history-charts>
      <script src={componentAsset("HistoryCharts.client.js")} defer />
      <div class={chartTooltipClass} data-chart-tooltip="score">
        <img
          class={chartTooltipImageClass}
          data-chart-tooltip-image
          src=""
          alt=""
        />
        <div class={chartTooltipTextClass}>
          <div class={chartTooltipWeekClass} data-chart-tooltip-week />
          <div class={chartTooltipScoreClass} data-chart-tooltip-score />
        </div>
      </div>
      <div class={chartTooltipClass} data-chart-tooltip="change">
        <div class={chartTooltipTextClass}>
          <div class={chartTooltipWeekClass} data-chart-tooltip-week />
          <div class={chartTooltipScoreClass} data-chart-tooltip-change />
        </div>
      </div>
      <div class={cx(chartLabelClass, scoreLabelClass)}>
        Slop Score Over Time
      </div>
      <div class={cx(yAxisClass, scoreYAxisClass)}>
        <div class={yAxisInnerClass}>
          <span style="top: 0%">5</span>
          <span style="top: 20%">4</span>
          <span style="top: 40%">3</span>
          <span style="top: 60%">2</span>
          <span style="top: 80%">1</span>
          <span style="top: 100%">0</span>
        </div>
      </div>

      {hasChanges ? (
        <>
          <div class={cx(chartLabelClass, changeLabelClass)}>Weekly change</div>
          <div class={cx(yAxisClass, changeYAxisClass)}>
            <div class={yAxisInnerClass}>
              <span style="top: 0%">{`+${maxAbsChange.toFixed(1)}`}</span>
              <span style="top: 50%">0</span>
              <span style="top: 100%">{`-${maxAbsChange.toFixed(1)}`}</span>
            </div>
          </div>
        </>
      ) : null}

      <div class={scrollable ? scrollAreaClass : contentClass}>
        <div
          class={scrollable ? scrollContentClass : undefined}
          style={contentWidth ? `width: ${contentWidth}` : undefined}
        >
          <div class={scoreLabelSpacerClass} />
          <div>
            <div class={scoreChartGridClass} data-score-chart>
              <div class={chartGridlinesClass}>
                <div class={chartGridlineClass} style="top: 16.67%" />
                <div class={chartGridlineClass} style="top: 33.33%" />
                <div class={chartGridlineClass} style="top: 50%" />
                <div class={chartGridlineClass} style="top: 66.67%" />
                <div class={chartGridlineClass} style="top: 83.33%" />
              </div>
              {milestones.map((milestone) => (
                <div
                  class={chartMilestoneClass}
                  style={`left: ${String(milestone.position * 100)}%`}
                >
                  <div class={chartMilestoneLineClass} />
                  <div class={chartMilestoneLabelClass}>
                    <img
                      class={chartMilestoneLogoClass}
                      src={milestone.logo}
                      alt=""
                    />
                    <span>{milestone.label}</span>
                  </div>
                </div>
              ))}
              {history.map((entry) => (
                <div
                  class={scoreChartBarColumnClass}
                  data-tooltip-week={formatWeekLabel(entry.week)}
                  data-tooltip-score={scoreToDisplay(entry.score).toFixed(1)}
                  data-tooltip-image={getLevelImage(entry.score)}
                >
                  <div
                    class={scoreChartBarClass}
                    style={`height: ${String((scoreToDisplay(entry.score) / 6) * 100)}%; background-color: ${getBarColorVar(entry.score)}`}
                  />
                </div>
              ))}
            </div>
            <WeekMarkerRow markers={weekMarkers} />
          </div>
          {hasChanges ? (
            <>
              <div class={changeLabelSpacerClass} />
              <div>
                <div class={changeChartGridClass} data-change-chart>
                  <div class={chartGridlinesClass}>
                    <div class={chartGridlineClass} style="top: 0%" />
                    <div
                      class={cx(chartGridlineClass, chartGridlineZeroClass)}
                      style="top: 50%"
                    />
                    <div class={chartGridlineClass} style="top: 100%" />
                  </div>
                  <div class={changeChartBarSpacerClass} />
                  {changes.map((entry) => {
                    const height = (Math.abs(entry.change) / maxAbsChange) * 50;
                    const isPositive = entry.change >= 0;
                    const sign = entry.change >= 0 ? "+" : "";
                    return (
                      <div
                        class={changeChartBarWrapperClass}
                        data-tooltip-week={formatWeekLabel(entry.week)}
                        data-tooltip-change={`${sign}${entry.change.toFixed(2)}`}
                      >
                        <div
                          class={
                            isPositive
                              ? changeChartBarPositiveClass
                              : changeChartBarNegativeClass
                          }
                          style={`height: ${String(height)}%; ${isPositive ? `bottom: 50%` : `top: 50%`}`}
                        />
                      </div>
                    );
                  })}
                </div>
                <WeekMarkerRow markers={weekMarkers} />
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

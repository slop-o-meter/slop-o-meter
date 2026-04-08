import toMeasurement from "../../../../requirement-implementations/GitMeasurementService/GitMeasurement.js";
import type { MeasurementOptions } from "../../../../requirement-implementations/GitMeasurementService/GitMeasurement.js";
import type { MeasurementData } from "../../../../requirements/MeasurementService.js";
import scaleItems from "../../data/scaleItems.js";
import { scoreToDisplay, scoreToLevel } from "../../utils/scoring.js";

function getLevelImage(score: number): string {
  const level = scoreToLevel(score);
  return scaleItems.find((item) => item.level === level)?.image ?? "";
}

function getBarColorVar(score: number): string {
  return `var(--level-${String(scoreToLevel(score))})`;
}

// --- Default values ---

const DEFAULTS: Record<string, number | string> = {
  humanLinesPerHour: 40,
  overtimeCurve: "concave",
  fullCreditHoursPerWeek: 40,
  maxHoursPerWeek: 80,
  minCommitsForCredit: 10,
  commitsForFullCredit: 60,
  smallRepoThreshold: 5000,
  largeRepoComplexityBonus: 0.05,
};

// --- DOM references ---

const toggle = document.querySelector<HTMLButtonElement>(
  "[data-tunable-toggle]",
);
const panel = document.querySelector<HTMLElement>("[data-tunable-panel]");
const resetButton = document.querySelector<HTMLButtonElement>(
  "[data-tunable-reset]",
);
const titleElement = document.querySelector<HTMLElement>(
  "[data-tunable-title]",
);

// --- Info tooltips ---

const tooltip = document.querySelector<HTMLElement>("[data-tunable-tooltip]");

document.addEventListener("mouseover", (event) => {
  const tip = (event.target as HTMLElement).closest<HTMLElement>(
    "[data-info-tip]",
  );
  if (!tip || !tooltip) {
    if (tooltip) {
      tooltip.removeAttribute("data-visible");
    }
    return;
  }
  tooltip.textContent = tip.getAttribute("data-info-tip")!;
  const rect = tip.getBoundingClientRect();
  tooltip.style.top = `${String(rect.top + rect.height / 2)}px`;
  tooltip.style.transform = "translateY(-50%)";
  // Position to the left of the icon
  tooltip.style.left = "";
  tooltip.style.right = `${String(window.innerWidth - rect.left + 6)}px`;
  tooltip.setAttribute("data-visible", "");
});

document.addEventListener("mouseout", (event) => {
  const tip = (event.target as HTMLElement).closest<HTMLElement>(
    "[data-info-tip]",
  );
  if (tip && tooltip) {
    tooltip.removeAttribute("data-visible");
  }
});

if (toggle && panel) {
  // --- State ---

  let measurementData: MeasurementData | null = null;
  let loading = false;

  const scriptTag = document.querySelector<HTMLScriptElement>(
    "script[data-owner][data-repo]",
  );
  const owner = scriptTag?.getAttribute("data-owner") ?? "";
  const repo = scriptTag?.getAttribute("data-repo") ?? "";

  // --- Toggle panel ---

  const PANEL_WIDTH = 320;

  function openPanel() {
    panel!.setAttribute("data-open", "");
    toggle!.setAttribute("data-active", "");
    document.body.style.marginRight = `${String(PANEL_WIDTH)}px`;
    document.body.style.transition = "margin-right 0.25s ease";
    if (!measurementData && !loading) {
      loadMeasurementData();
    }
  }

  function closePanel() {
    panel!.removeAttribute("data-open");
    toggle!.removeAttribute("data-active");
    document.body.style.marginRight = "";
  }

  toggle.addEventListener("click", () => {
    if (panel.hasAttribute("data-open")) {
      closePanel();
    } else {
      openPanel();
    }
  });

  // --- Load measurement data ---

  async function loadMeasurementData() {
    loading = true;
    if (titleElement) {
      titleElement.textContent = "Loading\u2026";
    }

    try {
      const response = await fetch(
        `/api/project/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/measurement-data`,
      );
      if (!response.ok) {
        if (titleElement) {
          titleElement.textContent = "Failed to load";
        }
        return;
      }
      const json = await response.json();
      if (json.found === false || !json.commits) {
        if (titleElement) {
          titleElement.textContent = "No data available";
        }
        return;
      }
      measurementData = json as MeasurementData;
      if (titleElement) {
        titleElement.textContent = "Tunable Parameters";
      }
    } catch {
      if (titleElement) {
        titleElement.textContent = "Failed to load";
      }
      return;
    } finally {
      loading = false;
    }
  }

  // --- Read current options from DOM ---

  function readOptions(): MeasurementOptions {
    const options: MeasurementOptions = {};

    for (const input of panel!.querySelectorAll<HTMLInputElement>(
      "input[data-tunable-param]",
    )) {
      const param = input.getAttribute("data-tunable-param")!;
      (options as Record<string, number>)[param] = Number(input.value);
    }

    for (const select of panel!.querySelectorAll<HTMLSelectElement>(
      "select[data-tunable-param]",
    )) {
      const param = select.getAttribute("data-tunable-param")!;
      (options as Record<string, string>)[param] = select.value;
    }

    return options;
  }

  // --- Replay and update ---

  function replay() {
    if (!measurementData) {
      return;
    }

    const result = toMeasurement(measurementData, readOptions());

    updateScoreCard(result.currentScore);
    updateScoreChart(result.history);
    updateChangeChart(result.history);
  }

  // --- Update score card ---

  function updateScoreCard(currentScore: number) {
    const displayScore = scoreToDisplay(currentScore);
    const level = scoreToLevel(currentScore);

    const scoreElement =
      document.querySelector<HTMLElement>("[data-card-score]");
    if (scoreElement) {
      scoreElement.textContent = displayScore.toFixed(1);
      scoreElement.style.color = `color-mix(in srgb, var(--ragu) ${String((displayScore / 5) * 100)}%, var(--buttered-noodles))`;
    }

    const stickerImage = document.querySelector<HTMLImageElement>(
      "[data-card-sticker]",
    );
    if (stickerImage) {
      const scaleItem = scaleItems.find((item) => item.level === level);
      if (scaleItem) {
        stickerImage.src = scaleItem.image;
        stickerImage.alt =
          scaleItem.image.split("/").pop()?.split(".")[0] ?? "";
      }
    }
  }

  // --- Update score chart ---

  function updateScoreChart(history: { week: string; score: number }[]) {
    const bars = document.querySelectorAll<HTMLElement>(
      "[data-score-chart] [data-tooltip-week]",
    );

    for (let i = 0; i < bars.length && i < history.length; i++) {
      const entry = history[i]!;
      const bar = bars[i]!;
      const display = scoreToDisplay(entry.score);

      bar.setAttribute("data-tooltip-score", display.toFixed(1));
      bar.setAttribute("data-tooltip-image", getLevelImage(entry.score));

      const barFill = bar.querySelector<HTMLElement>("div");
      if (barFill) {
        barFill.style.height = `${String((display / 6) * 100)}%`;
        barFill.style.backgroundColor = getBarColorVar(entry.score);
      }
    }
  }

  // --- Update change chart ---

  function updateChangeChart(history: { week: string; score: number }[]) {
    const changes: number[] = [];
    for (let i = 1; i < history.length; i++) {
      changes.push(
        scoreToDisplay(history[i]!.score) -
          scoreToDisplay(history[i - 1]!.score),
      );
    }

    const maxAbsChange = Math.max(
      0.1,
      ...changes.map((change) => Math.abs(change)),
    );

    const bars = document.querySelectorAll<HTMLElement>(
      "[data-change-chart] [data-tooltip-week]",
    );

    for (let i = 0; i < bars.length && i < changes.length; i++) {
      const change = changes[i]!;
      const bar = bars[i]!;

      bar.setAttribute("data-tooltip-change", change.toFixed(2));

      const positive = bar.querySelector<HTMLElement>("[data-bar-positive]");
      const negative = bar.querySelector<HTMLElement>("[data-bar-negative]");

      if (change >= 0) {
        if (positive) {
          positive.style.height = `${String((Math.abs(change) / maxAbsChange) * 50)}%`;
        }
        if (negative) {
          negative.style.height = "0%";
        }
      } else {
        if (positive) {
          positive.style.height = "0%";
        }
        if (negative) {
          negative.style.height = `${String((Math.abs(change) / maxAbsChange) * 50)}%`;
        }
      }
    }
  }

  // --- Debounced replay ---

  let replayTimer: ReturnType<typeof setTimeout> | null = null;

  function debouncedReplay() {
    if (replayTimer) {
      clearTimeout(replayTimer);
    }
    replayTimer = setTimeout(replay, 250);
  }

  // --- Event listeners ---

  panel.addEventListener("input", (event) => {
    const target = event.target as HTMLElement;
    const param = target.getAttribute("data-tunable-param");
    if (!param) {
      return;
    }
    const valueDisplay = panel.querySelector<HTMLElement>(
      `[data-tunable-value="${param}"]`,
    );
    if (valueDisplay) {
      valueDisplay.textContent = (target as HTMLInputElement).value;
    }
    debouncedReplay();
  });

  panel.addEventListener("change", (event) => {
    const target = event.target as HTMLElement;
    if (target.getAttribute("data-tunable-param")) {
      replay();
    }
  });

  resetButton?.addEventListener("click", () => {
    for (const input of panel.querySelectorAll<HTMLInputElement>(
      "input[data-tunable-param]",
    )) {
      const param = input.getAttribute("data-tunable-param")!;
      const defaultValue = DEFAULTS[param];
      if (defaultValue !== undefined) {
        input.value = String(defaultValue);
        const valueDisplay = panel.querySelector<HTMLElement>(
          `[data-tunable-value="${param}"]`,
        );
        if (valueDisplay) {
          valueDisplay.textContent = String(defaultValue);
        }
      }
    }

    for (const select of panel.querySelectorAll<HTMLSelectElement>(
      "select[data-tunable-param]",
    )) {
      const param = select.getAttribute("data-tunable-param")!;
      const defaultValue = DEFAULTS[param];
      if (defaultValue !== undefined) {
        select.value = String(defaultValue);
      }
    }

    replay();
  });
}

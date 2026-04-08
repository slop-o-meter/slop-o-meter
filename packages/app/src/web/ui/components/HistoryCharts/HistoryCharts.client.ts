const chartsContainer = document.querySelector<HTMLElement>(
  "[data-history-charts]",
);

function setupChartTooltip(
  grid: HTMLElement | null,
  tooltip: HTMLElement | null,
  updateContent: (bar: HTMLElement, tooltip: HTMLElement) => void,
) {
  if (!grid || !tooltip || !chartsContainer) {
    return;
  }

  const crosshair = document.createElement("div");
  crosshair.setAttribute("data-crosshair", "");
  grid.appendChild(crosshair);

  let currentTarget: HTMLElement | null = null;

  grid.addEventListener("mousemove", (event: MouseEvent) => {
    const bar = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-tooltip-week]",
    );
    if (!bar) {
      delete tooltip.dataset.visible;
      delete crosshair.dataset.visible;
      currentTarget = null;
      return;
    }

    if (bar !== currentTarget) {
      currentTarget = bar;
      updateContent(bar, tooltip);
    }

    const barRect = bar.getBoundingClientRect();
    const gridRect = grid.getBoundingClientRect();
    crosshair.style.left =
      barRect.left - gridRect.left + barRect.width / 2 + "px";
    crosshair.dataset.visible = "";

    const containerRect = chartsContainer.getBoundingClientRect();
    let x = event.clientX - containerRect.left + 16;
    let y = event.clientY - containerRect.top - 16;

    const tooltipRect = tooltip.getBoundingClientRect();
    if (x + tooltipRect.width > containerRect.width) {
      x = event.clientX - containerRect.left - tooltipRect.width - 16;
    }
    if (y < 0) {
      y = event.clientY - containerRect.top + 24;
    }

    tooltip.style.left = x + "px";
    tooltip.style.top = y + "px";
    tooltip.dataset.visible = "";
  });

  grid.addEventListener("mouseleave", () => {
    delete tooltip.dataset.visible;
    delete crosshair.dataset.visible;
    currentTarget = null;
  });
}

setupChartTooltip(
  document.querySelector("[data-score-chart]"),
  document.querySelector('[data-chart-tooltip="score"]'),
  (bar, tip) => {
    tip.querySelector<HTMLElement>("[data-chart-tooltip-week]")!.textContent =
      bar.getAttribute("data-tooltip-week");
    tip.querySelector<HTMLElement>("[data-chart-tooltip-score]")!.textContent =
      "Score: " + bar.getAttribute("data-tooltip-score");
    const img = tip.querySelector<HTMLImageElement>(
      "[data-chart-tooltip-image]",
    )!;
    img.src = bar.getAttribute("data-tooltip-image")!;
    img.alt = "Score " + bar.getAttribute("data-tooltip-score");
  },
);

setupChartTooltip(
  document.querySelector("[data-change-chart]"),
  document.querySelector('[data-chart-tooltip="change"]'),
  (bar, tip) => {
    tip.querySelector<HTMLElement>("[data-chart-tooltip-week]")!.textContent =
      bar.getAttribute("data-tooltip-week");
    tip.querySelector<HTMLElement>("[data-chart-tooltip-change]")!.textContent =
      "Change: " + bar.getAttribute("data-tooltip-change");
  },
);

// --- Marker overflow ---

function updateMarkerVisibility() {
  const segments = document.querySelectorAll<HTMLElement>(
    "[data-marker-segment]",
  );
  for (const segment of segments) {
    const label = segment.querySelector<HTMLElement>("[data-marker-label]");
    if (!label) {
      continue;
    }
    delete label.dataset.hidden;
    if (label.offsetWidth > segment.offsetWidth) {
      label.dataset.hidden = "";
    }
  }
}

updateMarkerVisibility();
window.addEventListener("resize", updateMarkerVisibility);

/* eslint-disable */
(function () {
  "use strict";

  var chartsContainer = document.querySelector("[data-history-charts]");

  function setupChartTooltip(grid, tooltip, updateContent) {
    if (!grid || !tooltip || !chartsContainer) {
      return;
    }

    var crosshair = document.createElement("div");
    crosshair.setAttribute("data-crosshair", "");
    grid.appendChild(crosshair);

    var currentTarget = null;

    grid.addEventListener("mousemove", function (event) {
      var bar = event.target.closest("[data-tooltip-week]");
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

      var barRect = bar.getBoundingClientRect();
      var gridRect = grid.getBoundingClientRect();
      crosshair.style.left =
        barRect.left - gridRect.left + barRect.width / 2 + "px";
      crosshair.dataset.visible = "";

      var containerRect = chartsContainer.getBoundingClientRect();
      var x = event.clientX - containerRect.left + 16;
      var y = event.clientY - containerRect.top - 16;

      var tooltipRect = tooltip.getBoundingClientRect();
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

    grid.addEventListener("mouseleave", function () {
      delete tooltip.dataset.visible;
      delete crosshair.dataset.visible;
      currentTarget = null;
    });
  }

  setupChartTooltip(
    document.querySelector("[data-score-chart]"),
    document.querySelector('[data-chart-tooltip="score"]'),
    function (bar, tip) {
      tip.querySelector("[data-chart-tooltip-week]").textContent =
        bar.getAttribute("data-tooltip-week");
      tip.querySelector("[data-chart-tooltip-score]").textContent =
        "Score: " + bar.getAttribute("data-tooltip-score");
      var img = tip.querySelector("[data-chart-tooltip-image]");
      img.src = bar.getAttribute("data-tooltip-image");
      img.alt = "Score " + bar.getAttribute("data-tooltip-score");
    },
  );

  setupChartTooltip(
    document.querySelector("[data-change-chart]"),
    document.querySelector('[data-chart-tooltip="change"]'),
    function (bar, tip) {
      tip.querySelector("[data-chart-tooltip-week]").textContent =
        bar.getAttribute("data-tooltip-week");
      tip.querySelector("[data-chart-tooltip-change]").textContent =
        "Change: " + bar.getAttribute("data-tooltip-change");
    },
  );

  // --- Marker overflow ---

  function updateMarkerVisibility() {
    var segments = document.querySelectorAll("[data-marker-segment]");
    for (var i = 0; i < segments.length; i++) {
      var segment = segments[i];
      var label = segment.querySelector("[data-marker-label]");
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
})();

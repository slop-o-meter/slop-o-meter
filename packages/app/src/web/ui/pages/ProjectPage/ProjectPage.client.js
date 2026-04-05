/* eslint-disable */
(function () {
  "use strict";

  var phaseLabels = {
    CloningRepo: "Cloning the repo",
    InspectingSuspiciousCommits: "Inspecting suspicious commits",
    MeasuringSlopScore: "Measuring slop score",
    InterpretingResults: "Commenting results",
  };

  var projectPage = document.querySelector("[data-project-page]");
  if (projectPage) {
    var owner = projectPage.getAttribute("data-owner");
    var repo = projectPage.getAttribute("data-repo");

    document.addEventListener("click", function (event) {
      var button = event.target.closest("[data-action=measure]");
      if (!button) {
        return;
      }
      event.preventDefault();
      button.disabled = true;
      fetch("/api/measure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner: owner, repo: repo }),
      }).then(function () {
        showRunningView(projectPage);
        startPolling(owner, repo);
      });
    });

    // --- Polling ---

    var runningElement = document.querySelector(
      "[data-measurement-status=Running]",
    );
    if (runningElement) {
      startPolling(owner, repo);
    }
  }

  function showRunningView(container) {
    container.innerHTML =
      '<div data-measurement-status="Running" style="display:flex;flex-direction:column;align-items:center">' +
      '<video style="width:80px;height:auto;margin-bottom:1.5rem" src="/spinner.webm" autoplay loop muted playsinline></video>' +
      '<p data-phase-text style="font-family:var(--mono);font-size:1.5rem;color:var(--mustard);margin-bottom:0.25rem;text-align:center">The measurement will start shortly</p>' +
      '<p data-phase-sub-text style="font-family:var(--mono);font-size:1rem;color:var(--brown-light);margin-bottom:1rem;min-height:1.4em;text-align:center"></p>' +
      "</div>";
  }

  function startPolling(owner, repo) {
    var pollInterval = setInterval(function () {
      fetch(
        "/api/project/" +
          encodeURIComponent(owner) +
          "/" +
          encodeURIComponent(repo),
      )
        .then(function (response) {
          return response.json();
        })
        .then(function (data) {
          if (!data.found) {
            return;
          }
          var project = data.project;
          if (project.measurementStatus !== "Running") {
            clearInterval(pollInterval);
            window.location.reload();
            return;
          }
          var phaseText = document.querySelector("[data-phase-text]");
          var phaseSubText = document.querySelector("[data-phase-sub-text]");
          if (phaseText && project.measurementPhase) {
            phaseText.textContent =
              phaseLabels[project.measurementPhase] || "Working";
          }
          if (phaseSubText) {
            var subText = "";
            if (
              project.measurementPhase === "CloningRepo" &&
              project.isLargeRepo
            ) {
              subText = "(big one, might take a while)";
            } else if (project.measurementPhaseProgress) {
              subText =
                "(" +
                project.measurementPhaseProgress.current +
                " of " +
                project.measurementPhaseProgress.total +
                ")";
            }
            phaseSubText.textContent = subText;
          }
        });
    }, 3000);
  }
})();

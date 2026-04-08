const phaseLabels: Record<string, string> = {
  CloningRepo: "Cloning the repo",
  InspectingSuspiciousCommits: "Inspecting suspicious commits",
  MeasuringSlopScore: "Measuring slop score",
  InterpretingResults: "Commenting results",
};

const projectPage = document.querySelector<HTMLElement>("[data-project-page]");
if (projectPage) {
  const owner = projectPage.getAttribute("data-owner")!;
  const repo = projectPage.getAttribute("data-repo")!;

  document.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
      "[data-action=measure]",
    );
    if (!button) {
      return;
    }
    event.preventDefault();
    button.disabled = true;
    fetch("/api/measure", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ owner, repo }),
    }).then(() => {
      showRunningView(projectPage);
      startPolling(owner, repo);
    });
  });

  const runningElement = document.querySelector(
    "[data-measurement-status=Running]",
  );
  if (runningElement) {
    startPolling(owner, repo);
  }
}

function showRunningView(container: HTMLElement) {
  container.innerHTML =
    '<div data-measurement-status="Running" style="display:flex;flex-direction:column;align-items:center">' +
    '<video style="width:80px;height:auto;margin-bottom:1.5rem" src="/spinner.webm" autoplay loop muted playsinline></video>' +
    '<p data-phase-text style="font-family:var(--mono);font-size:1.5rem;color:var(--mustard);margin-bottom:0.25rem;text-align:center">The measurement will start shortly</p>' +
    '<p data-phase-sub-text style="font-family:var(--mono);font-size:1rem;color:var(--brown-light);margin-bottom:1rem;min-height:1.4em;text-align:center"></p>' +
    "</div>";
}

function startPolling(owner: string, repo: string) {
  const pollInterval = setInterval(() => {
    fetch(
      "/api/project/" +
        encodeURIComponent(owner) +
        "/" +
        encodeURIComponent(repo),
    )
      .then((response) => response.json())
      .then((data) => {
        if (!data.found) {
          return;
        }
        const project = data.project;
        if (project.measurementStatus !== "Running") {
          clearInterval(pollInterval);
          window.location.reload();
          return;
        }
        const phaseText =
          document.querySelector<HTMLElement>("[data-phase-text]");
        const phaseSubText = document.querySelector<HTMLElement>(
          "[data-phase-sub-text]",
        );
        if (phaseText && project.measurementPhase) {
          phaseText.textContent =
            phaseLabels[project.measurementPhase] || "Working";
        }
        if (phaseSubText) {
          let subText = "";
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

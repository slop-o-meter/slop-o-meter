import { DateTime } from "luxon";
import type { Project } from "../../../../types.js";
import componentAsset from "../../componentAsset.js";
import HistoryCharts from "../../components/HistoryCharts/HistoryCharts.js";
import ProjectCard from "../../components/ProjectCard/ProjectCard.js";
import { scoreToDisplay, scoreToLevel } from "../../utils/scoring.js";
import {
  actionButtonClass,
  backLinkClass,
  githubLinkClass,
  measurementViewCardSectionClass,
  measurementViewChartsSectionClass,
  measurementViewClass,
  disclaimerClass,
  errorViewClass,
  errorViewStatusClass,
  notMeasuredCommentClass,
  notMeasuredViewClass,
  projectPageClass,
  runningViewClass,
  runningViewSpinnerClass,
  runningViewStatusClass,
  runningViewSubTextClass,
} from "./ProjectPage.styles.js";

interface Props {
  owner: string;
  repo: string;
  project: Project | null;
}

export default function ProjectPage({ owner, repo, project }: Props) {
  return (
    <>
      <div
        class={projectPageClass}
        data-project-page
        data-owner={owner}
        data-repo={repo}
      >
        <a href="/" class={backLinkClass}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Home
        </a>
        {!project ? (
          <NotMeasuredView />
        ) : project.measurementStatus === "Running" && !project.measurement ? (
          <RunningView project={project} />
        ) : project.measurementStatus === "Error" && !project.measurement ? (
          <ErrorView errorReason={project.errorReason} />
        ) : project.measurement ? (
          <MeasurementView project={project} />
        ) : null}
      </div>
      <script src={componentAsset("ProjectPage.client.js")} defer />
    </>
  );
}

function NotMeasuredView() {
  return (
    <div class={notMeasuredViewClass}>
      <p class={notMeasuredCommentClass}>
        This project's slop hasn't been measured yet.
      </p>
      <button class={actionButtonClass} type="button" data-action="measure">
        Measure
      </button>
    </div>
  );
}

function RunningView({ project }: { project: Project }) {
  const { measurementPhase, isLargeRepo, measurementPhaseProgress } = project;

  const phaseLabels: Record<string, string> = {
    CloningRepo: "Cloning the repo",
    InspectingSuspiciousCommits: "Inspecting suspicious commits",
    MeasuringSlopScore: "Measuring slop score",
    InterpretingResults: "Commenting results",
  };

  const label = measurementPhase
    ? (phaseLabels[measurementPhase] ?? "Working")
    : "The measurement will start shortly";

  function buildSubText(): string {
    if (measurementPhase === "CloningRepo" && isLargeRepo) {
      return "big one, might take a while";
    }
    if (measurementPhaseProgress) {
      return `${measurementPhaseProgress.current} of ${measurementPhaseProgress.total}`;
    }
    return "";
  }

  return (
    <div
      class={runningViewClass}
      data-measurement-status="Running"
      data-measurement-phase={measurementPhase ?? ""}
      data-is-large-repo={isLargeRepo ? "true" : ""}
      data-phase-progress-current={
        measurementPhaseProgress?.current?.toString() ?? ""
      }
      data-phase-progress-total={
        measurementPhaseProgress?.total?.toString() ?? ""
      }
    >
      <video
        class={runningViewSpinnerClass}
        src="/spinner.webm"
        autoplay
        loop
        muted
        playsinline
      />
      <p class={runningViewStatusClass} data-phase-text>
        {label}
      </p>
      <p class={runningViewSubTextClass} data-phase-sub-text>
        {buildSubText()}
      </p>
    </div>
  );
}

function ErrorView({ errorReason }: { errorReason: string | null }) {
  return (
    <div class={errorViewClass}>
      <p class={errorViewStatusClass}>
        {errorReason ? `${errorReason}.` : "Measurement failed."}
      </p>
      <button class={actionButtonClass} type="button" data-action="measure">
        Retry
      </button>
    </div>
  );
}

function canRemeasure(lastMeasuredAt: string | null): boolean {
  if (!lastMeasuredAt) {
    return true;
  }
  return !DateTime.fromISO(lastMeasuredAt).hasSame(DateTime.utc(), "week");
}

function MeasurementView({ project }: { project: Project }) {
  const measurement = project.measurement!;
  const level = scoreToLevel(measurement.currentScore);
  const displayScore = scoreToDisplay(measurement.currentScore);

  return (
    <>
      <div class={measurementViewClass}>
        <div class={measurementViewCardSectionClass}>
          <ProjectCard
            repo={`${project.owner}/${project.repo}`}
            level={level}
            score={displayScore.toFixed(1)}
            comment={measurement.comment}
            width={460}
          />
          {canRemeasure(project.lastMeasuredAt) ? (
            <button
              class={actionButtonClass}
              type="button"
              data-action="measure"
            >
              Measure again
            </button>
          ) : null}
          <GitHubLink owner={project.owner} repo={project.repo} />
        </div>

        {measurement.history.length > 0 ? (
          <div class={measurementViewChartsSectionClass}>
            <HistoryCharts history={measurement.history} />
          </div>
        ) : null}
      </div>
      <p class={disclaimerClass}>
        This score is the result of a naïve algorithm measuring indirect
        signals. Take it with a large grain of salt.
      </p>
    </>
  );
}

function GitHubLink({ owner, repo }: { owner: string; repo: string }) {
  return (
    <a
      href={`https://github.com/${owner}/${repo}`}
      class={githubLinkClass}
      target="_blank"
      rel="noopener noreferrer"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
      </svg>
      View repo
    </a>
  );
}

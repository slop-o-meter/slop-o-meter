import componentAsset from "../../componentAsset.js";
import Spinner from "../Spinner/Spinner.js";
import {
  tunableParamsBodyClass,
  tunableParamsDescriptionClass,
  tunableParamsGroupClass,
  tunableParamsHeaderClass,
  tunableParamsInfoClass,
  tunableParamsInfoTooltipClass,
  tunableParamsLabelClass,
  tunableParamsLabelRowClass,
  tunableParamsPanelClass,
  tunableParamsResetClass,
  tunableParamsScrollClass,
  tunableParamsSelectClass,
  tunableParamsSliderClass,
  tunableParamsSliderRowClass,
  tunableParamsSpinnerClass,
  tunableParamsSpinnerLabelClass,
  tunableParamsToggleClass,
  tunableParamsToggleIconClass,
  tunableParamsValueClass,
} from "./TunableParams.styles.js";

interface Props {
  owner: string;
  repo: string;
}

export default function TunableParams({ owner, repo }: Props) {
  return (
    <>
      <div class={tunableParamsInfoTooltipClass} data-tunable-tooltip />

      <div class={tunableParamsPanelClass} data-tunable-panel>
        <button
          class={tunableParamsToggleClass}
          data-tunable-toggle
          title="Tune Algorithm Params"
          aria-label="Toggle tunable parameters"
        >
          <svg
            class={tunableParamsToggleIconClass}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 256 256"
          >
            <path
              fill="currentColor"
              d="M40,88H73a32,32,0,0,0,62,0h81a8,8,0,0,0,0-16H135a32,32,0,0,0-62,0H40a8,8,0,0,0,0,16Zm64-24A16,16,0,1,1,88,80,16,16,0,0,1,104,64ZM216,168H199a32,32,0,0,0-62,0H40a8,8,0,0,0,0,16h97a32,32,0,0,0,62,0h17a8,8,0,0,0,0-16Zm-48,24a16,16,0,1,1,16-16A16,16,0,0,1,168,192Z"
            />
          </svg>
        </button>

        <div class={tunableParamsScrollClass}>
          <div class={tunableParamsHeaderClass}>
            <span data-tunable-title>Tune Algorithm Params</span>
            <span class={tunableParamsDescriptionClass}>
              Adjust the scoring parameters and see how they affect the result.
              See the{" "}
              <a
                href="https://github.com/slop-o-meter/slop-o-meter/blob/main/docs/slop-score-algorithm.md"
                target="_blank"
                rel="noopener noreferrer"
              >
                algorithm spec
              </a>{" "}
              for details.
            </span>
          </div>

          <div class={tunableParamsSpinnerClass} data-tunable-spinner>
            <Spinner />
            <span class={tunableParamsSpinnerLabelClass}>
              Loading measurement data
            </span>
          </div>

          <div class={tunableParamsBodyClass} data-tunable-body hidden>
            <SliderParam
              label="Human output (lines/hour)"
              tooltip="How many lines of code a human developer is expected to write per hour. Higher = more forgiving score."
              param="humanLinesPerHour"
              min={10}
              max={100}
              step={5}
              defaultValue={40}
            />

            <SliderParam
              label="Full-credit hours per week"
              tooltip="Weekly hours that count at full value. Beyond this, diminishing returns kick in."
              param="fullCreditHoursPerWeek"
              min={10}
              max={80}
              step={5}
              defaultValue={40}
            />
            <SliderParam
              label="Max hours per week"
              tooltip="Hard ceiling on credited hours per contributor per week. Extra hours beyond this are ignored entirely."
              param="maxHoursPerWeek"
              min={40}
              max={160}
              step={10}
              defaultValue={80}
            />
            <div class={tunableParamsGroupClass}>
              <div class={tunableParamsLabelRowClass}>
                <label class={tunableParamsLabelClass} htmlFor="overtime-curve">
                  Overtime discount curve
                </label>
                <InfoTip text="Shape of the diminishing returns between full-credit hours and max hours." />
              </div>
              <select
                id="overtime-curve"
                class={tunableParamsSelectClass}
                data-tunable-param="overtimeCurve"
              >
                <option value="concave" selected>
                  Concave (default)
                </option>
                <option value="linear-ramp">Linear ramp</option>
                <option value="cosine">Cosine</option>
              </select>
            </div>

            <SliderParam
              label="Min commits for credit"
              tooltip="New contributors need at least this many commits before their time counts toward the score."
              param="minCommitsForCredit"
              min={0}
              max={50}
              step={5}
              defaultValue={10}
            />
            <SliderParam
              label="Commits for full credit"
              tooltip="Contributors with this many commits are treated as full core members and get maximum time credit."
              param="commitsForFullCredit"
              min={10}
              max={200}
              step={10}
              defaultValue={60}
            />

            <SliderParam
              label="Small repo threshold (lines)"
              tooltip="Repos smaller than this get a reduced score. Prevents tiny projects from scoring unfairly high."
              param="smallRepoThreshold"
              min={1000}
              max={20000}
              step={1000}
              defaultValue={5000}
            />
            <SliderParam
              label="Large repo complexity bonus"
              tooltip="Extra attention cost applied to larger codebases, reflecting that big repos are harder to review."
              param="largeRepoComplexityBonus"
              min={0}
              max={0.2}
              step={0.01}
              defaultValue={0.05}
            />

            <button class={tunableParamsResetClass} data-tunable-reset>
              Reset defaults
            </button>
          </div>
        </div>
      </div>

      <script
        type="module"
        src={componentAsset("TunableParams.client.ts")}
        data-owner={owner}
        data-repo={repo}
      />
    </>
  );
}

function SliderParam({
  label,
  tooltip,
  param,
  min,
  max,
  step,
  defaultValue,
}: {
  label: string;
  tooltip: string;
  param: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
}) {
  return (
    <div class={tunableParamsGroupClass}>
      <div class={tunableParamsLabelRowClass}>
        <label class={tunableParamsLabelClass} htmlFor={param}>
          {label}
        </label>
        <InfoTip text={tooltip} />
      </div>
      <div class={tunableParamsSliderRowClass}>
        <input
          id={param}
          class={tunableParamsSliderClass}
          type="range"
          min={String(min)}
          max={String(max)}
          step={String(step)}
          value={String(defaultValue)}
          data-tunable-param={param}
        />
        <span class={tunableParamsValueClass} data-tunable-value={param}>
          {String(defaultValue)}
        </span>
      </div>
    </div>
  );
}

function InfoTip({ text }: { text: string }) {
  return (
    <span class={tunableParamsInfoClass} data-info-tip={text}>
      ?
    </span>
  );
}

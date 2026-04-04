import type { Project } from "../../../../types.js";
import componentAsset from "../../componentAsset.js";
import Footer from "../../components/Footer/Footer.js";
import ProjectCard from "../../components/ProjectCard/ProjectCard.js";
import SlopScale from "../../components/SlopScale/SlopScale.js";
import { scoreToDisplay, scoreToLevel } from "../../utils/scoring.js";
import {
  gridClass,
  heroBackgroundClass,
  heroClass,
  heroContentClass,
  heroGroupClass,
  heroHeadlineClass,
  heroHeadlineUnderlineClass,
  heroSubtextClass,
  heroSubtextSmallClass,
  searchButtonClass,
  searchFormClass,
  searchInputClass,
  sectionClass,
  sectionHeaderClass,
  sectionTextClass,
} from "./HomePage.styles.js";

interface Props {
  highlightedProjects: Project[];
}

export default function HomePage({ highlightedProjects }: Props) {
  return (
    <>
      <section class={heroClass}>
        <div class={heroBackgroundClass}>
          <SlopScale variant="background" />
        </div>
        <div class={heroContentClass}>
          <div class={heroGroupClass}>
            <h1 class={heroHeadlineClass}>
              Can We Measure
              <br />
              Software <span class={heroHeadlineUnderlineClass}>Slop</span>?
            </h1>
            <p class={heroSubtextClass}>
              An experiment
              <br />
              <span class={heroSubtextSmallClass}>
                (with questionable results)
              </span>
            </p>
            <form class={searchFormClass} data-search-form>
              <input
                class={searchInputClass}
                type="text"
                name="query"
                placeholder="github.com/owner/repo"
              />
              <button class={searchButtonClass} type="submit">
                Measure
              </button>
            </form>
          </div>
          {highlightedProjects.length > 0 ? (
            <>
              <div class={gridClass}>
                {highlightedProjects.map((project, index) => {
                  const currentScore = project.measurement?.currentScore ?? 0;
                  const level = scoreToLevel(currentScore);
                  const displayScore = scoreToDisplay(currentScore);
                  const rotations = [-2, 1.5, -1, 2.5, -1.5];
                  const rotation = rotations[index % rotations.length];
                  return (
                    <div style={`transform: rotate(${String(rotation)}deg)`}>
                      <ProjectCard
                        repo={`${project.owner}/${project.repo}`}
                        url={`/${project.owner}/${project.repo}`}
                        level={level}
                        score={displayScore.toFixed(1)}
                        comment={project.measurement?.comment ?? ""}
                      />
                    </div>
                  );
                })}
              </div>
            </>
          ) : null}
        </div>
      </section>

      <section class={sectionClass}>
        <h2 class={sectionHeaderClass}>The Idea</h2>
        <p class={sectionTextClass}>
          Slop is all about <strong>human attention</strong>. LLM-generated code
          is slop when no person owns it, understands it, and has verified it
          works.
        </p>
        <p class={sectionTextClass}>
          If we can quantify how much attention a given piece of software needs
          (<strong>attention cost</strong>), and measure how much attention it
          received (<strong>attention spent</strong>), we can calculate how
          "sloppy" it is.
        </p>
      </section>

      <section class={sectionClass}>
        <h2 class={sectionHeaderClass}>The Scale</h2>
        <SlopScale variant="detailed" />
      </section>

      <section class={sectionClass}>
        <h2 class={sectionHeaderClass}>The Algorithm</h2>
        <p class={sectionTextClass}>
          We use a project's git history and GitHub activity to estimate the two
          attention quantities above. For cost, we look at the codebase
          historical size. For attention, we look at "signals of human
          interaction" like commits and PR comments.
        </p>
        <p class={sectionTextClass}>
          A week-by-week slop score is then calculated from the estimates.
        </p>
        <p class={sectionTextClass}>
          Weeks that see significant amounts of code added, with
          disproportionately little human activity, increase the sloppiness of
          the project. Weeks with high human activity and few (or negative) code
          additions reduce it.
        </p>
      </section>

      <section class={sectionClass}>
        <h2 class={sectionHeaderClass}>The Results</h2>
        <p class={sectionTextClass}>Unreliable, unfortunately.</p>
        <p class={sectionTextClass}>
          For many repos they're plausible, but for just as many they're clearly
          incorrect.
        </p>
        <p class={sectionTextClass}>
          Accuracy depends heavily on having enough human interaction signals: a
          feature developed behind closed doors and then code-dropped comes with
          very few signals attached, so to the algorithm it looks
          indistinguishable from a one-shot run by a coding agent.
        </p>
        <p class={sectionTextClass}>
          Other factors can also throw off the estimates. For example,
          vendored-in dependencies kept in non-standard folders and large code
          files for configurations or demo data.
        </p>
        <p class={sectionTextClass}>
          The algorithm tries to account for some of these exceptions, but it
          seems that, ultimately, the two measures we're using are just too
          indirect.
        </p>
      </section>

      <section class={sectionClass}>
        <h2 class={sectionHeaderClass}>
          Can <em>You</em> Make a Better Algorithm?
        </h2>
        <p class={sectionTextClass}>
          <a href="https://github.com/slop-o-meter/slop-o-meter">
            Hop over to GitHub
          </a>
          , open a PR, and you'll get (pending approval) a preview environment
          where you can test your theories.
        </p>
      </section>

      <Footer />

      <script src={componentAsset("HomePage.client.js")} defer />
    </>
  );
}

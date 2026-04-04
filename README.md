<p align="center">
  <img src="docs/media/banner.avif" alt="Can We Measure Software Slop?" width="100%" />
</p>

An experiment with questionable results.

## The Idea

Slop is all about **human attention**. LLM-generated code is slop when no person
owns it, understands it, and has verified it works.

If we can quantify how much attention a given piece of software needs
(**attention cost**), and measure how much attention it received (**attention
spent**), we can calculate how "sloppy" it is.

## The Scale

| Score |                                                                                         | Name                    | Description                       |
| :---: | :-------------------------------------------------------------------------------------: | ----------------------- | --------------------------------- |
|   1   |    <img src="docs/media/1.buttered-noodles.png" alt="Buttered Noodles" width="64" />    | **Buttered Noodles**    | Slop? Too dated to have any.      |
|   2   | <img src="docs/media/2.spaghetti-bolognese.png" alt="Spaghetti Bolognese" width="64" /> | **Spaghetti Bolognese** | A little sauce never hurt.        |
|   3   |             <img src="docs/media/3.lasagna.png" alt="Lasagna" width="64" />             | **Lasagna**             | Lots of slop, but with structure. |
|   4   |          <img src="docs/media/4.sloppy-joe.png" alt="Sloppy Joe" width="64" />          | **Sloppy Joe**          | Containment is just pretense.     |
|   5   |       <img src="docs/media/5.just-the-slop.png" alt="Just The Slop" width="64" />       | **Just The Slop**       | Pure. Proud. Let it flow.         |

## The Algorithm

We use a project's git history and GitHub activity to estimate the two attention
quantities above. For cost, we look at the codebase historical size. For
attention, we look at "signals of human interaction" like commits and PR
comments.

A week-by-week slop score is then calculated from the estimates.

Weeks that see significant amounts of code added, with disproportionately little
human activity, increase the sloppiness of the project. Weeks with high human
activity and few (or negative) code additions reduce it.

## The Results

Unreliable, unfortunately.

For many repos they're plausible, but for just as many they're clearly
incorrect.

Accuracy depends heavily on having enough human interaction signals: a feature
developed behind closed doors and then code-dropped comes with very few signals
attached, so to the algorithm it looks indistinguishable from a one-shot run by
a coding agent.

Other factors can also throw off the estimates. For example, vendored-in
dependencies kept in non-standard folders and large code files for
configurations or demo data.

The algorithm tries to account for some of these exceptions, but it seems that,
ultimately, the two measures we're using are just too indirect.

## How Would _You_ Measure Slop?

Wanna take a stab at a better algorithm? Open a PR, and you'll get (pending
approval) a preview environment where you can test your theories.

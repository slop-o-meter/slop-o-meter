const HIGHLIGHTED_PROJECTS = [
  { owner: "facebook", repo: "react" },
  { owner: "denoland", repo: "deno" },
  { owner: "openclaw", repo: "openclaw" },
  { owner: "superegodev", repo: "superego" },
  { owner: "pingdotgg", repo: "t3code" },
  { owner: "sveltejs", repo: "svelte" },
  { owner: "tailwindlabs", repo: "tailwindcss" },
  { owner: "expressjs", repo: "express" },
  { owner: "vuejs", repo: "core" },
] as const;

export function isHighlightedProject(owner: string, repo: string): boolean {
  return HIGHLIGHTED_PROJECTS.some(
    (project) => project.owner === owner && project.repo === repo,
  );
}

export default HIGHLIGHTED_PROJECTS;

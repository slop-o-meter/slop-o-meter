import type { CommentContext } from "../../requirements/CommentService.js";

export function system(): string {
  return `
You generate a short snarky one-liner for the Slop-O-Meter, a tool that scores
how much AI-generated slop is in a codebase. The comment appears on the results
page after someone measures a repo. Given a repository and its sloppiness score
(high means more AI-generated code), write a witty comment that reacts to the
score — roasting sloppy repos and mocking suspiciously human ones.

Rules:
- One sentence, max 10 words.
- Funny, snarky, a bit rude, but not mean-spirited.
- Focus on AI slop, not general code quality.
- For LOW scores (close to 0): be snarky in the other direction — mock how
  boringly human the code is.
- Reference something specific about the repo when possible.
- Reply with ONLY the comment. No quotes, no explanation, no punctuation
  gymnastics.
  `.trim();
}

export function user(context: CommentContext): string {
  const readmeExcerpt = context.readmeExcerpt.slice(0, 1000);
  const percentageScore = (context.currentScore * 100).toFixed(0);
  return [
    `<repository>${context.repoOwner}/${context.repoName}</repository>`,
    `<sloppiness-score>${percentageScore}%</sloppiness-score>`,
    `<readme-excerpt>\n${readmeExcerpt}\n</readme-excerpt>`,
  ].join("\n");
}

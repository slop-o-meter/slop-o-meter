import { css } from "hono/css";

export const footerClass = css`
  padding: 3rem;
  text-align: center;
  background: var(--brown);
  color: var(--sand);
`;

export const footerCreditsClass = css`
  font-family: var(--mono);
  font-size: 0.8rem;
  color: var(--brown-mid);

  a {
    color: inherit;
  }
`;

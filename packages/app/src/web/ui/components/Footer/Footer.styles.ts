import { css } from "hono/css";

export const footerClass = css`
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 6rem 3rem 2rem;
  text-align: center;
`;

export const footerTextClass = css`
  font-family: var(--mono);
  font-size: 0.75rem;
  color: var(--brown-mid);

  a {
    color: inherit;
  }
`;

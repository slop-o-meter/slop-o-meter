import { css, keyframes } from "hono/css";

const spin = keyframes`
  to {
    transform: rotate(360deg);
  }
`;

export const spinnerClass = css`
  width: 40px;
  height: 40px;
  border: 4px solid var(--brown-light);
  border-top-color: var(--brown);
  border-radius: 50%;
  animation: ${spin} 0.7s linear infinite;
`;

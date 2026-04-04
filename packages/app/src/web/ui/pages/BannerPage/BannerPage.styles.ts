import { css } from "hono/css";

export const bannerClass = css`
  position: relative;
  width: 1000px;
  height: 500px;
  background: var(--page-bg);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
  overflow: hidden;
  border-radius: 12px;
`;

export const bannerBackgroundClass = css`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  opacity: 0.04;
  overflow: hidden;
`;

export const bannerContentClass = css`
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
`;

export const logoClass = css`
  height: 280px;
  width: auto;
  filter: drop-shadow(4px 4px 6px rgba(58, 40, 32, 0.4));
`;

export const headlineClass = css`
  font-family: var(--display);
  font-weight: 800;
  font-size: 3rem;
  line-height: 1.2;
  text-transform: uppercase;
  color: var(--brown);
  text-align: center;
`;

export const headlineUnderlineClass = css`
  color: var(--ragu);
  text-decoration: underline wavy var(--ragu);
  text-underline-offset: 0.15em;
`;

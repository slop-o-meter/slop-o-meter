import { css, keyframes } from "hono/css";

const dotsAnimation = keyframes`
  0% {
    content: "";
  }
  25% {
    content: ".";
  }
  50% {
    content: "..";
  }
  75% {
    content: "...";
  }
`;

export const projectPageClass = css`
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4rem 2rem;
  @media (max-width: 600px) {
    padding: 2rem 1.5rem;
  }
  @media (min-width: 1100px) {
    padding: 4rem 3rem;
    max-width: 1440px;
    margin: 0 auto;
    width: 100%;
    justify-content: center;
  }
`;

export const notMeasuredViewClass = css`
  display: contents;
`;

export const notMeasuredCommentClass = css`
  font-family: var(--mono);
  font-size: 0.85rem;
  line-height: 1.6;
  color: var(--brown-mid);
  max-width: 480px;
  margin: 0 auto 2rem;
`;

export const runningViewClass = css`
  display: flex;
  flex-direction: column;
  align-items: center;
`;

export const runningViewSpinnerClass = css`
  width: 80px;
  height: auto;
  margin-bottom: 1.5rem;
`;

export const runningViewStatusClass = css`
  font-family: var(--mono);
  font-size: 1.5rem;
  color: var(--mustard);
  margin-bottom: 0.25rem;
  text-align: center;
  position: relative;

  &::after {
    content: "";
    position: absolute;
    left: 100%;
    animation: ${dotsAnimation} 4s steps(1, end) infinite;
  }
`;

export const runningViewSubTextClass = css`
  font-family: var(--mono);
  font-size: 1rem;
  color: var(--brown-mid);
  margin-bottom: 1rem;
  min-height: 1.4em;
  text-align: center;
`;

export const errorViewClass = css`
  display: contents;
`;

export const errorViewStatusClass = css`
  font-family: var(--mono);
  font-size: 0.85rem;
  color: var(--level-5);
  margin-bottom: 1rem;
`;

export const backLinkClass = css`
  align-self: flex-start;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-family: var(--mono);
  font-size: 1rem;
  color: var(--brown-mid);
  text-decoration: none;
  margin-bottom: 2rem;
  &:hover {
    color: var(--brown);
  }
`;

export const githubLinkClass = css`
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-family: var(--mono);
  font-size: 0.85rem;
  color: var(--brown-mid);
  text-decoration: none;
  margin-top: 1rem;
  &:hover {
    color: var(--brown);
  }
`;

export const measurementViewClass = css`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  @media (min-width: 1100px) {
    flex-direction: row;
    align-items: center;
    justify-content: center;
    gap: 3rem;
  }
`;

export const measurementViewCardSectionClass = css`
  display: flex;
  flex-direction: column;
  align-items: center;
  @media (min-width: 1100px) {
    flex-shrink: 0;
  }
`;

export const disclaimerClass = css`
  font-family: var(--mono);
  font-size: 0.85rem;
  line-height: 1.6;
  color: var(--brown-mid);
  text-align: center;
  max-width: 50%;
  margin-top: 3rem;
  @media (max-width: 600px) {
    max-width: 100%;
  }
`;

export const actionButtonClass = css`
  background: var(--brown);
  color: var(--cream);
  border: var(--border-thick);
  padding: 0.75rem 2rem;
  font-family: var(--mono);
  font-weight: 700;
  font-size: 0.85rem;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  border-radius: 60px;
  box-shadow: var(--shadow);
  margin-top: 1rem;
  &:hover {
    background: #4a3830;
  }
  &:active {
    transform: translate(1px, 1px);
  }
`;

export const measurementViewChartsSectionClass = css`
  margin-top: 2rem;
  width: 100%;
  max-width: 912px;
  @media (min-width: 1100px) {
    margin-top: 0;
    flex: 1;
    min-width: 0;
  }
`;

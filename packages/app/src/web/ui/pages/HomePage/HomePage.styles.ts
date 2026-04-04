import { css } from "hono/css";

export const heroClass = css`
  position: relative;
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  overflow: hidden;
  @media (max-width: 600px) {
    padding: 3rem 1.5rem;
    min-height: auto;
  }
`;

export const heroBackgroundClass = css`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: start;
  padding-top: 10vh;
  justify-content: center;
  pointer-events: none;
  opacity: 0.04;
  overflow: hidden;
`;

export const heroContentClass = css`
  position: relative;
  z-index: 1;
  text-align: center;
  max-width: 1200px;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: space-between;
  gap: 2rem;
  min-height: calc(100dvh - 8rem);
  @media (max-width: 600px) {
    min-height: auto;
    gap: 2rem;
  }
`;

export const heroGroupClass = css`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3rem;
`;

export const heroHeadlineClass = css`
  font-family: var(--display);
  font-weight: 800;
  font-size: clamp(3.5rem, 10vw, 5.5rem);
  line-height: 1.2;
  text-transform: uppercase;
  color: var(--brown);
  @media (max-width: 600px) {
    font-size: clamp(2.5rem, 9.5vw, 5.7rem);
  }
`;

export const heroHeadlineUnderlineClass = css`
  color: var(--ragu);
  text-decoration: underline wavy var(--ragu);
  text-underline-offset: 0.15em;
`;

export const heroSubtextClass = css`
  font-family: var(--mono);
  font-size: 1.8rem;
  color: var(--brown);
  margin-top: -1rem;
  margin-bottom: 0;
  & a {
    color: var(--ragu);
    text-decoration: underline;
  }
  @media (max-width: 600px) {
    font-size: 1.6rem;
  }
`;

export const heroSubtextSmallClass = css`
  font-size: 1.25rem;
  @media (max-width: 600px) {
    font-size: 1rem;
  }
`;

export const searchFormClass = css`
  display: flex;
  width: 100%;
  max-width: 640px;
  margin: 0 auto;
  margin-top: -0.5rem;
  border: var(--border-thick);
  border-radius: 60px;
  background: var(--cream);
  box-shadow: var(--shadow);
  overflow: hidden;
  @media (max-width: 600px) {
    border-radius: 60px;
  }
`;

export const searchInputClass = css`
  flex: 1;
  background: transparent;
  border: none;
  color: var(--brown);
  font-family: var(--mono);
  font-size: 1rem;
  padding: 1rem 1.5rem 1rem 2rem;
  min-width: 0;
  outline: none;
  &::placeholder {
    color: var(--brown-light);
  }
  @media (max-width: 600px) {
    padding: 1rem 1rem 1rem 1.5rem;
  }
`;

export const searchButtonClass = css`
  background: var(--brown);
  color: var(--cream);
  border: none;
  border-left: var(--border-thick);
  padding: 1rem 2.5rem;
  font-family: var(--mono);
  font-weight: 700;
  font-size: 0.9rem;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  text-indent: 0.1em;
  &:hover {
    background: #4a3830;
  }
  &:active {
    transform: translate(1px, 1px);
  }
  @media (max-width: 600px) {
    border-left: var(--border-thick);
    padding: 1rem 1.5rem;
    flex-shrink: 0;
  }
`;

export const sectionTextClass = css`
  font-family: var(--mono);
  font-size: 2rem;
  line-height: 1.8;
  color: var(--brown);
  width: 100%;
  margin-top: 1.8rem;
  @media (max-width: 600px) {
    font-size: 1.25rem;
  }
`;

export const sectionClass = css`
  padding: 3rem 2rem;
  max-width: 1320px;
  margin: 0 auto;
  @media (max-width: 600px) {
    padding: 3.5rem 1.5rem;
  }
`;

export const sectionHeaderClass = css`
  font-family: var(--display);
  font-weight: 900;
  font-size: clamp(1.6rem, 4vw, 2.5rem);
  margin-bottom: 3rem;
  letter-spacing: -0.01em;
  color: var(--brown);
  &::after {
    content: "";
    display: block;
    width: 60px;
    height: 4px;
    background: var(--ragu);
    margin-top: 0.75rem;
    border-radius: 2px;
  }
`;

export const gridClass = css`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
  width: 100%;
  max-width: 904px;
  margin: 0 auto;
  @media (max-width: 600px) {
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
    margin-top: 2rem;
    & > :nth-child(n + 3) {
      display: none;
    }
  }
`;

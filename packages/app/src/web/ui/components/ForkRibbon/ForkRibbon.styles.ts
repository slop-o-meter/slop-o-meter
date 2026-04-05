import { css } from "hono/css";

export const forkRibbonClass = css`
  position: fixed;
  top: 1.5rem;
  right: 4rem;
  z-index: 100;
  pointer-events: none;

  @media (max-width: 1200px) {
    display: none;
  }
`;

export const forkRibbonLinkClass = css`
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  text-decoration: none;

  & img {
    display: block;
    width: 60px;
    height: auto;
    transform: rotate(-125deg);
    filter: drop-shadow(2px 3px 3px rgba(0, 0, 0, 0.25));
    transition: transform 0.2s ease;
  }

  &:hover img {
    transform: rotate(-125deg) scale(1.1);
  }
`;

export const forkRibbonTextClass = css`
  font-family: var(--mono);
  font-size: 0.6rem;
  font-weight: 700;
  color: var(--brown);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
  opacity: 0;
  transition: opacity 0.2s ease;

  a:hover > & {
    opacity: 1;
  }
`;

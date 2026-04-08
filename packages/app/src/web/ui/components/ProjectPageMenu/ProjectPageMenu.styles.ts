import { css } from "hono/css";

export const menuBarClass = css`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 150;
  display: flex;
  align-items: center;
  padding: 1rem;
  background: var(--cream);
`;

export const menuHomeLinkClass = css`
  width: 32px;
  height: 32px;
  border: var(--border);
  border-radius: 8px;
  background: var(--cream);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--brown);
  transition: background 0.15s;

  &:visited {
    color: var(--brown);
  }

  &:hover {
    background: var(--sand);
  }
`;

export const menuHomeIconClass = css`
  width: 18px;
  height: 18px;
  fill: currentColor;
`;

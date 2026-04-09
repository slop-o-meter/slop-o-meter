import { css } from "hono/css";

export const tunableParamsPanelClass = css`
  position: fixed;
  top: 0;
  right: 0;
  width: 320px;
  height: 100vh;
  background: var(--cream);
  border-left: var(--border);
  box-shadow: -4px 0 12px rgba(58, 40, 32, 0.08);
  z-index: 200;
  overflow: visible;
  transform: translateX(100%);
  transition: transform 0.25s ease;

  &[data-open] {
    transform: translateX(0);
  }
`;

export const tunableParamsScrollClass = css`
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
`;

export const tunableParamsToggleClass = css`
  position: absolute;
  top: 1rem;
  left: calc(-32px - 1rem);
  width: 32px;
  height: 32px;
  border: var(--border);
  border-radius: 8px;
  background: var(--cream);
  cursor: pointer;
  display: none;
  align-items: center;
  justify-content: center;
  padding: 0;
  color: var(--brown);
  transition: background 0.15s;

  &:hover {
    background: var(--sand);
  }

  [data-open] > & {
    background: var(--brown);
    color: var(--cream);

    &:hover {
      background: var(--brown-mid);
    }
  }

  @media (min-width: 1100px) {
    display: flex;
  }
`;

export const tunableParamsToggleIconClass = css`
  width: 18px;
  height: 18px;
  fill: currentColor;
`;

export const tunableParamsHeaderClass = css`
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 1.25rem 1.5rem 1rem;
  font-family: var(--display);
  font-weight: 700;
  font-size: 1.1rem;
  color: var(--brown);
`;

export const tunableParamsDescriptionClass = css`
  font-family: var(--mono);
  font-size: 0.72rem;
  font-weight: 400;
  color: var(--brown-light);
  line-height: 1.45;

  & a {
    color: var(--brown-mid);
    text-decoration: underline;
    text-underline-offset: 2px;

    &:hover {
      color: var(--brown);
    }
  }
`;

export const tunableParamsBodyClass = css`
  padding: 1.25rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  flex: 1;

  &[hidden] {
    display: none;
  }
`;

export const tunableParamsGroupClass = css`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

export const tunableParamsLabelRowClass = css`
  display: flex;
  align-items: center;
  gap: 0.35rem;
`;

export const tunableParamsLabelClass = css`
  font-family: var(--mono);
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--brown-mid);
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;

export const tunableParamsInfoClass = css`
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1px solid var(--brown-light);
  color: var(--brown-light);
  font-family: var(--mono);
  font-size: 0.6rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: help;
  flex-shrink: 0;
`;

export const tunableParamsInfoTooltipClass = css`
  position: fixed;
  background: rgba(58, 40, 32, 0.92);
  color: var(--cream);
  font-family: var(--mono);
  font-size: 0.7rem;
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
  line-height: 1.4;
  padding: 6px 10px;
  border-radius: 5px;
  width: max-content;
  max-width: 200px;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.12s;
  z-index: 300;

  &[data-visible] {
    opacity: 1;
  }

  &::after {
    content: "";
    position: absolute;
    top: 50%;
    right: -5px;
    transform: translateY(-50%);
    border: 5px solid transparent;
    border-right: none;
    border-left: 5px solid rgba(58, 40, 32, 0.92);
  }
`;

export const tunableParamsValueClass = css`
  font-family: var(--mono);
  font-size: 0.85rem;
  color: var(--brown);
  min-width: 2.5em;
  text-align: right;
`;

export const tunableParamsSliderRowClass = css`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`;

export const tunableParamsSliderClass = css`
  flex: 1;
  accent-color: var(--brown);
  height: 4px;
`;

export const tunableParamsSelectClass = css`
  font-family: var(--mono);
  font-size: 0.85rem;
  color: var(--brown);
  background: var(--sand);
  border: 1px solid var(--brown-light);
  border-radius: 6px;
  padding: 0.4rem 0.6rem;
  cursor: pointer;
  width: 100%;
`;

export const tunableParamsSpinnerLabelClass = css`
  font-family: var(--mono);
  font-size: 0.8rem;
  color: var(--brown-light);
`;

export const tunableParamsSpinnerClass = css`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  flex: 1;

  &[hidden] {
    display: none;
  }
`;

export const tunableParamsResetClass = css`
  font-family: var(--mono);
  font-size: 0.75rem;
  color: var(--brown);
  background: var(--cream);
  border: 1px solid var(--brown);
  border-radius: 6px;
  padding: 0.4rem 0.8rem;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  align-self: flex-start;
  margin-top: 0.5rem;
  transition: background 0.15s;

  &:hover {
    background: var(--sand);
  }

  &:disabled {
    opacity: 0.4;
    cursor: default;
    pointer-events: none;
  }
`;

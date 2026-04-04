import { css } from "hono/css";

export const backgroundClass = css`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 2rem;
  width: 100%;
  padding: 0 4rem;
`;

export const backgroundItemClass = css`
  flex: 0 0 calc(33.333% - 2rem);
`;

export const backgroundImageClass = css`
  width: 100%;
  height: auto;
  display: block;
`;

export const meterClass = css`
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0;
`;

export const meterImagesClass = css`
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  margin-bottom: 1rem;
  @media (max-width: 600px) {
    grid-template-columns: repeat(5, 1fr);
  }
`;

export const meterImageSlotClass = css`
  display: flex;
  justify-content: center;
  align-items: center;
`;

export const meterImageClass = css`
  width: 80%;
  aspect-ratio: 1;
  object-fit: contain;
  display: block;
  filter: drop-shadow(4px 4px 6px rgba(58, 40, 32, 0.4));
  @media (max-width: 600px) {
    width: 90%;
  }
`;

export const meterTrackClass = css`
  position: relative;
  height: 48px;
  @media (max-width: 600px) {
    margin: 0;
  }
`;

export const meterLineClass = css`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(to right, var(--buttered-noodles), var(--ragu));
  border-radius: 2px;
`;

export const meterNotchClass = css`
  position: absolute;
  top: 0;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
`;

export const meterNotchTickClass = css`
  width: 4px;
  height: 16px;
  background: var(--brown);
  border-radius: 2px;
`;

export const meterNotchValueClass = css`
  font-family: var(--display);
  font-weight: 700;
  font-size: 1.1rem;
  color: var(--brown);
  margin-top: 4px;
  line-height: 1;
  @media (max-width: 600px) {
    font-size: 0.9rem;
  }
`;

export const meterLabelsClass = css`
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  margin-top: 0.5rem;
  @media (max-width: 600px) {
    grid-template-columns: repeat(5, 1fr);
  }
`;

export const meterLabelClass = css`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.25rem;
`;

export const meterNameClass = css`
  font-family: var(--sans);
  font-weight: 700;
  font-size: 1.215rem;
  text-transform: uppercase;
  line-height: 1.2;
  color: var(--brown);
  @media (max-width: 600px) {
    font-size: 0.65rem;
  }
`;

export const meterDescriptionClass = css`
  font-family: var(--mono);
  font-size: 1.0125rem;
  color: var(--brown-mid);
  line-height: 1.5;
  max-width: 80%;
  @media (max-width: 600px) {
    display: none;
  }
`;

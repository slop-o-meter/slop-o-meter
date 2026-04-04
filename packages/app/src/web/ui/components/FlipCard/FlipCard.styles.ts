import { css } from "hono/css";

export const flipCardContainerClass = css`
  perspective: 1000px;
`;

export const flipCardInnerClass = css`
  position: relative;
  width: 100%;
  transition: transform 0.6s ease-in-out;
  transform-style: preserve-3d;

  &.flipped {
    transform: rotateY(180deg);
  }
`;

export const flipCardFaceClass = css`
  width: 100%;
  backface-visibility: hidden;
`;

export const flipCardBackClass = css`
  width: 100%;
  backface-visibility: hidden;
  transform: rotateY(180deg);
  position: absolute;
  top: 0;
  left: 0;
`;

import type { Child } from "hono/jsx";
import {
  flipCardBackClass,
  flipCardContainerClass,
  flipCardFaceClass,
  flipCardInnerClass,
} from "./FlipCard.styles.js";

interface Props {
  front: Child;
  back: Child;
}

export default function FlipCard({ front, back }: Props) {
  return (
    <div class={flipCardContainerClass}>
      <div class={flipCardInnerClass} data-flip-inner>
        <div class={flipCardFaceClass}>{front}</div>
        <div class={flipCardBackClass}>{back}</div>
      </div>
    </div>
  );
}

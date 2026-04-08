import scaleItems from "../../data/scaleItems.js";
import {
  projectCardClass,
  projectCardCommentClass,
  projectCardInnerClass,
  projectCardNameClass,
  projectCardScoreClass,
  projectCardStickerClass,
  projectCardStickerImageClass,
} from "./ProjectCard.styles.js";

interface Props {
  repo: string;
  url?: string;
  level: number;
  score: string;
  comment: string;
  width?: number;
}

export default function ProjectCard({
  repo,
  url,
  level,
  score,
  comment,
  width,
}: Props) {
  const scale = scaleItems.find((scaleItem) => scaleItem.level === level);
  const inlineStyle = width ? `width: ${String(width)}px` : undefined;
  const inner = (
    <div class={projectCardInnerClass}>
      <span
        class={projectCardNameClass}
        style={`--name-len: ${String(repo.length)}`}
      >
        {repo}
      </span>
      {scale ? (
        <div class={projectCardStickerClass} style={`transform: rotate(8deg)`}>
          <img
            src={scale.image}
            alt={scale.name}
            class={projectCardStickerImageClass}
            data-card-sticker
          />
        </div>
      ) : null}
      <span
        class={projectCardScoreClass}
        data-card-score
        style={`color: color-mix(in srgb, var(--ragu) ${String((Number.parseFloat(score) / 5) * 100)}%, var(--buttered-noodles))`}
      >
        {score}
      </span>
      <span class={projectCardCommentClass}>{comment}</span>
    </div>
  );

  if (url) {
    return (
      <a class={projectCardClass} href={url} style={inlineStyle}>
        {inner}
      </a>
    );
  }

  return (
    <div class={projectCardClass} style={inlineStyle}>
      {inner}
    </div>
  );
}

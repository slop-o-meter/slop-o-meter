import { css } from "hono/css";

export const projectCardClass = css`
  position: relative;
  container-type: inline-size;
  background: var(--card-bg);
  border: var(--border-thick);
  border-radius: 14px;
  box-shadow: var(--shadow);
  text-decoration: none;
  color: var(--brown);
  &:visited {
    color: var(--brown);
  }
  display: block;
  max-width: 100%;
  transition:
    transform 0.15s,
    box-shadow 0.15s;
  &[href]:hover {
    transform: translateY(-4px);
    box-shadow: var(--shadow-lg);
  }
`;

export const projectCardInnerClass = css`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 4.8cqi;
  aspect-ratio: 500 / 650;
`;

export const projectCardNameClass = css`
  font-family: var(--mono);
  font-weight: 700;
  font-size: min(8cqi, calc(130cqi / var(--name-len)));
  margin-bottom: 2.4cqi;
  max-width: 100%;
  padding: 0 2cqi;
  white-space: nowrap;
  box-sizing: border-box;
`;

export const projectCardStickerClass = css`
  width: 60cqi;
  height: 54cqi;
  margin-top: 2cqi;
  margin-bottom: 2cqi;
`;

export const projectCardStickerImageClass = css`
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: drop-shadow(3px 3px 2px rgba(58, 40, 32, 0.25));
`;

export const projectCardScoreClass = css`
  font-family: var(--display);
  font-weight: 700;
  font-size: 16cqi;
  line-height: 1;
  margin-bottom: 2.4cqi;
`;

export const projectCardCommentClass = css`
  font-family: var(--mono);
  font-size: 5cqi;
  line-height: 1.5;
  color: var(--brown-mid);
  margin-top: 6.4cqi;
  max-width: 100%;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
`;

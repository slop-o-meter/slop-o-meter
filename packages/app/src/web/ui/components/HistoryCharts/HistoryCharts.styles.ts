import { css } from "hono/css";

export const historyChartsClass = css`
  position: relative;
  width: 100%;
  &::before {
    content: "";
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 41px;
    background: var(--cream);
    z-index: 4;
    pointer-events: none;
    @media (min-width: 1100px) {
      width: 47px;
    }
  }
`;

export const chartTooltipClass = css`
  position: absolute;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(58, 40, 32, 0.92);
  color: var(--cream);
  border-radius: 6px;
  padding: 8px 12px;
  pointer-events: none;
  opacity: 0;
  transition:
    opacity 0.12s ease,
    left 0.08s ease,
    top 0.08s ease;
  &[data-visible] {
    opacity: 1;
  }
`;

export const chartTooltipImageClass = css`
  width: 36px;
  height: 36px;
  object-fit: contain;
  flex-shrink: 0;
`;

export const chartTooltipTextClass = css`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

export const chartTooltipWeekClass = css`
  font-family: var(--mono);
  font-size: 0.75rem;
  opacity: 0.7;
`;

export const chartTooltipScoreClass = css`
  font-family: var(--mono);
  font-size: 0.85rem;
  font-weight: 700;
`;

export const contentClass = css`
  padding-left: 41px;
  @media (min-width: 1100px) {
    padding-left: 47px;
  }
`;

export const scrollAreaClass = css`
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
  background: var(--cream);
  direction: rtl;
  overscroll-behavior-x: contain;
  &::-webkit-scrollbar {
    display: none;
  }
`;

export const scrollContentClass = css`
  direction: ltr;
  min-width: 100%;
  padding-left: 41px;
  @media (min-width: 1100px) {
    padding-left: 47px;
  }
`;

export const chartLabelClass = css`
  position: absolute;
  left: 0;
  right: 0;
  font-family: var(--display);
  font-weight: 700;
  font-size: 1.15rem;
  line-height: 1;
  color: var(--brown);
  text-align: center;
  background: var(--cream);
  pointer-events: none;
  z-index: 4;
  @media (min-width: 1100px) {
    font-size: 1.32rem;
  }
`;

export const scoreLabelClass = css`
  top: 0;
  padding-top: 0.5rem;
  padding-bottom: 1rem;
  @media (min-width: 1100px) {
    padding-top: 0.58rem;
    padding-bottom: 1.15rem;
  }
`;

export const changeLabelClass = css`
  top: calc(3.15rem + 208px);
  padding-top: 4rem;
  padding-bottom: 1rem;
  @media (min-width: 1100px) {
    top: calc(3.62rem + 236px);
    padding-top: 4.6rem;
    padding-bottom: 1.15rem;
  }
`;

export const scoreLabelSpacerClass = css`
  height: 3.15rem;
  @media (min-width: 1100px) {
    height: 3.62rem;
  }
`;

export const changeLabelSpacerClass = css`
  height: 6.65rem;
  @media (min-width: 1100px) {
    height: 7.65rem;
  }
`;

export const yAxisClass = css`
  position: absolute;
  left: 0;
  z-index: 5;
  border-right: 1px solid rgba(58, 40, 32, 0.15);
  background: var(--cream);
  padding-top: 1rem;
  padding-bottom: 1rem;
  margin-top: -1rem;
  @media (min-width: 1100px) {
    padding-bottom: 1rem;
  }
`;

export const scoreYAxisClass = css`
  top: calc(3.15rem + 30px);
  @media (min-width: 1100px) {
    top: calc(3.62rem + 35px);
  }
`;

export const changeYAxisClass = css`
  top: calc(9.8rem + 208px);
  @media (min-width: 1100px) {
    top: calc(11.27rem + 236px);
  }
`;

export const yAxisInnerClass = css`
  position: relative;
  font-family: var(--mono);
  font-size: 0.75rem;
  line-height: 1;
  color: var(--brown);
  padding-right: 6px;
  width: 34px;
  text-align: right;
  height: 150px;
  & span {
    position: absolute;
    right: 6px;
    transform: translateY(-50%);
  }
  @media (min-width: 1100px) {
    font-size: 0.86rem;
    padding-right: 7px;
    width: 39px;
    height: 173px;
    & span {
      right: 7px;
    }
  }
`;

export const scoreChartGridClass = css`
  display: flex;
  align-items: flex-end;
  gap: 1px;
  height: 180px;
  border-bottom: 1px solid rgba(58, 40, 32, 0.15);
  position: relative;
  & [data-crosshair] {
    position: absolute;
    bottom: 0;
    width: 1px;
    background: rgba(58, 40, 32, 0.25);
    pointer-events: none;
    z-index: 3;
    opacity: 0;
    transition: opacity 0.1s ease;
    top: calc(16.67% - 1rem);
    &[data-visible] {
      opacity: 1;
    }
  }
  @media (min-width: 1100px) {
    height: 208px;
  }
`;

export const chartGridlinesClass = css`
  position: absolute;
  inset: 0;
  pointer-events: none;
`;

export const chartGridlineClass = css`
  position: absolute;
  left: 0;
  right: 0;
  height: 1px;
  background: rgba(58, 40, 32, 0.08);
`;

export const chartGridlineZeroClass = css`
  height: 2px;
  background: rgba(58, 40, 32, 0.3);
`;

export const scoreChartBarColumnClass = css`
  flex: 1;
  min-width: 0;
  height: 100%;
  display: flex;
  align-items: flex-end;
  cursor: default;
`;

export const scoreChartBarClass = css`
  width: 100%;
  border-radius: 3px 3px 0 0;
  min-height: 4px;
`;

export const changeChartGridClass = css`
  display: flex;
  align-items: stretch;
  gap: 1px;
  height: 150px;
  position: relative;
  border-bottom: 1px solid rgba(58, 40, 32, 0.15);
  & [data-crosshair] {
    position: absolute;
    bottom: 0;
    width: 1px;
    background: rgba(58, 40, 32, 0.25);
    pointer-events: none;
    z-index: 3;
    opacity: 0;
    transition: opacity 0.1s ease;
    top: -1rem;
    &[data-visible] {
      opacity: 1;
    }
  }
  @media (min-width: 1100px) {
    height: 173px;
  }
`;

export const changeChartBarSpacerClass = css`
  flex: 1;
  min-width: 0;
`;

export const changeChartBarWrapperClass = css`
  flex: 1;
  min-width: 0;
  height: 100%;
  position: relative;
`;

export const changeChartBarPositiveClass = css`
  position: absolute;
  width: 100%;
  background: var(--level-5);
  border-radius: 3px 3px 0 0;
  opacity: 0.7;
  cursor: default;
`;

export const changeChartBarNegativeClass = css`
  position: absolute;
  width: 100%;
  background: var(--level-1);
  border-radius: 0 0 3px 3px;
  opacity: 0.7;
  cursor: default;
`;

export const chartMilestoneClass = css`
  position: absolute;
  top: 0;
  bottom: 0;
  width: 0;
  z-index: 2;
  pointer-events: none;
`;

export const chartMilestoneLineClass = css`
  position: absolute;
  top: 8.33%;
  bottom: 0;
  left: 0;
  width: 1px;
  background: rgba(58, 40, 32, 0.4);
`;

export const chartMilestoneLabelClass = css`
  position: absolute;
  left: -6px;
  display: flex;
  align-items: center;
  gap: 3px;
  white-space: nowrap;
  font-family: var(--mono);
  font-size: 0.75rem;
  color: var(--brown);
`;

export const chartMilestoneLogoClass = css`
  width: 12px;
  height: 12px;
  object-fit: contain;
`;

export const monthMarkerRowClass = css`
  position: relative;
  height: 28px;
  margin-top: 0;
  @media (min-width: 1100px) {
    height: 31px;
  }
`;

export const monthMarkerNotchClass = css`
  position: absolute;
  top: 0;
  width: 1px;
  height: 6px;
  background: rgba(58, 40, 32, 0.3);
  transform: translateX(-50%);
`;

export const monthMarkerSegmentClass = css`
  position: absolute;
  top: 8px;
  text-align: center;
`;

export const monthMarkerLabelClass = css`
  font-family: var(--mono);
  font-size: 0.85rem;
  color: var(--brown);
  white-space: nowrap;
  &[data-hidden] {
    visibility: hidden;
  }
  @media (min-width: 1100px) {
    font-size: 0.98rem;
  }
`;

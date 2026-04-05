import {
  forkRibbonClass,
  forkRibbonLinkClass,
  forkRibbonTextClass,
} from "./ForkRibbon.styles.js";

export default function ForkRibbon() {
  return (
    <div class={forkRibbonClass}>
      <a
        class={forkRibbonLinkClass}
        href="https://github.com/slop-o-meter/slop-o-meter"
        target="_blank"
        rel="noopener noreferrer"
      >
        <img src="/fork.avif" alt="Fork on GitHub" />
        <span class={forkRibbonTextClass}>Fork on GitHub</span>
      </a>
    </div>
  );
}

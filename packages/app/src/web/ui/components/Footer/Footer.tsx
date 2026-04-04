import { footerClass, footerCreditsClass } from "./Footer.styles.js";

export default function Footer() {
  return (
    <footer class={footerClass}>
      <p class={footerCreditsClass}>
        slop-o-meter.dev &middot; a sloppy project by{" "}
        <a href="https://pscanf.com/">pscanf</a>
      </p>
    </footer>
  );
}

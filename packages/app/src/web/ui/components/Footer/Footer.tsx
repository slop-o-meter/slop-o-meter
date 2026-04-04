import { footerClass, footerTextClass } from "./Footer.styles.js";

export default function Footer() {
  return (
    <footer class={footerClass}>
      <p class={footerTextClass}>
        &copy; 2026 Paolo Scanferla &middot;{" "}
        <a href="https://github.com/slop-o-meter/slop-o-meter/blob/main/LICENSE">
          AGPL-3.0-only
        </a>
      </p>
    </footer>
  );
}

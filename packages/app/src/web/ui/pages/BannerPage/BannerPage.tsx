import SlopScale from "../../components/SlopScale/SlopScale.js";
import {
  bannerBackgroundClass,
  bannerClass,
  bannerContentClass,
  headlineClass,
  headlineUnderlineClass,
  logoClass,
} from "./BannerPage.styles.js";

export default function BannerPage() {
  return (
    <div class={bannerClass}>
      <div class={bannerBackgroundClass}>
        <SlopScale variant="background" />
      </div>
      <div class={bannerContentClass}>
        <img class={logoClass} src="/logo.avif" alt="Slop-o-meter" />
        <h1 class={headlineClass}>
          Can We Measure
          <br />
          Software <span class={headlineUnderlineClass}>Slop</span>?
        </h1>
      </div>
    </div>
  );
}

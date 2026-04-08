import { spinnerClass } from "./Spinner.styles.js";

export default function Spinner() {
  return <div class={spinnerClass} aria-label="Loading" role="status" />;
}

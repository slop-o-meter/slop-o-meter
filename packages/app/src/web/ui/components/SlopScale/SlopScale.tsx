import scaleItems from "../../data/scaleItems.js";
import {
  backgroundClass,
  backgroundImageClass,
  backgroundItemClass,
  meterClass,
  meterDescriptionClass,
  meterImageClass,
  meterImageSlotClass,
  meterImagesClass,
  meterLabelClass,
  meterLabelsClass,
  meterLineClass,
  meterNameClass,
  meterNotchClass,
  meterNotchTickClass,
  meterNotchValueClass,
  meterTrackClass,
} from "./SlopScale.styles.js";

interface Props {
  variant?: "background" | "detailed";
}

export default function SlopScale({ variant }: Props) {
  if (variant === "detailed") {
    return (
      <div class={meterClass}>
        <div class={meterImagesClass}>
          {scaleItems.map((item) => (
            <div class={meterImageSlotClass}>
              <img
                class={meterImageClass}
                src={item.image}
                alt={item.name}
                loading="lazy"
                style={`transform: rotate(${String(item.rotate)}deg)`}
              />
            </div>
          ))}
        </div>
        <div class={meterTrackClass}>
          <div class={meterLineClass} />
          {[0, 1, 2, 3, 4, 5].map((value) => {
            const raguPercent = (value / 5) * 100;
            const notchColor = `color-mix(in srgb, var(--ragu) ${String(raguPercent)}%, var(--buttered-noodles))`;
            return (
              <div
                class={meterNotchClass}
                style={`left: ${String(raguPercent)}%`}
              >
                <div
                  class={meterNotchTickClass}
                  style={`background: ${notchColor}`}
                />
                <span
                  class={meterNotchValueClass}
                  style={`color: ${notchColor}`}
                >
                  {value}
                </span>
              </div>
            );
          })}
        </div>
        <div class={meterLabelsClass}>
          {scaleItems.map((item, index) => {
            const raguPercent = ((index + 0.5) / 5) * 100;
            const labelColor = `color-mix(in srgb, var(--ragu) ${String(raguPercent)}%, var(--buttered-noodles))`;
            return (
              <div class={meterLabelClass}>
                <span class={meterNameClass} style={`color: ${labelColor}`}>
                  {item.name}
                </span>
                <span
                  class={meterDescriptionClass}
                  dangerouslySetInnerHTML={{ __html: item.description }}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div class={backgroundClass}>
      {scaleItems.map((item) => (
        <div
          class={backgroundItemClass}
          style={`transform: rotate(${String(item.rotate)}deg)`}
        >
          <img
            class={backgroundImageClass}
            src={item.image}
            alt={item.name}
            loading="lazy"
          />
        </div>
      ))}
    </div>
  );
}

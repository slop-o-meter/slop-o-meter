#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BANNER_PNG="$ROOT_DIR/docs/media/banner.png"
BANNER_AVIF="$ROOT_DIR/docs/media/banner.avif"
BANNER_URL="http://localhost:5173/banner"

cleanup() {
  echo "Stopping dev server..."
  kill "$DEV_PID" 2>/dev/null || true
  wait "$DEV_PID" 2>/dev/null || true
}
trap cleanup EXIT

echo "Starting dev server..."
cd "$ROOT_DIR"
yarn dev &
DEV_PID=$!

echo "Waiting for server to be ready..."
for i in $(seq 1 30); do
  if curl -s -o /dev/null http://localhost:5173; then
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "Server failed to start"
    exit 1
  fi
  sleep 1
done

echo "Taking retina screenshot of $BANNER_URL..."
npx playwright-cli open "$BANNER_URL"
npx playwright-cli run-code "async page => {
  const browser = page.context().browser();
  const context = await browser.newContext({ deviceScaleFactor: 2, viewport: { width: 1000, height: 500 } });
  const p = await context.newPage();
  await p.goto('$BANNER_URL');
  await p.locator('div').first().screenshot({ path: '$BANNER_PNG', type: 'png' });
  await context.close();
}"
npx playwright-cli close

echo "Rounding corners..."
magick "$BANNER_PNG" \
  \( +clone -alpha extract \
    -draw "fill black polygon 0,0 0,24 24,0 fill white circle 24,24 24,0" \
    -draw "fill black polygon %[fx:w-1],0 %[fx:w-24],0 %[fx:w-1],24 fill white circle %[fx:w-25],24 %[fx:w-25],0" \
    -draw "fill black polygon 0,%[fx:h-1] 0,%[fx:h-24] 24,%[fx:h-1] fill white circle 24,%[fx:h-25] 24,%[fx:h-1]" \
    -draw "fill black polygon %[fx:w-1],%[fx:h-1] %[fx:w-1],%[fx:h-24] %[fx:w-24],%[fx:h-1] fill white circle %[fx:w-25],%[fx:h-25] %[fx:w-25],%[fx:h-1]" \
  \) -alpha off -compose CopyOpacity -composite PNG32:"$BANNER_PNG"

echo "Converting to AVIF..."
magick "$BANNER_PNG" -quality 50 "$BANNER_AVIF"
rm "$BANNER_PNG"

echo "Done! Banner saved to docs/media/banner.avif"

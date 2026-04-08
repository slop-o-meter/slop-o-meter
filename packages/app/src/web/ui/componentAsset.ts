import { readFileSync } from "node:fs";

interface ManifestEntry {
  file: string;
}

const CLIENT_PATHS: Record<string, string> = {
  "HomePage.client.ts": "src/web/ui/pages/HomePage/HomePage.client.ts",
  "ProjectPage.client.ts": "src/web/ui/pages/ProjectPage/ProjectPage.client.ts",
  "HistoryCharts.client.ts":
    "src/web/ui/components/HistoryCharts/HistoryCharts.client.ts",
  "TunableParams.client.ts":
    "src/web/ui/components/TunableParams/TunableParams.client.ts",
};

let manifest: Record<string, ManifestEntry> | null = null;
let loaded = false;

export default function componentAsset(filename: string): string {
  if (!loaded) {
    loaded = true;
    try {
      manifest = JSON.parse(
        readFileSync("./public/static/.vite/manifest.json", "utf-8"),
      ) as Record<string, ManifestEntry>;
    } catch {
      // Dev mode — no manifest, serve raw source
    }
  }

  const manifestKey = CLIENT_PATHS[filename];
  const entry = manifestKey ? manifest?.[manifestKey] : undefined;

  if (entry) {
    return `/static/${entry.file}`;
  }

  // Dev mode — serve raw source through Vite dev server
  return `/${manifestKey ?? filename}`;
}

import { readFileSync } from "node:fs";

interface ManifestEntry {
  file: string;
}

const CLIENT_PATHS: Record<string, string> = {
  "HomePage.client.js": "src/web/ui/pages/HomePage/HomePage.client.js",
  "ProjectPage.client.js": "src/web/ui/pages/ProjectPage/ProjectPage.client.js",
  "HistoryCharts.client.js":
    "src/web/ui/components/HistoryCharts/HistoryCharts.client.js",
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

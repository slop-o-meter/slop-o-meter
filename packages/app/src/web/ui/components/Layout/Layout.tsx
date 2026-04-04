import { Style } from "hono/css";
import type { Child } from "hono/jsx";

export default function Layout({ children }: { children: Child }) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>slop-o-meter: Measure AI Slop</title>
        <meta
          name="description"
          content="Measure GitHub repos and figure out how AI-sloppy they are."
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossorigin="anonymous"
        />
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link rel="stylesheet" href="/global.css" />
        <Style />
      </head>
      <body>{children}</body>
    </html>
  );
}

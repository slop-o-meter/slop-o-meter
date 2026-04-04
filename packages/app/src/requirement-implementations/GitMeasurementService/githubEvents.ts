import type { Signal } from "./signals.js";

const CLICKHOUSE_ENDPOINT = "https://play.clickhouse.com/";
const CLICKHOUSE_USER = "play";

const RELEVANT_EVENT_TYPES = [
  "IssueCommentEvent",
  "PullRequestReviewCommentEvent",
  "PullRequestReviewEvent",
  "CommitCommentEvent",
];

interface ClickHouseRow {
  created_at: string;
  actor_login: string;
}

interface ClickHouseResponse {
  data: ClickHouseRow[];
}

export default async function fetchGithubEventSignals(
  owner: string,
  repo: string,
  neighborhoodHours: number,
): Promise<Signal[]> {
  const repoName = `${owner}/${repo}`;
  const eventTypesIn = RELEVANT_EVENT_TYPES.map((t) => `'${t}'`).join(", ");

  const query = `
    SELECT created_at, actor_login
    FROM github_events
    WHERE repo_name = '${escapeClickHouseString(repoName)}'
      AND event_type IN (${eventTypesIn})
      AND action = 'created'
    ORDER BY created_at
    FORMAT JSON
  `;

  const url = `${CLICKHOUSE_ENDPOINT}?user=${CLICKHOUSE_USER}`;
  const response = await fetch(url, {
    method: "POST",
    body: query,
  });

  if (!response.ok) {
    throw new Error(
      `ClickHouse query failed: ${String(response.status)} ${response.statusText}`,
    );
  }

  const result = (await response.json()) as ClickHouseResponse;

  return result.data.map((row) => ({
    timestamp: row.created_at,
    author: row.actor_login,
    neighborhoodHours,
  }));
}

function escapeClickHouseString(value: string): string {
  return value.replace(/'/g, "\\'");
}

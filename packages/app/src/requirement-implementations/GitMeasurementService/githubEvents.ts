import type { GithubEvent } from "../../requirements/MeasurementService.js";
import type Commit from "./types.js";

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

interface FetchGithubEventsOptions {
  owner: string;
  repo: string;
  commits: Commit[];
  githubToken?: string;
}

export default async function fetchGithubEvents(
  options: FetchGithubEventsOptions,
): Promise<GithubEvent[]> {
  const { owner, repo, commits, githubToken } = options;
  const repoName = `${owner}/${repo}`;
  const eventTypesIn = RELEVANT_EVENT_TYPES.map((t) => `'${t}'`).join(", ");

  const query = `
    SELECT created_at, actor_login
    FROM github_events
    WHERE repo_name = {repoName:String}
      AND event_type IN (${eventTypesIn})
      AND action = 'created'
    ORDER BY created_at
    FORMAT JSON
  `;

  const url = new URL(CLICKHOUSE_ENDPOINT);
  url.searchParams.set("user", CLICKHOUSE_USER);
  url.searchParams.set("param_repoName", repoName);
  const response = await fetch(url.toString(), {
    method: "POST",
    body: query,
  });

  if (!response.ok) {
    throw new Error(
      `ClickHouse query failed: ${String(response.status)} ${response.statusText}`,
    );
  }

  const result = (await response.json()) as ClickHouseResponse;

  // Build login → email mapping so GitHub event actors can be matched
  // to git contributor profiles
  const uniqueLogins = new Set(result.data.map((row) => row.actor_login));
  const loginToEmail = await buildLoginToEmailMap(
    uniqueLogins,
    commits,
    owner,
    repo,
    githubToken,
  );

  return result.data.map((row) => ({
    timestamp: row.created_at,
    author: loginToEmail.get(row.actor_login.toLowerCase()) ?? row.actor_login,
  }));
}

// --- Login → Email Resolution ---

const NOREPLY_PATTERN = /^\d+\+(.+)@users\.noreply\.github\.com$/i;

/**
 * Builds a mapping from GitHub login → git email using two strategies:
 * 1. Extract logins from noreply-format emails in the commit history
 * 2. For remaining logins, query the GitHub commits API to find the email
 */
async function buildLoginToEmailMap(
  logins: Set<string>,
  commits: Commit[],
  owner: string,
  repo: string,
  githubToken?: string,
): Promise<Map<string, string>> {
  const loginToEmail = new Map<string, string>();

  // Strategy 1: extract logins from noreply emails in commits
  const allEmails = new Set<string>();
  for (const commit of commits) {
    allEmails.add(commit.author);
    for (const coAuthor of commit.coAuthors ?? []) {
      allEmails.add(coAuthor);
    }
  }

  for (const email of allEmails) {
    const match = NOREPLY_PATTERN.exec(email);
    if (match) {
      const login = match[1]!.toLowerCase();
      loginToEmail.set(login, email);
    }
  }

  // Strategy 2: resolve remaining logins via GitHub commits API
  if (githubToken) {
    const unresolvedLogins = [...logins].filter(
      (login) => !loginToEmail.has(login.toLowerCase()),
    );

    const results = await Promise.allSettled(
      unresolvedLogins.map((login) =>
        resolveLoginViaCommitsApi(owner, repo, login, githubToken),
      ),
    );

    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        loginToEmail.set(result.value.login.toLowerCase(), result.value.email);
      }
    }
  }

  return loginToEmail;
}

interface GitHubCommitResponse {
  commit: { author: { email: string } };
}

async function resolveLoginViaCommitsApi(
  owner: string,
  repo: string,
  login: string,
  githubToken: string,
): Promise<{ login: string; email: string } | null> {
  const url = `https://api.github.com/repos/${owner}/${repo}/commits?author=${encodeURIComponent(login)}&per_page=1`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github.v3+json",
      Authorization: `Bearer ${githubToken}`,
      "User-Agent": "slop-o-meter",
    },
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as GitHubCommitResponse[];
  if (data.length === 0) {
    return null;
  }

  const email = data[0]!.commit.author.email;
  if (!email) {
    return null;
  }

  return { login, email };
}

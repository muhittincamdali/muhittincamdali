// Reads public profile data with the workflow's GITHUB_TOKEN and writes build/github.json.
// Always queries user(login): in Actions `viewer` is the bot, not the profile owner.
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';

const OUTPUT = 'build/github.json';
const ENDPOINT = 'https://api.github.com/graphql';
const { login } = JSON.parse(readFileSync(new URL('../assets-src/profile.json', import.meta.url)));
const token = process.env.GITHUB_TOKEN;
if (!token) throw new Error('GITHUB_TOKEN is not set');

async function graphql(query, variables) {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': `${login}-profile` },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) throw new Error(`GraphQL HTTP ${response.status}`);
  const body = await response.json();
  if (body.errors) throw new Error(`GraphQL: ${JSON.stringify(body.errors)}`);
  return body.data;
}

const REPOS_QUERY = `query ($login: String!, $after: String) {
  user(login: $login) {
    createdAt
    repositories(first: 100, after: $after, ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC) {
      pageInfo { hasNextPage endCursor }
      nodes {
        name
        stargazerCount
        forkCount
        languages(first: 20, orderBy: { field: SIZE, direction: DESC }) { edges { size node { name } } }
      }
    }
  }
}`;

const CALENDAR_QUERY = `query ($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    contributionsCollection(from: $from, to: $to) {
      contributionCalendar { weeks { contributionDays { date contributionCount } } }
    }
  }
}`;

// GitHub's own contribution levels (0-4) for its default window, the last 53 weeks up to today: the
// arcade boards colour their cells with them, exactly as the calendar and the snake board do.
const LEVELS_QUERY = `query ($login: String!) {
  user(login: $login) {
    contributionsCollection { contributionCalendar { weeks { contributionDays { date contributionLevel } } } }
  }
}`;
const LEVELS = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };

async function fetchLevels() {
  const { user } = await graphql(LEVELS_QUERY, { login });
  const days = user.contributionsCollection.contributionCalendar.weeks.flatMap((week) => week.contributionDays);
  return new Map(days.map((day) => [day.date, LEVELS[day.contributionLevel]]));
}

async function fetchRepositories() {
  const repositories = [];
  let after = null;
  let createdAt;
  do {
    const { user } = await graphql(REPOS_QUERY, { login, after });
    if (!user) throw new Error(`User ${login} not found`);
    createdAt = user.createdAt;
    repositories.push(...user.repositories.nodes);
    after = user.repositories.pageInfo.hasNextPage ? user.repositories.pageInfo.endCursor : null;
  } while (after);
  return { createdAt, repositories };
}

// contributionsCollection spans at most one year, so the history is read year by year.
async function fetchCalendar(createdAt, now) {
  const days = new Map();
  for (let year = new Date(createdAt).getUTCFullYear(); year <= now.getUTCFullYear(); year += 1) {
    const from = new Date(Date.UTC(year, 0, 1));
    const to = year === now.getUTCFullYear() ? now : new Date(Date.UTC(year, 11, 31, 23, 59, 59));
    const { user } = await graphql(CALENDAR_QUERY, { login, from: from.toISOString(), to: to.toISOString() });
    for (const week of user.contributionsCollection.contributionCalendar.weeks) {
      for (const day of week.contributionDays) days.set(day.date, day.contributionCount);
    }
  }
  const levels = await fetchLevels();
  return [...days].sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => (levels.has(date) ? { date, count, level: levels.get(date) } : { date, count }));
}

const now = new Date();
const { createdAt, repositories } = await fetchRepositories();
const calendar = await fetchCalendar(createdAt, now);
if (repositories.length === 0 || calendar.length < 365) throw new Error('Unexpectedly empty GitHub data');

mkdirSync('build', { recursive: true });
writeFileSync(OUTPUT, JSON.stringify({ login, fetchedAt: now.toISOString(), createdAt, repositories, calendar }, null, 1));
console.log(`${OUTPUT}: ${repositories.length} public repositories, ${calendar.length} calendar days`);

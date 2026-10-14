// Pure functions that turn build/github.json into the numbers shown on the cards.
// At most three named languages plus "Other"; anything under 1% (build scripts, podspecs,
// fastlane files) is folded into "Other" so it does not read as a skill.
const TOP_LANGUAGES = 3;
const MIN_LANGUAGE_SHARE = 0.01;
const DAYS_PER_YEAR = 365;

export function totals(repositories) {
  return repositories.reduce(
    (sum, repo) => ({ stars: sum.stars + repo.stargazerCount, forks: sum.forks + repo.forkCount }),
    { stars: 0, forks: 0 },
  );
}

// Share of code size (bytes) across public, non-fork repositories.
export function languageShares(repositories) {
  const bytes = new Map();
  for (const repo of repositories) {
    for (const { size, node } of repo.languages.edges) bytes.set(node.name, (bytes.get(node.name) ?? 0) + size);
  }
  const total = [...bytes.values()].reduce((a, b) => a + b, 0);
  if (total === 0) return [];
  const sorted = [...bytes].sort((a, b) => b[1] - a[1]);
  const named = sorted.filter(([, size], index) => index < TOP_LANGUAGES && size / total >= MIN_LANGUAGE_SHARE);
  const top = named.map(([name, size]) => ({ name, share: size / total }));
  const rest = sorted.slice(named.length).reduce((sum, [, size]) => sum + size, 0);
  if (rest > 0) top.push({ name: 'Other', share: rest / total });
  return top;
}

// Longest run of consecutive days with at least one contribution, over the whole history.
export function longestStreak(calendar) {
  let longest = 0;
  let run = 0;
  for (const { count } of calendar) {
    run = count > 0 ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  return longest;
}

export function activeDays(calendar) {
  return calendar.slice(-DAYS_PER_YEAR).filter(({ count }) => count > 0).length;
}

export function summarize(data) {
  return {
    ...totals(data.repositories),
    longest: longestStreak(data.calendar),
    activeDays: activeDays(data.calendar),
    languages: languageShares(data.repositories),
    fetchedAt: data.fetchedAt,
  };
}

// Builds README.md from assets-src/README.template.md and assets-src/profile.json.
// `--check` fails when README.md is out of date (used by the workflow).
import { readFileSync, writeFileSync } from 'node:fs';
import { profile, escapeXml } from './lib/svg.mjs';
import { allChips } from './cards/chips.mjs';

const ASSETS = `https://raw.githubusercontent.com/${profile.login}/${profile.login}/output`;
const TEMPLATE = 'assets-src/README.template.md';
const README = 'README.md';
// Names that are written in lower case on purpose; camel-case brands (iPhone, iOS, macOS) are kept too.
const LOWERCASE_NAMES = new Set(['iyzico', 'fastlane']);
const CAMEL_CASE_BRAND = /^[a-z]+[A-Z]/;
const MAX_MORE_SKILLS_PER_GROUP = 8;
// Below a 1012 px window GitHub's README column is at most ~640 px (phones ~280-350 px, tablets
// ~400-640 px), where the 846-unit graphics would shrink their text under 11 px: pictures that have
// a compact variant (natural width 340-360 px) switch to it there. The width test comes first: if a
// renderer rewrites the colour-scheme part, the query becomes invalid and the browser falls back to
// the full-width sources below it.
const NARROW = '(max-width: 1011px)';

// One line with no whitespace inside: two pictures can then sit side by side with no gap
// character between them, and a lone picture line becomes its own paragraph.
function picture(name, alt, { compact = false } = {}) {
  const narrow = compact
    ? `<source media="${NARROW} and (prefers-color-scheme: dark)" srcset="${ASSETS}/${name}-compact-dark.svg">` +
      `<source media="${NARROW} and (prefers-color-scheme: light)" srcset="${ASSETS}/${name}-compact-light.svg">`
    : '';
  return (
    `<picture>` +
    narrow +
    `<source media="(prefers-color-scheme: dark)" srcset="${ASSETS}/${name}-dark.svg">` +
    `<source media="(prefers-color-scheme: light)" srcset="${ASSETS}/${name}-light.svg">` +
    `<img src="${ASSETS}/${name}-light.svg" alt="${escapeXml(alt)}">` +
    `</picture>`
  );
}

// Each chip links to the technology's official page; without a link GitHub would wrap the
// image in a link to the raw SVG file.
function chipGroup({ group, items }, chips) {
  const images = items.map((item) => {
    const chip = chips.find((candidate) => candidate.label === item.label);
    if (!/^https:\/\//.test(item.url ?? '')) throw new Error(`Stack item "${item.label}" needs an https url`);
    return `<a href="${escapeXml(item.url)}">${picture(chip.name, item.label)}</a>`;
  });
  return `<p><b>${escapeXml(group)}</b><br>\n${images.join('\n')}\n</p>`;
}

function displayName(item) {
  const firstWord = item.split(' ')[0];
  if (LOWERCASE_NAMES.has(firstWord) || CAMEL_CASE_BRAND.test(item)) return item;
  return item[0].toUpperCase() + item.slice(1);
}

// The rest of the CV skill list, as plain text: readable on a phone and not a badge wall. Its group
// names must differ from the Stack groups, so no heading appears twice on the page.
function moreSkills() {
  const stackGroups = new Set(profile.stack.map(({ group }) => group.toLowerCase()));
  const repeated = profile.moreSkills.filter(({ group }) => stackGroups.has(group.toLowerCase()));
  if (repeated.length) throw new Error(`More skills repeats Stack heading(s): ${repeated.map(({ group }) => group).join(', ')}`);
  const crowded = profile.moreSkills.filter(({ items }) => items.length > MAX_MORE_SKILLS_PER_GROUP);
  if (crowded.length) throw new Error(`More skills group(s) over ${MAX_MORE_SKILLS_PER_GROUP} items: ${crowded.map(({ group }) => group).join(', ')}`);
  const titleCased = profile.moreSkills.filter(({ group }) => /\s(?!UX\b|AI\b|SDKs\b|APIs\b)[A-Z]/.test(group));
  if (titleCased.length) throw new Error(`More skills headings must be sentence case: ${titleCased.map(({ group }) => group).join(', ')}`);
  const groups = profile.moreSkills.map(
    ({ group, items }) => `<p><b>${escapeXml(group)}</b><br>\n${items.map((item) => escapeXml(displayName(item))).join(' · ')}</p>`,
  );
  return `<details>\n<summary><b>More skills</b></summary>\n\n${groups.join('\n\n')}\n\n</details>`;
}

function stack() {
  const chips = allChips();
  return [...profile.stack.map((group) => chipGroup(group, chips)), moreSkills()].join('\n\n');
}

function email() {
  return `<a href="mailto:${escapeXml(profile.email)}"><img src="${ASSETS}/contact-email.svg" alt="Email: ${escapeXml(profile.email)}"></a>`;
}

export function buildReadme() {
  return readFileSync(TEMPLATE, 'utf8')
    .replaceAll('{{ASSETS}}', ASSETS)
    .replace('{{HERO}}', picture('hero', `${profile.name}: ${profile.tagline}`, { compact: true }))
    .replace('{{STACK}}', stack())
    .replace('{{EMAIL}}', email())
    .replace(/\{\{PICTURE(\+COMPACT)?:([\w-]+):([^}]+)\}\}/g, (_, compact, name, alt) => picture(name, alt, { compact: Boolean(compact) }));
}

const readme = buildReadme();
if (readme.includes('{{')) throw new Error('Unresolved placeholder in README template');

if (process.argv.includes('--check')) {
  if (readFileSync(README, 'utf8') !== readme) {
    console.error('README.md is out of date: run `node scripts/build-readme.mjs`');
    process.exit(1);
  }
  console.log('README.md is up to date');
} else {
  writeFileSync(README, readme);
  console.log(`Wrote ${README}`);
}

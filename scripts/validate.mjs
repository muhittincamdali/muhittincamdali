// Gate before publishing: every SVG must be well-formed, self-contained, sized sensibly,
// on-palette and complete. Exits non-zero (and publishes nothing) on any problem.
// Usage: node scripts/validate.mjs <dir> [--readme]
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { XMLValidator } from 'fast-xml-parser';
import { palette } from './lib/svg.mjs';
import { ruleFor } from './lib/rules.mjs';

const FORBIDDEN_MARKUP = [/<script/i, /<foreignObject/i, /\son[a-z]+\s*=/i, /@import/i, /<iframe/i];
const GITHUB_GREENS = ['#9be9a8', '#40c463', '#30a14e', '#216e39', '#0e4429', '#006d32', '#26a641', '#39d353', '#033a16', '#196c2e', '#2ea043', '#56d364'];
const FORBIDDEN_WORDS = [
  'unified core', 'endless march', 'purified', 'purity', 'world-class', 'world class', '#1 ', 'global standard', 'killer feature',
  'visionos pioneer', '100%', 'production-ready', 'enterprise-grade', 'profile views', 'open to work', 'hire me', 'available for', 'relocation',
];

// Names of coding assistants, model vendors and their models must never appear on the profile. They
// are kept as SHA-256 prefixes, so this check does not write the names into the repository itself.
// Whole words are compared: an API field such as `endCursor` is one word and never matches.
const FORBIDDEN_NAME_HASHES = new Set([
  'c857d09db23e6822', '3ea125d0bff386e6', '46a4eebd20d881ec', '57de4cf40144bdf7', '60965168ce762e94', '5d0c0ab127fdea24', '97f128115e33c769',
  'c70eca6b0f88f44d', '7d3194f79e645c42', '5d72436256ada538', '487b91042c7cf27a', 'de2187af3fb01170',
]);
// Sources checked with the README: everything that is committed and could be read on GitHub.
const SOURCE_DIRS = ['scripts', 'assets', 'assets-src', '.github'];
const SOURCE_FILE = /\.(mjs|js|json|md|ya?ml|txt)$/;

function forbiddenNames(text) {
  const words = new Set(text.toLowerCase().match(/[a-z]+/g) ?? []);
  return [...words].filter((word) => FORBIDDEN_NAME_HASHES.has(createHash('sha256').update(word).digest('hex').slice(0, 16)));
}

// Everything a reader or a screen reader can get from an image: its title, any text and labels.
function svgWords(svg) {
  const pieces = [...svg.matchAll(/<(title|text|desc)\b[^>]*>([^<]*)</g)].map((match) => match[2]);
  const labels = [...svg.matchAll(/aria-label="([^"]*)"/g)].map((match) => match[1]);
  return [...pieces, ...labels].join(' ');
}

function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return sourceFiles(path);
    return SOURCE_FILE.test(entry.name) ? [path] : [];
  });
}

function paletteHexes() {
  const found = JSON.stringify(palette).match(/#[0-9a-f]{6}/gi) ?? [];
  return new Set([...found.map((hex) => hex.toLowerCase()), '#ffffff', '#fff']);
}
const ALLOWED_HEX = paletteHexes();

function externalReferences(svg) {
  const withoutNamespaces = svg.replace(/xmlns(:\w+)?="[^"]*"/g, '');
  return withoutNamespaces.match(/(href|src)\s*=\s*"(?!#|data:)[^"]*"|url\((?!#|data:)[^)]*\)|https?:\/\//gi) ?? [];
}

function checkSvg(dir, file) {
  const problems = [];
  const svg = readFileSync(`${dir}/${file}`, 'utf8');
  const size = statSync(`${dir}/${file}`).size;
  const rule = ruleFor(file);
  if (!rule) return [`unexpected file name`];
  const xml = XMLValidator.validate(svg);
  if (xml !== true) problems.push(`invalid XML: ${xml.err.msg} (line ${xml.err.line})`);
  if (!/^<svg\s[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/.test(svg)) problems.push('root is not an <svg> element');
  if (!/^<svg\s[^>]*viewBox="[-\d.\s]+"/.test(svg)) problems.push('missing viewBox (would crop instead of scale)');
  if (!/<title[^>]*>[^<]{3,}<\/title>/.test(svg)) problems.push('missing <title>');
  if (size < rule.min || size > rule.max) problems.push(`size ${size} B outside ${rule.min}-${rule.max}`);
  for (const pattern of FORBIDDEN_MARKUP) if (pattern.test(svg)) problems.push(`forbidden markup ${pattern}`);
  const external = externalReferences(svg);
  if (external.length) problems.push(`external references: ${external.slice(0, 3).join(', ')}`);
  for (const text of rule.mustContain ?? []) if (!svg.includes(text)) problems.push(`missing "${text}"`);
  if (rule.minCells) {
    const cells = (svg.match(/<(rect|use)\b/g) ?? []).length;
    if (cells < rule.minCells) problems.push(`only ${cells} cells, expected >= ${rule.minCells}`);
  }
  const hexes = (svg.match(/#[0-9a-f]{6}(?![0-9a-f])/gi) ?? []).map((hex) => hex.toLowerCase());
  const greens = hexes.filter((hex) => GITHUB_GREENS.includes(hex));
  if (greens.length) problems.push(`GitHub green left: ${[...new Set(greens)].join(', ')}`);
  const offPalette = [...new Set(hexes.filter((hex) => !ALLOWED_HEX.has(hex)))];
  if (offPalette.length) problems.push(`colours outside palette: ${offPalette.slice(0, 6).join(', ')}`);
  const title = (svg.match(/<title[^>]*>([^<]*)<\/title>/) ?? [])[1]?.toLowerCase() ?? '';
  for (const word of FORBIDDEN_WORDS) if (title.includes(word)) problems.push(`forbidden phrase "${word}"`);
  for (const name of forbiddenNames(svgWords(svg))) problems.push(`forbidden name "${name}" in the image text`);
  return problems;
}

function checkReadme(dir) {
  const problems = [];
  const readme = readFileSync('README.md', 'utf8');
  const lower = readme.toLowerCase();
  for (const word of FORBIDDEN_WORDS) if (lower.includes(word)) problems.push(`README: forbidden phrase "${word}"`);
  for (const name of forbiddenNames(readme)) problems.push(`README: forbidden name "${name}"`);
  for (const file of SOURCE_DIRS.filter((path) => existsSync(path)).flatMap(sourceFiles)) {
    for (const name of forbiddenNames(readFileSync(file, 'utf8'))) problems.push(`${file}: forbidden name "${name}"`);
  }
  const miscased = readme.match(/\bI(Phone|Pad|OS)\b/g);
  if (miscased) problems.push(`README: mis-capitalised brand name ${[...new Set(miscased)].join(', ')}`);
  const files = new Set(readdirSync(dir));
  const referenced = [...readme.matchAll(/\/output\/([\w.-]+\.svg)/g)].map((match) => match[1]);
  for (const file of new Set(referenced)) if (!files.has(file)) problems.push(`README references missing ${file}`);
  const external = [...readme.matchAll(/(?:src|srcset)="(https?:[^"]+)"/g)].map((m) => m[1]).filter((url) => !url.includes('raw.githubusercontent.com/'));
  if (external.length) problems.push(`README loads images from other hosts: ${external.join(', ')}`);
  const imgs = [...readme.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
  const noAlt = imgs.filter((tag) => !/\salt="[^"]{2,}"/.test(tag));
  if (noAlt.length) problems.push(`${noAlt.length} images without alt text`);
  return problems;
}

const [dir = 'dist', ...flags] = process.argv.slice(2);
const files = readdirSync(dir).filter((file) => file.endsWith('.svg'));
if (files.length === 0) {
  console.error(`No SVG files in ${dir}`);
  process.exit(1);
}
let failedFiles = 0;
for (const file of files.sort()) {
  const problems = checkSvg(dir, file);
  if (problems.length) {
    failedFiles += 1;
    console.error(`FAIL ${file}: ${problems.join('; ')}`);
  }
}
const readmeProblems = flags.includes('--readme') ? checkReadme(dir) : [];
for (const problem of readmeProblems) console.error(`FAIL ${problem}`);
console.log(`${files.length - failedFiles}/${files.length} SVG files passed${flags.includes('--readme') ? `, README ${readmeProblems.length ? 'failed' : 'passed'}` : ''}`);
process.exit(failedFiles || readmeProblems.length ? 1 : 0);
